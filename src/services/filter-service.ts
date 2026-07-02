import { TaskStatus } from "../domain/enums";
import { Task } from "../domain/task";
import { Connection } from "../domain/connection";

export class FilterService {
    private constructor() {};

    public static filterByStatus = (tasks: Array<Task>, status: TaskStatus): Array<Task> => {

    }

    public static filterByKeyword = (tasks: Array<Task>, keyword: string): Array<Task> => {

    }

    public static filterByDepth = (tasks: Array<Task>, connections: Array<Connection>, baseTask: Task, depth: number): Array<Task> => {

    }
}
