import type { Canvas } from "../domain/canvas.js";
import { ViewSettings } from "../domain/view-settings.js";

export const APP_STATE_VERSION = "1";

export class AppState {
    version: typeof APP_STATE_VERSION;
    canvases: Array<Canvas>;
    currentCanvasId: string | null;
    viewSettings: ViewSettings;

    constructor(
        version: typeof APP_STATE_VERSION = APP_STATE_VERSION,
        canvases: Array<Canvas> = [],
        currentCanvasId: string | null = null,
        viewSettings: ViewSettings = new ViewSettings(),
    ) {
        this.version = version;
        this.canvases = canvases;
        this.currentCanvasId = currentCanvasId;
        this.viewSettings = viewSettings;
    }
}
