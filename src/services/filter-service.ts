import type { Connection } from "../domain/connection.js";
import type { TaskStatus } from "../domain/enums.js";
import type { Task } from "../domain/task.js";

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
        const keyword = criteria.keyword?.trim().toLowerCase() ?? "";
        const depthTaskIds = criteria.depth === null
            ? null
            : FilterService.collectTaskIdsWithinDepth(
                source.tasks,
                source.connections,
                criteria.depth.baseTaskId,
                criteria.depth.maxDepth
            );

        const filteredTasks = source.tasks.filter((task) =>
            (keyword === ""
                || task.title.toLowerCase().includes(keyword)
                || task.description.toLowerCase().includes(keyword))
            && (criteria.status === null || task.status === criteria.status)
            && (depthTaskIds === null || depthTaskIds.has(task.id))
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

    private static collectTaskIdsWithinDepth(
        tasks: readonly Task[],
        connections: readonly Connection[],
        baseTaskId: string,
        maxDepth: number
    ): ReadonlySet<string> {
        const taskIds = new Set(tasks.map(task => task.id));
        const visited = new Set<string>();
        if (!taskIds.has(baseTaskId)) return visited;

        const neighborsByTaskId = new Map<string, string[]>();
        const addNeighbor = (taskId: string, neighborId: string): void => {
            const neighbors = neighborsByTaskId.get(taskId);
            if (neighbors) neighbors.push(neighborId);
            else neighborsByTaskId.set(taskId, [neighborId]);
        };
        for (const connection of connections) {
            if (!taskIds.has(connection.parentTaskId) || !taskIds.has(connection.childTaskId)) {
                continue;
            }
            addNeighbor(connection.parentTaskId, connection.childTaskId);
            addNeighbor(connection.childTaskId, connection.parentTaskId);
        }

        visited.add(baseTaskId);
        let frontier: readonly string[] = [baseTaskId];
        for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
            const nextFrontier: string[] = [];
            for (const taskId of frontier) {
                for (const neighborId of neighborsByTaskId.get(taskId) ?? []) {
                    if (visited.has(neighborId)) continue;
                    visited.add(neighborId);
                    nextFrontier.push(neighborId);
                }
            }
            frontier = nextFrontier;
        }

        return visited;
    }
}
