import { TaskStatus, type TaskStatus as TaskStatusValue } from "../domain/enums.js";

export class ClipboardState {
    sourceTaskId: string | null = null;
    sourceCanvasId: string | null = null;
    title: string | null = null;
    description: string | null = null;
    status: TaskStatusValue | null = null;
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
        return this.sourceTaskId !== null
            && this.sourceCanvasId !== null
            && this.title !== null
            && this.description !== null
            && (this.status === TaskStatus.NOTSTARTED
                || this.status === TaskStatus.INPROGRESS
                || this.status === TaskStatus.COMPLETED)
            && this.x !== null
            && this.y !== null;
    }
}
