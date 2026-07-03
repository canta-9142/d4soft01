import { TaskStatus } from "./enums";

export class Task {
    id: string = "";
    title: string = "";
    description: string = "";
    status: TaskStatus = TaskStatus.NOTSTARTED;
    x: number = 0;
    y: number = 0;
    createdAt = new Date();
    updatedAt = new Date();

    public updateTitle = (title: string): void => {
        this.title = title;
    }

    public updateDescription = (description: string): void => {
        this.description = description;
    }

    public updateStatus = (status: TaskStatus): void => {
        this.status = status;
    }

    public updatePosition = (x: number, y: number): void => {
        this.x = x;
        this.y = y;
    }

    public updateTimestamps = (updatedAt: Date): void => {
        this.updatedAt = updatedAt;
    }
}
