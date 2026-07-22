import { AppState } from "../application/application.js";
import { Canvas } from "../domain/canvas.js";
import { Task } from "../domain/task.js";
import { Connection } from "../domain/connection.js";
import { ViewSettings } from "../domain/view-settings.js";
import { TaskStatus } from "../domain/enums.js";

// 有限の数値かどうかを判定する(NaNやInfinity、数値以外の値を弾く)
export function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

// 空欄または空白文字のみでない文字列かどうかを判定する
export function isNonBlankString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

// null/undefinedではないオブジェクトかどうかを判定する(プロパティアクセス前のガードに使う)
function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

// 配列の要素すべてがガード関数を満たすかどうかを判定する(満たせば配列全体の型を絞り込む)
function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
    return Array.isArray(value) && value.every(guard);
}

// TaskStatus(未着手・進行中・完了済み)のいずれかであるかを判定する
export function isValidTaskStatus(value: unknown): value is TaskStatus {
    return (
        value === TaskStatus.NOTSTARTED ||
        value === TaskStatus.INPROGRESS ||
        value === TaskStatus.COMPLETED
    );
}

// Dateとして正しく解釈できる値(Dateインスタンス、またはISO文字列など)かどうかを判定する
function isValidDateValue(value: unknown): boolean {
    if (value instanceof Date) return !Number.isNaN(value.getTime());
    if (typeof value === "string") return !Number.isNaN(new Date(value).getTime());
    return false;
}

// タスク単体の形式チェック(ID重複チェックは呼び出し側でまとめて行う)
function isValidTaskShape(task: unknown): task is Task {
    if (!isObject(task)) return false;
    return (
        isNonBlankString(task.id) &&
        isNonBlankString(task.title) &&
        typeof task.description === "string" &&
        isValidTaskStatus(task.status) &&
        isFiniteNumber(task.x) &&
        isFiniteNumber(task.y) &&
        isValidDateValue(task.createdAt) &&
        isValidDateValue(task.updatedAt)
    );
}

// 接続単体の形式チェック(参照先タスクの実在チェックは呼び出し側で行う)
function isValidConnectionShape(connection: unknown): connection is Connection {
    if (!isObject(connection)) return false;
    return (
        isNonBlankString(connection.id) &&
        isNonBlankString(connection.parentTaskId) &&
        isNonBlankString(connection.childTaskId) &&
        connection.parentTaskId !== connection.childTaskId &&
        isValidDateValue(connection.createdAt)
    );
}

// キャンバス単体の形式チェック(id, title, x, y, tasks/connections配列の有無)
function isValidCanvasShape(canvas: unknown): canvas is Canvas {
    if (!isObject(canvas)) return false;
    return (
        isNonBlankString(canvas.id) &&
        isNonBlankString(canvas.title) &&
        isFiniteNumber(canvas.x) &&
        isFiniteNumber(canvas.y) &&
        Array.isArray(canvas.tasks) &&
        Array.isArray(canvas.connections) &&
        isValidDateValue(canvas.createdAt) &&
        isValidDateValue(canvas.updatedAt)
    );
}

// ViewSettings単体の形式チェック(検索条件・ステータス絞り込み・深さフィルターそれぞれの型)
function isValidViewSettingsShape(viewSettings: unknown): viewSettings is ViewSettings {
    if (!isObject(viewSettings)) return false;
    return (
        typeof viewSettings.searchText === "string" &&
        (viewSettings.statusFilter === null || isValidTaskStatus(viewSettings.statusFilter)) &&
        typeof viewSettings.depthFilterEnabled === "boolean" &&
        (viewSettings.depthBaseTaskId === null || isNonBlankString(viewSettings.depthBaseTaskId)) &&
        typeof viewSettings.maxDepth === "number"
    );
}

// 配列内にIDの重複がないかどうかを判定する
function hasNoDuplicateIds(ids: string[]): boolean {
    return new Set(ids).size === ids.length;
}

// アプリ状態全体がspec.md 5.9節の保存条件を満たすかどうかを検証する
// stateは「AppStateのつもりで渡ってくる値」であり、実行時に不正な形式でも
// 例外を投げず必ずfalseを返す(信頼できない値として扱う)
export function validateAppStateForSave(state: unknown): boolean {
    if (!isObject(state)) return false;

    // versionの形式チェック
    if (!isNonBlankString(state.version)) return false;

    // canvasesが配列であり、各要素がCanvasとして正しい形式かどうかをチェック
    if (!isArrayOf(state.canvases, isValidCanvasShape)) return false;
    const canvases = state.canvases;

    // キャンバスIDが保存データ全体で重複していないか
    const canvasIds = canvases.map(c => c.id);
    if (!hasNoDuplicateIds(canvasIds)) return false;

    // タスクID・接続IDは「保存データ全体」で重複してはいけないため、
    // 各キャンバスを走査しながら全体分のIDを集めておく
    const allTaskIds: string[] = [];
    const allConnectionIds: string[] = [];

    for (const canvas of canvases) {
        // タスク単体の形式チェック
        if (!isArrayOf(canvas.tasks, isValidTaskShape)) return false;
        allTaskIds.push(...canvas.tasks.map(t => t.id));

        // このキャンバス内のタスクIDの集合(接続の参照先チェックに使う)
        const taskIdSetInCanvas = new Set(canvas.tasks.map(t => t.id));

        // 接続単体の形式チェック + 参照先タスクがこのキャンバス内に実在するか
        if (!isArrayOf(canvas.connections, isValidConnectionShape)) return false;
        for (const connection of canvas.connections) {
            if (
                !taskIdSetInCanvas.has(connection.parentTaskId) ||
                !taskIdSetInCanvas.has(connection.childTaskId)
            ) {
                return false;
            }
        }
        allConnectionIds.push(...canvas.connections.map(c => c.id));

        // 同一キャンバス内で「同じ向き・同じ親子ID」の接続が重複していないか
        const directionKeys = canvas.connections.map(
            c => `${c.parentTaskId}->${c.childTaskId}`
        );
        if (!hasNoDuplicateIds(directionKeys)) return false;
    }

    // タスクID・接続IDが保存データ全体で重複していないか
    if (!hasNoDuplicateIds(allTaskIds)) return false;
    if (!hasNoDuplicateIds(allConnectionIds)) return false;

    // currentCanvasIdの整合性チェック
    // (AppState.currentCanvasIdはstring型でnullを許容しないため、
    //  キャンバスが無ければ空文字、あれば実在するキャンバスを指していること)
    if (canvases.length === 0) {
        if (state.currentCanvasId !== "") return false;
    } else {
        if (!isNonBlankString(state.currentCanvasId)) return false;
        if (!canvasIds.includes(state.currentCanvasId)) return false;
    }

    // viewSettings(検索条件・ステータス絞り込み・深さフィルター)の形式チェック
    if (!isValidViewSettingsShape(state.viewSettings)) return false;
    const viewSettings = state.viewSettings;

    if (viewSettings.depthFilterEnabled) {
        // 深さフィルターが有効な場合は、現在のキャンバスが存在し、
        // 基準タスクがそのキャンバス内に実在し、最大深さが0以上の整数であること
        const currentCanvas = canvases.find(c => c.id === state.currentCanvasId);
        if (!currentCanvas) return false;

        const baseTaskExists = currentCanvas.tasks.some(
            t => t.id === viewSettings.depthBaseTaskId
        );
        if (!baseTaskExists) return false;

        if (
            !Number.isInteger(viewSettings.maxDepth) ||
            viewSettings.maxDepth < 0
        ) {
            return false;
        }
    }

    return true;
}
