import { TaskStatus, type TaskStatus as TaskStatusValue } from "../domain/enums.js";

export const APP_STATE_VERSION = "1";

export type StoredTask = {
    id: string;
    title: string;
    description: string;
    status: TaskStatusValue;
    x: number;
    y: number;
    createdAt: string;
    updatedAt: string;
};

export type StoredConnection = {
    id: string;
    parentTaskId: string;
    childTaskId: string;
    createdAt: string;
};

export type StoredCanvas = {
    id: string;
    title: string;
    tasks: StoredTask[];
    connections: StoredConnection[];
    x: number;
    y: number;
    createdAt: string;
    updatedAt: string;
};

export type StoredViewSettings = {
    searchText: string;
    statusFilter: TaskStatusValue | null;
    depthFilterEnabled: boolean;
    depthBaseTaskId: string | null;
    maxDepth: number | null;
};

export type StoredAppState = {
    version: typeof APP_STATE_VERSION;
    currentCanvasId: string | null;
    canvases: StoredCanvas[];
    viewSettings: StoredViewSettings;
};

export type ValidationResult =
    | { valid: true; value: StoredAppState }
    | { valid: false; errorMessage: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === "string" && value.trim() !== "";

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

const isIsoUtcDate = (value: unknown): value is string => {
    if (typeof value !== "string"
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
};

const isTaskStatus = (value: unknown): value is TaskStatusValue =>
    value === TaskStatus.NOTSTARTED
    || value === TaskStatus.INPROGRESS
    || value === TaskStatus.COMPLETED;

const invalid = (errorMessage: string): ValidationResult => ({ valid: false, errorMessage });

export const validateStoredAppState = (value: unknown): ValidationResult => {
    if (!isRecord(value)) return invalid("保存データのトップレベルが不正です");
    if (value.version !== APP_STATE_VERSION) return invalid("未対応の保存データバージョンです");
    if (!Array.isArray(value.canvases)) return invalid("キャンバス一覧が不正です");
    if (value.currentCanvasId !== null && typeof value.currentCanvasId !== "string") {
        return invalid("現在のキャンバスIDが不正です");
    }
    if (!isRecord(value.viewSettings)) return invalid("表示設定が不正です");

    const settings = value.viewSettings;
    if (typeof settings.searchText !== "string"
        || (settings.statusFilter !== null && !isTaskStatus(settings.statusFilter))
        || typeof settings.depthFilterEnabled !== "boolean"
        || (settings.depthBaseTaskId !== null && typeof settings.depthBaseTaskId !== "string")
        || (settings.maxDepth !== null
            && (!Number.isInteger(settings.maxDepth) || (settings.maxDepth as number) < 0))) {
        return invalid("表示設定の値が不正です");
    }

    const canvasIds = new Set<string>();
    const taskIds = new Set<string>();
    const connectionIds = new Set<string>();

    for (const [canvasIndex, canvasValue] of value.canvases.entries()) {
        if (!isRecord(canvasValue)) return invalid(`キャンバス${canvasIndex + 1}の形式が不正です`);
        if (!isNonEmptyString(canvasValue.id) || canvasIds.has(canvasValue.id)) {
            return invalid("キャンバスIDが空、または重複しています");
        }
        if (!isNonEmptyString(canvasValue.title)
            || !isFiniteNumber(canvasValue.x)
            || !isFiniteNumber(canvasValue.y)
            || !isIsoUtcDate(canvasValue.createdAt)
            || !isIsoUtcDate(canvasValue.updatedAt)
            || !Array.isArray(canvasValue.tasks)
            || !Array.isArray(canvasValue.connections)) {
            return invalid(`キャンバス「${canvasValue.id}」の値が不正です`);
        }
        canvasIds.add(canvasValue.id);

        const canvasTaskIds = new Set<string>();
        for (const taskValue of canvasValue.tasks) {
            if (!isRecord(taskValue)
                || !isNonEmptyString(taskValue.id)
                || taskIds.has(taskValue.id)
                || !isNonEmptyString(taskValue.title)
                || typeof taskValue.description !== "string"
                || !isTaskStatus(taskValue.status)
                || !isFiniteNumber(taskValue.x)
                || !isFiniteNumber(taskValue.y)
                || !isIsoUtcDate(taskValue.createdAt)
                || !isIsoUtcDate(taskValue.updatedAt)) {
                return invalid(`キャンバス「${canvasValue.id}」のタスクが不正です`);
            }
            taskIds.add(taskValue.id);
            canvasTaskIds.add(taskValue.id);
        }

        const directions = new Set<string>();
        for (const connectionValue of canvasValue.connections) {
            if (!isRecord(connectionValue)
                || !isNonEmptyString(connectionValue.id)
                || connectionIds.has(connectionValue.id)
                || !isNonEmptyString(connectionValue.parentTaskId)
                || !isNonEmptyString(connectionValue.childTaskId)
                || connectionValue.parentTaskId === connectionValue.childTaskId
                || !canvasTaskIds.has(connectionValue.parentTaskId)
                || !canvasTaskIds.has(connectionValue.childTaskId)
                || !isIsoUtcDate(connectionValue.createdAt)) {
                return invalid(`キャンバス「${canvasValue.id}」の接続が不正です`);
            }
            const direction = JSON.stringify([
                connectionValue.parentTaskId,
                connectionValue.childTaskId,
            ]);
            if (directions.has(direction)) {
                return invalid(`キャンバス「${canvasValue.id}」に重複した接続があります`);
            }
            directions.add(direction);
            connectionIds.add(connectionValue.id);
        }
    }

    if (value.canvases.length === 0) {
        if (value.currentCanvasId !== null) return invalid("空の状態に現在のキャンバスが設定されています");
    } else if (value.currentCanvasId === null || !canvasIds.has(value.currentCanvasId)) {
        return invalid("現在のキャンバスが存在しません");
    }

    if (settings.depthFilterEnabled) {
        if (value.currentCanvasId === null
            || typeof settings.depthBaseTaskId !== "string"
            || !Number.isInteger(settings.maxDepth)
            || (settings.maxDepth as number) < 0) {
            return invalid("深さフィルター設定が不正です");
        }
        const currentCanvas = value.canvases.find(canvas =>
            isRecord(canvas) && canvas.id === value.currentCanvasId
        );
        if (!currentCanvas
            || !Array.isArray(currentCanvas.tasks)
            || !currentCanvas.tasks.some((task: unknown) =>
                isRecord(task) && task.id === settings.depthBaseTaskId
            )) {
            return invalid("深さフィルターの基準タスクが存在しません");
        }
    }

    return { valid: true, value: value as StoredAppState };
};
