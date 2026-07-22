import { TaskStatus } from "../domain/enums.js";
import { Task } from "../domain/task.js";
import { Connection } from "../domain/connection.js";
import { findTaskById } from "../domain/entity-finders.js";

export type FilterSource = {
    readonly tasks: readonly Task[];
    readonly connections: readonly Connection[];
};

export type FilterCriteria = {
    readonly keyword: string | null;
    readonly status: TaskStatus | null;
    readonly depth: {
        readonly baseTaskId: string;
        readonly maxDepth: number;
    } | null;
};

export type FilterResult = {
    readonly tasks: readonly Task[];
    readonly connections: readonly Connection[];
};

export class FilterService {
    private constructor() {}

    public static apply(
        source: FilterSource,
        criteria: FilterCriteria
    ): FilterResult {
        const depthTaskIds = criteria.depth === null
            ? null
            : FilterService.collectTaskIdsWithinDepth(
                source.tasks,
                source.connections,
                criteria.depth.baseTaskId,
                criteria.depth.maxDepth
            );

        const filteredTasks = source.tasks.filter((task) =>
            FilterService.matchesKeyword(task, criteria.keyword) &&
            FilterService.matchesStatus(task, criteria.status) &&
            FilterService.matchesDepth(task, depthTaskIds)
        );

        const filteredTaskIds = new Set(filteredTasks.map((task) => task.id));
        const filteredConnections = source.connections.filter((connection) =>
            filteredTaskIds.has(connection.parentTaskId) &&
            filteredTaskIds.has(connection.childTaskId)
        );

        return {
            tasks: filteredTasks,
            connections: filteredConnections,
        };
    }

    private static matchesKeyword(task: Task, keyword: string | null): boolean {
        if (keyword === null) {
            return true;
        }

        const trimmed = keyword.trim();
        if (trimmed === "") {
            return true;
        }

        const normalized = trimmed.toLowerCase();
        return (
            task.title.toLowerCase().includes(normalized) ||
            task.description.toLowerCase().includes(normalized)
        );
    }

    private static matchesStatus(task: Task, status: TaskStatus | null): boolean {
        if (status === null) {
            return true;
        }
        return task.status === status;
    }

    private static matchesDepth(task: Task, depthTaskIds: ReadonlySet<string> | null): boolean {
        if (depthTaskIds === null) {
            return true;
        }
        return depthTaskIds.has(task.id);
    }

    private static collectTaskIdsWithinDepth(
        tasks: readonly Task[],
        connections: readonly Connection[],
        baseTaskId: string,
        maxDepth: number
    ): ReadonlySet<string> {
        const baseTask = findTaskById(tasks, baseTaskId);
        const visited = new Set<string>();

        if (!baseTask) {
            return visited;
        }

        visited.add(baseTask.id);

        let frontier: readonly string[] = [baseTask.id];
        for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
            const nextFrontier: string[] = [];
            for (const taskId of frontier) {
                for (const connection of connections) {
                    const neighborId = FilterService.neighborTaskId(connection, taskId);
                    if (
                        neighborId !== null &&
                        !visited.has(neighborId) &&
                        findTaskById(tasks, neighborId)
                    ) {
                        visited.add(neighborId);
                        nextFrontier.push(neighborId);
                    }
                }
            }
            frontier = nextFrontier;
        }

        return visited;
    }

    private static neighborTaskId(connection: Connection, taskId: string): string | null {
        if (connection.parentTaskId === taskId) {
            return connection.childTaskId;
        }
        if (connection.childTaskId === taskId) {
            return connection.parentTaskId;
        }
        return null;
    }
}
