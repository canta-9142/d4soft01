import { TaskStatus } from "../domain/enums";

export class ClipboardState {
    sourceTaskId: string | null = null;
    sourceCanvasId: string | null = null;
    title: string | null = null;
    description: string | null = null;
    status: TaskStatus | null = null;
    x: number | null = null;
    y: number | null = null;
}
