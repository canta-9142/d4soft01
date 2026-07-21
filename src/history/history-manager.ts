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

interface HistoryEntryInit {
    action?: HistoryAction;
    description?: string;
    targetId?: string | null;
    canvasId?: string | null;
    beforeState: AppState;
    afterState: AppState;
    affectedConnectionIds?: Array<string>;
    affectedCanvasIds?: Array<string>;
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

// 1つの操作に対応する履歴情報。Undo/Redo では beforeState / afterState を使って状態を切り替える。
export class HistoryEntry {
    action: HistoryAction;
    description: string;
    targetId: string | null;
    canvasId: string | null;
    beforeState: AppState;
    afterState: AppState;
    affectedConnectionIds: Array<string>;
    affectedCanvasIds: Array<string>;
    createdAt: Date;

    constructor(init: HistoryEntryInit) {
        this.action = init.action ?? "custom";
        this.description = init.description ?? "";
        this.targetId = init.targetId ?? null;
        this.canvasId = init.canvasId ?? null;
        this.beforeState = cloneValue(init.beforeState);
        this.afterState = cloneValue(init.afterState);
        this.affectedConnectionIds = init.affectedConnectionIds ?? [];
        this.affectedCanvasIds = init.affectedCanvasIds ?? [];
        this.createdAt = init.createdAt ?? new Date();
    }
}

// Undo/Redo の実行履歴を保持するサービス。各操作は HistoryEntry として保存し、スタック上で順に適用する。
export class HistoryManager {
    private undoStack = new Array<HistoryEntry>();
    private redoStack = new Array<HistoryEntry>();

    // 現在の AppState を基準に、操作単位の履歴を記録する。
    public record = (state: AppState, entry: HistoryEntry): void => {
        void state;
        this.undoStack.push(entry);
        if (this.undoStack.length > MAX_HISTORY_ENTRIES) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    // 直前の操作を取り消し、その状態を返す。
    public undo = (): AppState | null => {
        const entry = this.undoStack.pop();
        if (!entry) return null;
        this.redoStack.push(entry);
        return cloneValue(entry.beforeState);
    }

    // 取り消した操作をやり直し、その状態を返す。
    public redo = (): AppState | null => {
        const entry = this.redoStack.pop();
        if (!entry) return null;
        this.undoStack.push(entry);
        return cloneValue(entry.afterState);
    }

    // すべての履歴をクリアする。
    public clear = (): void => {
        this.undoStack = [];
        this.redoStack = [];
    }
}
