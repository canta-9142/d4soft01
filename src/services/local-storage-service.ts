import { AppState } from "../application/app-state.js";
import {
    createCanvasSnapshot,
    restoreCanvasSnapshot,
} from "../domain/entity-snapshots.js";
import { ViewSettings } from "../domain/view-settings.js";
import {
    APP_STATE_VERSION,
    type StoredAppState,
    validateStoredAppState,
} from "../validation/validators.js";

export const STORAGE_KEY = "d4soft01.todoCanvas.state";

export type RestoreResult = {
    success: boolean;
    state: AppState | null;
    errorMessage: string | null;
};

export class LocalStorageService {
    private constructor() {}

    public static save(state: AppState): boolean {
        try {
            const storedState = LocalStorageService.serialize(state);
            const validation = validateStoredAppState(storedState);
            if (!validation.valid) return false;
            const storage = LocalStorageService.storage();
            if (!storage) return false;
            storage.setItem(STORAGE_KEY, JSON.stringify(validation.value));
            return true;
        } catch {
            return false;
        }
    }

    public static load(): RestoreResult {
        const storage = LocalStorageService.storage();
        if (!storage) {
            return { success: false, state: null, errorMessage: null };
        }

        let text: string | null;
        try {
            text = storage.getItem(STORAGE_KEY);
        } catch {
            return { success: false, state: null, errorMessage: "保存データを読み込めませんでした" };
        }
        if (text === null) {
            return { success: false, state: null, errorMessage: null };
        }

        try {
            const validation = validateStoredAppState(JSON.parse(text) as unknown);
            if (!validation.valid) {
                return { success: false, state: null, errorMessage: validation.errorMessage };
            }
            return {
                success: true,
                state: LocalStorageService.restoreState(validation.value),
                errorMessage: null,
            };
        } catch {
            return { success: false, state: null, errorMessage: "保存データがJSON形式ではありません" };
        }
    }

    private static storage(): Storage | null {
        try {
            return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
        } catch {
            return null;
        }
    }

    private static serialize(state: AppState): StoredAppState {
        return {
            version: APP_STATE_VERSION,
            currentCanvasId: state.currentCanvasId,
            canvases: state.canvases.map(createCanvasSnapshot),
            viewSettings: {
                searchText: state.viewSettings.searchText,
                statusFilter: state.viewSettings.statusFilter,
                depthFilterEnabled: state.viewSettings.depthFilterEnabled,
                depthBaseTaskId: state.viewSettings.depthBaseTaskId,
                maxDepth: state.viewSettings.maxDepth,
            },
        };
    }

    private static restoreState(value: StoredAppState): AppState {
        const viewSettings = Object.assign(new ViewSettings(), {
            searchText: value.viewSettings.searchText,
            statusFilter: value.viewSettings.statusFilter,
            depthFilterEnabled: value.viewSettings.depthFilterEnabled,
            depthBaseTaskId: value.viewSettings.depthBaseTaskId,
            maxDepth: value.viewSettings.maxDepth,
        });
        return new AppState(
            APP_STATE_VERSION,
            value.canvases.map(restoreCanvasSnapshot),
            value.currentCanvasId,
            viewSettings,
        );
    }
}
