import { TaskStatus } from "../domain/enums.js";
import { Task } from "../domain/task.js";
import { Connection } from "../domain/connection.js";

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
}

export type FilterResult = {
    readonly tasks: readonly Task[];
    readonly connections: readonly Connection[];
};

export class FilterService {
    private constructor() {};

    public static apply(
        source: FilterSource,
        criteria: FilterCriteria
    ): FilterResult {
        //
    }
}
