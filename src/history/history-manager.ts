import { AppState } from "../application/application.js";

export const MAX_HISTORY_ENTRIES = 50;

// Undo/Redo の対象外（巻き戻さず画面の最新値を維持する）プロパティ
const IGNORED_STATE_KEYS = new Set([
    "searchQuery",
    "filter",
    "activeCanvasId"
]);

/**
 * クラスのプロトタイプ、メソッド、配列、Date などの構造を保ちながら防衛的コピーを行う
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

// 2つの値が同等か確認する
const isEqual = (left: unknown, right: unknown): boolean => {
    return JSON.stringify(left) === JSON.stringify(right);
};

// オブジェクト判定
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);
};

/**
 * [P2 解決] 配列全体を複製せず、変更のあった要素・プロパティのみの構造的差分を生成する
 */
const calculateSmartDiff = (base: unknown, target: unknown, parentKey?: string): unknown => {
    if (isPlainObject(base) && isPlainObject(target)) {
        const diff: Record<string, unknown> = {};
        const keys = new Set([...Object.keys(base), ...Object.keys(target)]);

        for (const key of keys) {
            if (parentKey === undefined && IGNORED_STATE_KEYS.has(key)) {
                continue;
            }
            if (!(key in base)) {
                diff[key] = cloneValue(target[key]);
                continue;
            }
            if (!(key in target)) {
                diff[key] = undefined;
                continue;
            }

            const nested = calculateSmartDiff(base[key], target[key], key);
            if (nested !== undefined) {
                diff[key] = nested;
            }
        }
        return Object.keys(diff).length > 0 ? diff : undefined;
    }

    if (Array.isArray(base) && Array.isArray(target)) {
        if (isEqual(base, target)) return undefined;

        // [P2 メモリ削減の肝] 配列要素に変更がある場合、変更された要素のインデックス差分のみを保持する
        const arrayPatch: Record<number, unknown> = {};
        let isLengthChanged = base.length !== target.length;

        const maxLength = Math.max(base.length, target.length);
        for (let i = 0; i < maxLength; i++) {
            if (i >= base.length || i >= target.length) {
                isLengthChanged = true;
                break;
            }
            const itemDiff = calculateSmartDiff(base[i], target[i]);
            if (itemDiff !== undefined) {
                arrayPatch[i] = itemDiff;
            }
        }

        // 要素数変更や大幅な並び替えがある場合は全配列を保持し、一部要素変更のみインデックス差分化
        if (!isLengthChanged && Object.keys(arrayPatch).length > 0) {
            return { __indexDiff__: arrayPatch };
        }
        return cloneValue(target);
    }

    return isEqual(base, target) ? undefined : cloneValue(target);
};

/**
 * 差分を状態へ適用する
 */
const applySmartDiff = (baseState: AppState, diff: Record<string, unknown>): AppState => {
    const result = cloneValue(baseState) as unknown as Record<string, unknown>;

    const applyPatch = (target: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> => {
        for (const [key, value] of Object.entries(patch)) {
            if (value === undefined) {
                delete target[key];
                continue;
            }

            const current = target[key];

            // 配列のインデックス部分差分の適用
            if (isPlainObject(value) && "__indexDiff__" in value && Array.isArray(current)) {
                const indexDiff = value.__indexDiff__ as Record<string, unknown>;
                for (const [idxStr, itemPatch] of Object.entries(indexDiff)) {
                    const idx = Number(idxStr);
                    if (current[idx] !== undefined) {
                        current[idx] = isPlainObject(itemPatch) && isPlainObject(current[idx])
                            ? applyPatch(current[idx] as Record<string, unknown>, itemPatch as Record<string, unknown>)
                            : cloneValue(itemPatch);
                    }
                }
                continue;
            }

            if (isPlainObject(value) && isPlainObject(current)) {
                target[key] = applyPatch(current as Record<string, unknown>, value as Record<string, unknown>);
            } else {
                target[key] = cloneValue(value);
            }
        }
        return target;
    };

    return applyPatch(result, diff) as unknown as AppState;
};

export class HistoryEntry {
    public description: string;
    public undoDiff: Record<string, unknown>;
    public redoDiff: Record<string, unknown>;
    public createdAt: Date;

    constructor(undoDiff: Record<string, unknown>, redoDiff: Record<string, unknown>, description = "") {
        this.description = description;
        this.undoDiff = undoDiff;
        this.redoDiff = redoDiff;
        this.createdAt = new Date();
    }
}

export class HistoryManager {
    private undoStack = new Array<HistoryEntry>();
    private redoStack = new Array<HistoryEntry>();
    private currentTrackingState: AppState | null = null;

    /**
     * [P1 解決] 明示的な前後状態受け渡し機能（自動検知フォールバック付き）
     */
    public recordOperation = (beforeState: AppState, afterState: AppState): void => {
        const undoDiff = (calculateSmartDiff(afterState, beforeState) ?? {}) as Record<string, unknown>;
        const redoDiff = (calculateSmartDiff(beforeState, afterState) ?? {}) as Record<string, unknown>;

        // 差分がなければ保存しない
        if (Object.keys(undoDiff).length === 0 && Object.keys(redoDiff).length === 0) {
            this.currentTrackingState = cloneValue(afterState);
            return;
        }

        const entry = new HistoryEntry(undoDiff, redoDiff);
        this.undoStack.push(entry);

        if (this.undoStack.length > MAX_HISTORY_ENTRIES) {
            this.undoStack.shift();
        }

        this.currentTrackingState = cloneValue(afterState);
        this.redoStack = []; // 分岐発生のため Redo をクリア
    };

    public record = (afterState: AppState): void => {
        if (this.currentTrackingState) {
            this.recordOperation(this.currentTrackingState, afterState);
        } else {
            this.currentTrackingState = cloneValue(afterState);
        }
    };

    /**
     * [P1 解決] Undo 実行（呼び出し時の画面状態を受け取り、最新の検索ワード等を保持）
     */
    public undo = (currentState?: AppState): AppState | null => {
        const entry = this.undoStack.pop();
        if (!entry || !this.currentTrackingState) return null;

        this.redoStack.push(entry);

        // 呼び出し時の最新状態をベースに undoDiff を適用
        const base = currentState ? cloneValue(currentState) : this.currentTrackingState;
        const previousState = applySmartDiff(base, entry.undoDiff);

        this.currentTrackingState = cloneValue(previousState);
        // [P1 防衛的コピー] 外部に内部参照を共有しない
        return cloneValue(previousState);
    };

    /**
     * Redo 実行
     */
    public redo = (currentState?: AppState): AppState | null => {
        const entry = this.redoStack.pop();
        if (!entry || !this.currentTrackingState) return null;

        this.undoStack.push(entry);

        const base = currentState ? cloneValue(currentState) : this.currentTrackingState;
        const nextState = applySmartDiff(base, entry.redoDiff);

        this.currentTrackingState = cloneValue(nextState);
        return cloneValue(nextState);
    };

    public clear = (): void => {
        this.undoStack = [];
        this.redoStack = [];
        this.currentTrackingState = null;
    };
}