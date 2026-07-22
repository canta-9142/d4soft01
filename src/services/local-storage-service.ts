import { AppState } from "../application/application.js";
import { Canvas } from "../domain/canvas.js";
import { Task } from "../domain/task.js";
import { Connection } from "../domain/connection.js";
import { ViewSettings } from "../domain/view-settings.js";
import { validateAppStateForSave } from "../validation/validators.js";

// localStorageに保存するときのキー名（spec.mdで定義された名前）
const STORAGE_KEY = "d4soft01.todoCanvas.state";

// load()の戻り値の型：成功したかどうか・復元したデータ・エラー内容を持つ
export type RestoreResult = {
    success: boolean;
    state: AppState | null;
    errorMessage: string | null;
};

export class LocalStorageService {
    // new LocalStorageService() させないためのprivateコンストラクタ（staticクラスとして使う）
    private constructor() {}

    // アプリの状態をlocalStorageに保存する。成功したらtrue、失敗したらfalse
    public static save(state: AppState): boolean {
        // spec.md 5.9節の保存条件を満たさないデータは保存しない
        if (!validateAppStateForSave(state)) {
            return false;
        }

        try {
            // AppStateをJSON文字列に変換する
            // Task/Canvas/ConnectionのDateプロパティはDate.prototype.toJSON()により
            // 標準でISO 8601形式の文字列に変換されるため、独自のreplacerは不要
            const json = JSON.stringify(state);
            // localStorageに書き込む
            localStorage.setItem(STORAGE_KEY, json);
            return true;
        } catch (e) {
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

            // JSON文字列をオブジェクトに変換する（この時点ではまだ生のObject=unknown）
            const parsed = JSON.parse(raw);

            // バージョンが"1"以外は未知の形式として復元失敗にする
            if (parsed.version !== "1") {
                return { success: false, state: null, errorMessage: "未知のバージョンです" };
            }

            // canvasesが配列でない、またはviewSettingsがない場合は形式不正として復元失敗にする
            if (!Array.isArray(parsed.canvases) || parsed.viewSettings == null) {
                return { success: false, state: null, errorMessage: "保存データの形式が不正です" };
            }

            // 生のObjectからそれぞれのクラスのインスタンスへコンストラクタを用いて復元する
            const canvases = parsed.canvases.map(LocalStorageService.restoreCanvas);
            const viewSettings = LocalStorageService.restoreViewSettings(parsed.viewSettings);
            const state = new AppState(
                canvases,
                parsed.currentCanvasId ?? null,
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
    private static restoreTask(raw: any): Task {
        const task = new Task(raw.id, raw.title, raw.description, raw.status, raw.x, raw.y);
        if (raw.createdAt) task.createdAt = new Date(raw.createdAt);
        if (raw.updatedAt) task.updatedAt = new Date(raw.updatedAt);
        return task;
    }

    // 生のConnectionオブジェクトからConnectionクラスのインスタンスを復元する
    private static restoreConnection(raw: any): Connection {
        const connection = new Connection(raw.id, raw.parentTaskId, raw.childTaskId);
        if (raw.createdAt) connection.createdAt = new Date(raw.createdAt);
        return connection;
    }

    // 生のCanvasオブジェクトからCanvasクラスのインスタンスを復元する（tasks/connectionsも再帰的に復元する）
    private static restoreCanvas(raw: any): Canvas {
        const canvas = new Canvas(raw.id, raw.title, raw.x, raw.y);
        canvas.tasks = Array.isArray(raw.tasks)
            ? raw.tasks.map(LocalStorageService.restoreTask)
            : [];
        canvas.connections = Array.isArray(raw.connections)
            ? raw.connections.map(LocalStorageService.restoreConnection)
            : [];
        if (raw.createdAt) canvas.createdAt = new Date(raw.createdAt);
        if (raw.updatedAt) canvas.updatedAt = new Date(raw.updatedAt);
        return canvas;
    }

    // 生のViewSettingsオブジェクトからViewSettingsクラスのインスタンスを復元する
    // （ViewSettingsは引数なしコンストラクタのため、生成後にプロパティを詰め替える）
    private static restoreViewSettings(raw: any): ViewSettings {
        const viewSettings = new ViewSettings();
        viewSettings.searchText = raw.searchText ?? "";
        viewSettings.statusFilter = raw.statusFilter ?? null;
        viewSettings.depthFilterEnabled = raw.depthFilterEnabled ?? false;
        viewSettings.depthBaseTaskId = raw.depthBaseTaskId ?? null;
        viewSettings.maxDepth = raw.maxDepth ?? 0;
        return viewSettings;
    }
}
