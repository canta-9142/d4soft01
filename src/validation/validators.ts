import { TaskStatus } from "../domain/enums.js";

export const STORAGE_FORMAT_VERSION = "1";

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

// Date.prototype.toISOString()が出力する形式にのみマッチする正規表現。
// 通常の4桁年に加え、Dateが扱える範囲の拡張年表記(+010000など)も許可する。
const ISO_8601_UTC_PATTERN =
    /^(?:\d{4}|[+-]\d{6})-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// Dateとして正しく解釈できる値かどうかを判定する
// 文字列の場合はtoISOString()相当のUTC ISO 8601形式のみを許容する
// ("July 22, 2026"のような自然文形式や、new Date()が緩く解釈できてしまう表記は弾く)
function isValidDateValue(value: unknown): boolean {
    if (value instanceof Date) return !Number.isNaN(value.getTime());
    if (typeof value === "string" && ISO_8601_UTC_PATTERN.test(value)) {
        const date = new Date(value);
        return !Number.isNaN(date.getTime()) && date.toISOString() === value;
    }
    return false;
}

// タスク単体の形式チェック(ID重複チェックは呼び出し側でまとめて行う)
function isValidTaskShape(task: unknown): task is Record<string, unknown> & {
    id: string;
    title: string;
} {
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
function isValidConnectionShape(connection: unknown): connection is Record<string, unknown> & {
    id: string;
    parentTaskId: string;
    childTaskId: string;
} {
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
function isValidCanvasShape(canvas: unknown): canvas is Record<string, unknown> & {
    id: string;
    tasks: unknown[];
    connections: unknown[];
} {
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
function isValidViewSettingsShape(viewSettings: unknown): viewSettings is Record<string, unknown> & {
    depthFilterEnabled: boolean;
    depthBaseTaskId: string | null;
    maxDepth: number | null;
} {
    if (!isObject(viewSettings)) return false;
    return (
        typeof viewSettings.searchText === "string" &&
        (viewSettings.statusFilter === null || isValidTaskStatus(viewSettings.statusFilter)) &&
        typeof viewSettings.depthFilterEnabled === "boolean" &&
        (viewSettings.depthBaseTaskId === null || isNonBlankString(viewSettings.depthBaseTaskId)) &&
        (viewSettings.maxDepth === null || isFiniteNumber(viewSettings.maxDepth))
    );
}

// 配列内にIDの重複がないかどうかを判定する
function hasNoDuplicateIds(ids: string[]): boolean {
    return new Set(ids).size === ids.length;
}

// アプリ状態全体がspec.md 5.9節の保存条件を満たすかどうかを検証する
// stateは「AppStateのつもりで渡ってくる値」であり、実行時に不正な形式でも
// 例外を投げず必ずfalseを返す(信頼できない値として扱う)
function validateAppState(state: unknown): boolean {
    if (!isObject(state)) return false;

    // 現在対応している保存形式以外は保存・復元しない
    if (state.version !== STORAGE_FORMAT_VERSION) return false;

    // canvasesが配列であり、各要素がCanvasとして正しい形式かどうかをチェック
    if (!isArrayOf(state.canvases, isValidCanvasShape)) return false;
    const canvases = state.canvases;

    // キャンバスIDが保存データ全体で重複していないか
    const canvasIds = canvases.map(c => c.id);
    if (!hasNoDuplicateIds(canvasIds)) return false;

    // タスクID・接続IDは「保存データ全体」で重複してはいけないため、
    // 各キャンバスを走査しながら全体分のIDを集めておく
    const allTaskIds = new Set<string>();
    const allConnectionIds = new Set<string>();

    for (const canvas of canvases) {
        // タスク単体の形式チェック
        if (!isArrayOf(canvas.tasks, isValidTaskShape)) return false;
        for (const task of canvas.tasks) {
            if (allTaskIds.has(task.id)) return false;
            allTaskIds.add(task.id);
        }

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
        for (const connection of canvas.connections) {
            if (allConnectionIds.has(connection.id)) return false;
            allConnectionIds.add(connection.id);
        }

        // 同一キャンバス内で「同じ向き・同じ親子ID」の接続が重複していないか
        const directionKeys = canvas.connections.map(
            c => JSON.stringify([c.parentTaskId, c.childTaskId])
        );
        if (!hasNoDuplicateIds(directionKeys)) return false;
    }

    // currentCanvasIdの整合性チェック
    // キャンバスが無ければnull、あれば実在するキャンバスを指していること
    if (canvases.length === 0) {
        if (state.currentCanvasId !== null) return false;
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
            t => isValidTaskShape(t) && t.id === viewSettings.depthBaseTaskId
        );
        if (!baseTaskExists) return false;

        if (
            viewSettings.maxDepth === null ||
            !Number.isInteger(viewSettings.maxDepth) ||
            viewSettings.maxDepth < 0
        ) {
            return false;
        }
    }

    return true;
}

export function validateAppStateForSave(state: unknown): boolean {
    try {
        return validateAppState(state);
    } catch {
        // Proxyやgetterを含む値など、通常のJSONでは現れない入力でも
        // 呼び出し側へ例外を漏らさず、検証失敗として扱う。
        return false;
    }
}
