import { TaskStatus } from "../domain/enums.js";
import { Task } from "../domain/task.js";
import { Connection } from "../domain/connection.js";

export class FilterService {
    private constructor() {};

    // フィルター機能は今回の実装範囲外。
    // public static filterByStatus = (tasks: Array<Task>, status: TaskStatus): Array<Task> => { ... }
    // public static filterByKeyword = (tasks: Array<Task>, keyword: string): Array<Task> => { ... }
    // public static filterByDepth = (tasks: Array<Task>, connections: Array<Connection>, baseTask: Task, depth: number): Array<Task> => { ... }
}
