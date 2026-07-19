import { AppState } from "../application/application.js";

export const MAX_HISTORY_ENTRIES = 50;

export type HistoryAction =
    | "custom"
    | "createCanvas"
    | "updateCanvas"
    | "removeCanvas"
    | "createTask"
    | "updateTask"
    | "removeTask"
    | "createConnection"
    | "removeConnection"
    | "changeCanvas"
    | "viewSettings"
    | "clipboard";

export type AppStateTransformer = (state: AppState) => AppState;

interface HistoryEntryInit {
    action?: HistoryAction;
    description?: string;
    targetId?: string | null;
    canvasId?: string | null;
    undo: AppStateTransformer;
    redo: AppStateTransformer;
    createdAt?: Date;
}

const cloneValue = <T>(value: T): T => {
    if (value === null || value === undefined) return value;
    if (value instanceof Date) return new Date(value.getTime()) as T;
    if (Array.isArray(value)) return value.map(item => cloneValue(item)) as T;
    if (typeof value === "object") {
        const source = value as Record<string, unknown>;
        const clone = Object.create(Object.getPrototypeOf(value));
        for (const [key, child] of Object.entries(source)) {
            clone[key] = cloneValue(child);
        }
        return clone as T;
    }
    return value;
};

export class HistoryEntry {
    action: HistoryAction;
    description: string;
    targetId: string | null;
    canvasId: string | null;
    undo: AppStateTransformer;
    redo: AppStateTransformer;
    createdAt: Date;

    constructor(init: HistoryEntryInit) {
        this.action = init.action ?? "custom";
        this.description = init.description ?? "";
        this.targetId = init.targetId ?? null;
        this.canvasId = init.canvasId ?? null;
        this.undo = init.undo;
        this.redo = init.redo;
        this.createdAt = init.createdAt ?? new Date();
    }
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
        if (!entry) return null;
        this.redoStack.push(entry);
        return entry.undo(cloneValue(state));
    }

    public redo = (state: AppState): AppState | null => {
        const entry = this.redoStack.pop();
        if (!entry) return null;
        this.undoStack.push(entry);
        return entry.redo(cloneValue(state));
    }

    public clear = (): void => {
        this.undoStack = [];
        this.redoStack = [];
    }
}
