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

    public updateTitle = (title: string): boolean => {
        if (this.title === title) return false;
        this.title = title;
        this.updateTimestamp();
        return true;
    }

    public updateDescription = (description: string): boolean => {
        if (this.description === description) return false;
        this.description = description;
        this.updateTimestamp();
        return true;
    }

    public updateStatus = (status: TaskStatus): boolean => {
        if (this.status === status) return false;
        this.status = status;
        this.updateTimestamp();
        return true;
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
        this.updatedAt = new Date();
    }
}
