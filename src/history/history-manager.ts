import { Connection } from "../domain/connection";
import { Canvas } from "../domain/canvas";

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

    }

    public undo = (): HistoryEntry | null => {

    }

    public redo = (): HistoryEntry | null => {

    }

    public clear = (): void => {

    }
}
