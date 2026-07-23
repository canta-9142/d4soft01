import { isTaskStatus, type TaskStatus } from "../domain/enums.js";

export type ClipboardTaskSnapshot = Readonly<{
    sourceTaskId: string;
    sourceCanvasId: string;
    title: string;
    description: string;
    status: TaskStatus;
    x: number;
    y: number;
}>;

export class ClipboardState {
    sourceTaskId: string | null = null;
    sourceCanvasId: string | null = null;
    title: string | null = null;
    description: string | null = null;
    status: TaskStatus | null = null;
    x: number | null = null;
    y: number | null = null;

    clear(): void {
        this.sourceTaskId = null;
        this.sourceCanvasId = null;
        this.title = null;
        this.description = null;
        this.status = null;
        this.x = null;
        this.y = null;
    }

    get hasTask(): boolean {
        return this.taskSnapshot !== null;
    }

    get taskSnapshot(): ClipboardTaskSnapshot | null {
        if (this.sourceTaskId === null
            || this.sourceCanvasId === null
            || this.title === null
            || this.description === null
            || !isTaskStatus(this.status)
            || this.x === null
            || this.y === null
            || !Number.isFinite(this.x)
            || !Number.isFinite(this.y)) return null;
        return {
            sourceTaskId: this.sourceTaskId,
            sourceCanvasId: this.sourceCanvasId,
            title: this.title,
            description: this.description,
            status: this.status,
            x: this.x,
            y: this.y,
        };
    }
}
