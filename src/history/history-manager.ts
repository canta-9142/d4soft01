import { AppState } from "../application/application.js";

export const MAX_HISTORY_ENTRIES = 50;

// 差分を表す型。AppState の一部変更を表現できるようにする。
export type AppStateDiff = Partial<AppState> & Record<string, unknown>;

// HistoryEntry が保持するデータの定義。
interface HistoryEntryInit {
    description?: string;
    undoDiff: AppStateDiff;
    redoDiff: AppStateDiff;
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

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);
};

const isEqual = (left: unknown, right: unknown): boolean => {
    return JSON.stringify(left) === JSON.stringify(right);
};

// 2つの AppState を比較して差分を抽出する。
const calculateDiff = (base: unknown, target: unknown): unknown => {
    if (isPlainObject(base) && isPlainObject(target)) {
        const diff: Record<string, unknown> = {};
        const keys = new Set([...Object.keys(base), ...Object.keys(target)]);

        for (const key of keys) {
            if (!(key in base)) {
                diff[key] = cloneValue(target[key]);
                continue;
            }
            if (!(key in target)) {
                diff[key] = undefined;
                continue;
            }

            const nestedDiff = calculateDiff(base[key], target[key]);
            if (nestedDiff !== undefined) {
                diff[key] = nestedDiff;
            }
        }

        return Object.keys(diff).length > 0 ? diff : undefined;
    }

    if (Array.isArray(base) || Array.isArray(target)) {
        return isEqual(base, target) ? undefined : cloneValue(target);
    }

    return isEqual(base, target) ? undefined : cloneValue(target);
};

// 差分を現在の状態に適用して、新しい AppState を返す。
const applyDiff = (currentState: AppState, diff: AppStateDiff): AppState => {
    const nextState = cloneValue(currentState) as unknown as Record<string, unknown>;

    const applyPatch = (target: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> => {
        const result = cloneValue(target);
        for (const [key, value] of Object.entries(patch)) {
            if (value === undefined) {
                delete result[key];
                continue;
            }

            const currentValue = result[key];
            if (isPlainObject(value) && isPlainObject(currentValue)) {
                result[key] = applyPatch(currentValue as Record<string, unknown>, value as Record<string, unknown>);
            } else {
                result[key] = cloneValue(value);
            }
        }
        return result;
    };

    return applyPatch(nextState, diff as Record<string, unknown>) as unknown as AppState;
};

const createHistoryEntryFromStates = (beforeState: AppState, afterState: AppState): HistoryEntry => {
    return new HistoryEntry({
        undoDiff: (calculateDiff(afterState, beforeState) ?? {}) as AppStateDiff,
        redoDiff: (calculateDiff(beforeState, afterState) ?? {}) as AppStateDiff,
    });
};

// 1つの操作に対応する履歴情報（差分のみを保持する）。
export class HistoryEntry {
    public description: string;
    public undoDiff: AppStateDiff;
    public redoDiff: AppStateDiff;
    public createdAt: Date;

    constructor(init: HistoryEntryInit) {
        this.description = init.description ?? "";
        this.undoDiff = init.undoDiff;
        this.redoDiff = init.redoDiff;
        this.createdAt = init.createdAt ?? new Date();
    }
}

// Undo/Redo の履歴管理を行うクラス。
export class HistoryManager {
    private undoStack = new Array<HistoryEntry>();
    private redoStack = new Array<HistoryEntry>();

    // 差分比較のために、最新の全体状態を内部で保持する。
    private currentTrackingState: AppState | null = null;

    private isSameState = (left: AppState, right: AppState): boolean => {
        return JSON.stringify(left) === JSON.stringify(right);
    };

    // 現在の状態を履歴に記録する。
    public record = (afterState: AppState): void => {
        const previousState = this.currentTrackingState;

        if (previousState && this.isSameState(previousState, afterState)) {
            return;
        }

        if (previousState) {
            const entry = createHistoryEntryFromStates(previousState, afterState);
            this.undoStack.push(entry);

            if (this.undoStack.length > MAX_HISTORY_ENTRIES) {
                this.undoStack.shift();
            }
        }

        this.currentTrackingState = cloneValue(afterState);
        this.redoStack = [];
    };

    // Undo を行い、1つ前の状態を返す。
    public undo = (): AppState | null => {
        const entry = this.undoStack.pop();
        if (!entry || !this.currentTrackingState) return null;

        this.redoStack.push(entry);
        const previousState = applyDiff(this.currentTrackingState, entry.undoDiff);
        this.currentTrackingState = previousState;

        return previousState;
    };

    // Redo を行い、1つ後の状態を返す。
    public redo = (): AppState | null => {
        const entry = this.redoStack.pop();
        if (!entry || !this.currentTrackingState) return null;

        this.undoStack.push(entry);
        const nextState = applyDiff(this.currentTrackingState, entry.redoDiff);
        this.currentTrackingState = nextState;

        return nextState;
    };

    // すべての履歴をクリアする。
    public clear = (): void => {
        this.undoStack = [];
        this.redoStack = [];
        this.currentTrackingState = null;
    };
}


