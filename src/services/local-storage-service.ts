import { AppState } from "../application/app-state.js";
import { Canvas } from "../domain/canvas.js";
import { Task } from "../domain/task.js";
import { Connection } from "../domain/connection.js";
import { ViewSettings } from "../domain/view-settings.js";
import {
    STORAGE_FORMAT_VERSION,
    validateAppStateForSave,
} from "../validation/validators.js";

// localStorageに保存するときのキー名（spec.mdで定義された名前）
export const STORAGE_KEY = "d4soft01.todoCanvas.state";

type JsonValue<T> =
    T extends Date ? string
    : T extends (...args: never[]) => unknown ? never
    : T extends Array<infer Item> ? Array<JsonValue<Item>>
    : T extends object ? {
        [Key in keyof T as T[Key] extends (...args: never[]) => unknown
            ? never
            : Key]: JsonValue<T[Key]>
    }
    : T;

type StoredAppState = JsonValue<AppState>;
type StoredCanvas = StoredAppState["canvases"][number];
type StoredTask = StoredCanvas["tasks"][number];
type StoredConnection = StoredCanvas["connections"][number];
type StoredViewSettings = StoredAppState["viewSettings"];

// load()の戻り値の型：成功したかどうか・復元したデータ・エラー内容を持つ
export type RestoreResult =
    | { success: true; state: AppState; errorMessage: null }
    | { success: false; state: null; errorMessage: string | null };

export class LocalStorageService {
    // new LocalStorageService() させないためのprivateコンストラクタ（staticクラスとして使う）
    private constructor() {}

    // アプリの状態をlocalStorageに保存する。成功したらtrue、失敗したらfalse
    public static save(state: AppState): boolean {
        try {
            // spec.md 5.9節の保存条件を満たさないデータは保存しない
            if (!validateAppStateForSave(state)) {
                return false;
            }

            // AppStateは保存対象だけを持つ。DateはJSON.stringifyによってISO 8601形式になり、
            // クラスのメソッドはJSONに含まれない。
            const json = JSON.stringify(state);
            // localStorageに書き込む
            localStorage.setItem(STORAGE_KEY, json);
            return true;
        } catch {
            // 容量超過などで書き込みに失敗した場合はfalseを返す
            return false;
        }
    }

    // localStorageからアプリの状態を読み込む
    public static load(): RestoreResult {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            // 保存データが存在しない場合は初期状態で起動する（保存データは触らない）
            if (raw === null) {
                return { success: false, state: null, errorMessage: null };
            }

            // JSON文字列をオブジェクトに変換する。この時点では信頼できない値として扱う。
            const parsed: unknown = JSON.parse(raw);

            if (
                typeof parsed === "object" &&
                parsed !== null &&
                "version" in parsed &&
                parsed.version !== STORAGE_FORMAT_VERSION
            ) {
                return { success: false, state: null, errorMessage: "未知のバージョンです" };
            }

            // コンストラクタで初期値を補う前に、生の保存データの必須項目・型・参照を検証する。
            // これにより、欠落したtasksや日時などを正常な値として復元しない。
            if (!validateAppStateForSave(parsed)) {
                return { success: false, state: null, errorMessage: "保存データの形式が不正です" };
            }

            // 生のObjectからそれぞれのクラスのインスタンスへコンストラクタを用いて復元する
            const storedState = parsed as StoredAppState;
            const canvases = storedState.canvases.map(LocalStorageService.restoreCanvas);
            const viewSettings = LocalStorageService.restoreViewSettings(storedState.viewSettings);
            const state = new AppState(
                storedState.version,
                canvases,
                storedState.currentCanvasId,
                viewSettings
            );

            return { success: true, state, errorMessage: null };
        } catch (e) {
            // JSONパース失敗など予期しないエラーが起きても保存データは上書きせず、エラーを返す
            return {
                success: false,
                state: null,
                errorMessage: `復元に失敗しました: ${e instanceof Error ? e.message : String(e)}`
            };
        }
    }

    // 生のTaskオブジェクトからTaskクラスのインスタンスを復元する
    private static restoreTask(raw: StoredTask): Task {
        const task = new Task(raw.id, raw.title, raw.description, raw.status, raw.x, raw.y);
        task.createdAt = new Date(raw.createdAt);
        task.updatedAt = new Date(raw.updatedAt);
        return task;
    }

    // 生のConnectionオブジェクトからConnectionクラスのインスタンスを復元する
    private static restoreConnection(raw: StoredConnection): Connection {
        const connection = new Connection(raw.id, raw.parentTaskId, raw.childTaskId);
        connection.createdAt = new Date(raw.createdAt);
        return connection;
    }

    // 生のCanvasオブジェクトからCanvasクラスのインスタンスを復元する（tasks/connectionsも再帰的に復元する）
    private static restoreCanvas(raw: StoredCanvas): Canvas {
        const canvas = new Canvas(raw.id, raw.title, raw.x, raw.y);
        canvas.tasks = raw.tasks.map(LocalStorageService.restoreTask);
        canvas.connections = raw.connections.map(LocalStorageService.restoreConnection);
        canvas.createdAt = new Date(raw.createdAt);
        canvas.updatedAt = new Date(raw.updatedAt);
        return canvas;
    }

    // 生のViewSettingsオブジェクトからViewSettingsクラスのインスタンスを復元する
    // （ViewSettingsは引数なしコンストラクタのため、生成後にプロパティを詰め替える）
    private static restoreViewSettings(raw: StoredViewSettings): ViewSettings {
        const viewSettings = new ViewSettings();
        viewSettings.searchText = raw.searchText;
        viewSettings.statusFilter = raw.statusFilter;
        viewSettings.depthFilterEnabled = raw.depthFilterEnabled;
        viewSettings.depthBaseTaskId = raw.depthBaseTaskId;
        viewSettings.maxDepth = raw.maxDepth;
        return viewSettings;
    }
}
