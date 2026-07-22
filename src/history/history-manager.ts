import { AppState } from "../application/application.js";

export const MAX_HISTORY_ENTRIES = 50;

// Undo/Redo の対象外（Undoしても巻き戻さず、最新値を維持する）プロパティ
const IGNORED_STATE_KEYS: Array<keyof AppState | string> = [
    "searchQuery",
    "filter",
    "activeCanvasId"
];

/**
 * クラスのプロトタイプ、メソッド、配列、Date などの構造を壊さずに完全な防衛的コピー（Defensive Copy）を行う
 */
export const cloneValue = <T>(value: T): T => {
    if (value === null || value === undefined) return value;
    if (value instanceof Date) return new Date(value.getTime()) as T;
    if (Array.isArray(value)) return value.map(item => cloneValue(item)) as T;

    if (typeof value === "object") {
        const source = value as Record<string, unknown>;
        const proto = Object.getPrototypeOf(value);
        const clone = Object.create(proto);

        for (const key of Reflect.ownKeys(source)) {
            const descriptor = Object.getOwnPropertyDescriptor(source, key);
            if (descriptor) {
                if ("value" in descriptor && descriptor.value !== undefined) {
                    descriptor.value = cloneValue(descriptor.value);
                }
                Object.defineProperty(clone, key, descriptor);
            }
        }
        return clone as T;
    }
    return value;
};

/**
 * 2つの AppState が（Undo対象プロパティにおいて）等しいか判定する
 */
const isSameState = (left: AppState, right: AppState): boolean => {
    const cleanLeft = cloneValue(left) as Record<string, unknown>;
    const cleanRight = cloneValue(right) as Record<string, unknown>;

    for (const key of IGNORED_STATE_KEYS) {
        delete cleanLeft[key];
        delete cleanRight[key];
    }

    return JSON.stringify(cleanLeft) === JSON.stringify(cleanRight);
};

export class HistoryEntry {
    public description: string;
    public snapshot: AppState;
    public createdAt: Date;

    constructor(snapshot: AppState, description = "") {
        this.description = description;
        this.snapshot = cloneValue(snapshot);
        this.createdAt = new Date();
    }
}

/**
 * Undo/Redo の履歴管理クラス
 */
export class HistoryManager {
    private undoStack = new Array<HistoryEntry>();
    private redoStack = new Array<HistoryEntry>();
    private currentTrackingState: AppState | null = null;

    /**
     * 最新のドメイン状態（AppState）を履歴に記録する
     */
    public record = (afterState: AppState): void => {
        // 同一状態（または対象外プロパティのみの変更）の場合は記録しない
        if (this.currentTrackingState && isSameState(this.currentTrackingState, afterState)) {
            // UI状態（searchQuery等）の最新化のみ更新して終了
            this.currentTrackingState = cloneValue(afterState);
            return;
        }

        if (this.currentTrackingState) {
            const entry = new HistoryEntry(this.currentTrackingState);
            this.undoStack.push(entry);

            if (this.undoStack.length > MAX_HISTORY_ENTRIES) {
                this.undoStack.shift();
            }
        }

        this.currentTrackingState = cloneValue(afterState);
        this.redoStack = []; // 新しい操作が行われたため Redo スタックをクリア
    };

    /**
     * Undo を実行し、前の状態を復元して返す
     * @param currentState 呼び出し時点の現行状態（searchQuery等の最新値を保持するため）
     */
    public undo = (currentState?: AppState): AppState | null => {
        const entry = this.undoStack.pop();
        if (!entry || !this.currentTrackingState) return null;

        // 現在の状態を Redo スタックへ退避
        this.redoStack.push(new HistoryEntry(this.currentTrackingState));

        // スナップショットから復元
        const previousState = cloneValue(entry.snapshot);

        // 現行の UI 状態（対象外プロパティ）があればそれを維持・マージする
        const latestUIState = currentState ?? this.currentTrackingState;
        if (latestUIState) {
            for (const key of IGNORED_STATE_KEYS) {
                if (key in latestUIState) {
                    (previousState as Record<string, unknown>)[key] = cloneValue(
                        (latestUIState as Record<string, unknown>)[key]
                    );
                }
            }
        }

        this.currentTrackingState = cloneValue(previousState);
        return cloneValue(previousState);
    };

    /**
     * Redo を実行し、後の状態を復元して返す
     * @param currentState 呼び出し時点の現行状態
     */
    public redo = (currentState?: AppState): AppState | null => {
        const entry = this.redoStack.pop();
        if (!entry || !this.currentTrackingState) return null;

        // 現在の状態を Undo スタックへ退避
        this.undoStack.push(new HistoryEntry(this.currentTrackingState));

        // スナップショットから復元
        const nextState = cloneValue(entry.snapshot);

        // 現行の UI 状態（対象外プロパティ）があればそれを維持・マージする
        const latestUIState = currentState ?? this.currentTrackingState;
        if (latestUIState) {
            for (const key of IGNORED_STATE_KEYS) {
                if (key in latestUIState) {
                    (nextState as Record<string, unknown>)[key] = cloneValue(
                        (latestUIState as Record<string, unknown>)[key]
                    );
                }
            }
        }

        this.currentTrackingState = cloneValue(nextState);
        return cloneValue(nextState);
    };

    /**
     * すべての履歴をクリアする
     */
    public clear = (): void => {
        this.undoStack = [];
        this.redoStack = [];
        this.currentTrackingState = null;
    };
}