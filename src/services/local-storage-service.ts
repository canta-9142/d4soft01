import { AppState } from "../application/application.js";

const STORAGE_KEY = "d4soft01.totoCanvas.state";

export type RestoreResult = {
    success: boolean;
    state: AppState | null;
    errorMessage: string | null;
};

export class LocalStorageService {
    private constructor() {}

    // 保存・復元機能は今回の実装範囲外。
    // public static save(state: AppState): boolean { ... }
    // public static load(): RestoreResult { ... }
}
