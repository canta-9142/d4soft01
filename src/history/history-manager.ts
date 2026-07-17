import { Connection } from "../domain/connection.js";
import { Canvas } from "../domain/canvas.js";
import { AppState } from "../application/application.js";

export const MAX_HISTORY_ENTRIES = 50;

export class HistoryEntry {
    type: string = "";
    targetId: string = "";
    canvasId: string | null = null;
    beforeState: unknown | null = null;
    afterState: unknown | null = null;
    affectedConnections: Array<Connection> | null = null;
    affectedCanvas: Canvas | null = null;
    createdAt = new Date();
}

export class HistoryManager {
    private undoStack = new Array<HistoryEntry>();
    private redoStack = new Array<HistoryEntry>();

    public record = (entry: HistoryEntry): void => {
        this.undoStack.push(entry);
        if (this.undoStack.length > MAX_HISTORY_ENTRIES) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    public undo = (state: AppState): AppState | null => {
        const entry = this.undoStack.pop();
        if (entry) {
            this.redoStack.push(entry);
        }
        return null;
    }

    public redo = (state: AppState): AppState | null => {
        const entry = this.redoStack.pop();
        if (entry) {
            this.undoStack.push(entry);
        }
        return null;
    }

    public clear = (): void => {
        this.undoStack = [];
        this.redoStack = [];
    }
}
