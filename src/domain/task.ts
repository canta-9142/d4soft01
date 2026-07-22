import { TaskStatus } from "./enums.js";

export class Task {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    x: number;
    y: number;
    createdAt: Date;
    updatedAt: Date;

    constructor(id: string, title: string = "", description: string = "", status: TaskStatus = TaskStatus.NOTSTARTED, x: number = 0, y: number = 0) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.status = status;
        this.x = x;
        this.y = y;
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    public updateTitle = (title: string): void => {
        this.title = title;
        this.updateTimestamp(new Date());
    }

    public updateDescription = (description: string): void => {
        this.description = description;
        this.updateTimestamp(new Date());
    }

    public updateStatus = (status: TaskStatus): void => {
        this.status = status;
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
