import { Task } from "./task";
import { Connection } from "./connection";

export class Canvas {
    id: string = "";
    title: string = "";
    tasks = new Array<Task>();
    connections = new Array<Connection>();
    x: number = 0;
    y: number = 0;
    createdAt = new Date();
    updatedAt = new Date();

    public updateTitle = (title: string): void => {
        this.title = title;
    }
    public updatePosition = (x: number, y: number): void => {
        this.x = x;
        this.y = y;
    }
    public updateTimestamps = (updatedAt: Date): void => {
        this.updatedAt = updatedAt;
    }
}
