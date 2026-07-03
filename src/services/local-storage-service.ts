import { AppState } from "../application/application";

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
                try {
                                // AppStateをJSON文字列に変換する。DateはISO 8601形式の文字列に変換する
                    const json = JSON.stringify(state, (_key, value) => {
                                        if (value instanceof Date) return value.toISOString();
                                        return value;
                    });
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

                    // JSON文字列をオブジェクトに変換する
                    const parsed = JSON.parse(raw);

                    // バージョンが"1"以外は未知の形式として復元失敗にする
                    if (parsed.version !== "1") {
                                        return { success: false, state: null, errorMessage: "未知のバージョンです" };
                    }

                    // canvasesが配列でない、またはviewSettingsがない場合は形式不正として復元失敗にする
                    if (!Array.isArray(parsed.canvases) || parsed.viewSettings == null) {
                                        return { success: false, state: null, errorMessage: "保存データの形式が不正です" };
                    }

                    // AppStateに復元したデータを詰め替える
                    const state = new AppState();
                                state.version = parsed.version;
                                state.currentCanvasId = parsed.currentCanvasId ?? null;
                                state.canvases = parsed.canvases;
                                state.viewSettings = parsed.viewSettings;

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
}
