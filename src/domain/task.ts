import { TaskStatus } from "./enums.js";

export class Task {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    x: number;
    y: number;
    createdAt: string;
    updatedAt: string;

    constructor(id: string, title: string = "", description: string = "", status: TaskStatus = TaskStatus.NOTSTARTED, x: number = 0, y: number = 0) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.status = status;
        this.x = x;
        this.y = y;
        const now = new Date().toISOString();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public updateDetails = (title: string, description: string, status: TaskStatus): boolean => {
        if (this.title === title && this.description === description && this.status === status) {
            return false;
        }
        this.title = title;
        this.description = description;
        this.status = status;
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
