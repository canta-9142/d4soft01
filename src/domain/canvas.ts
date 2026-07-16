import { Task } from "./task.js";
import { Connection } from "./connection.js";

export class Canvas {
    id: string;
    title: string;
    tasks: Array<Task>;
    connections: Array<Connection>;
    x: number;
    y: number;
    createdAt: Date;
    updatedAt: Date;

    constructor(id: string, title: string = "", x: number = 0, y: number = 0) {
        this.id = id;
        this.title = title;
        this.tasks = [];
        this.connections = [];
        this.x = x;
        this.y = y;
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    public updateTitle = (title: string): void => {
        this.title = title;
        this.updateTimestamp(new Date());
    }
    public updatePosition = (x: number, y: number): void => {
        this.x = x;
        this.y = y;
        this.updateTimestamp(new Date());
    }
    private updateTimestamp = (updatedAt: Date): void => {
        this.updatedAt = updatedAt;
    }
}
