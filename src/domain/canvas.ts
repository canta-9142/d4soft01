import type { Connection } from "./connection.js";
import type { Task } from "./task.js";

export class Canvas {
    id: string;
    title: string;
    tasks: Array<Task>;
    connections: Array<Connection>;
    x: number;
    y: number;
    createdAt: string;
    updatedAt: string;

    constructor(id: string, title: string = "", x: number = 0, y: number = 0) {
        this.id = id;
        this.title = title;
        this.tasks = [];
        this.connections = [];
        this.x = x;
        this.y = y;
        const now = new Date().toISOString();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public updateTitle = (title: string): boolean => {
        if (this.title === title) return false;
        this.title = title;
        this.updateTimestamp();
        return true;
    }

    public updatePosition = (x: number, y: number): boolean => {
        if (this.x === x && this.y === y) return false;
        this.x = x;
        this.y = y;
        this.updateTimestamp();
        return true;
    }

    private updateTimestamp = (): void => {
        this.updatedAt = new Date().toISOString();
    }
}
