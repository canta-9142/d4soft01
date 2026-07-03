import { AppState } from "../application/application";

const STORAGE_KEY = "d4soft01.totoCanvas.state";

export type RestoreResult = {
    success: boolean;
    state: AppState | null;
    errorMessage: string | null;
};

export class LocalStorageService {
    private constructor() {}

    public static save(state: AppState): boolean {

    }

    public static load(): RestoreResult {

    }
}