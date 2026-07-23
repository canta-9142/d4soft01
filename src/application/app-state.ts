import { Canvas } from "../domain/canvas.js";
import { ViewSettings } from "../domain/view-settings.js";

export class AppState {
    version: string;
    canvases: Array<Canvas>;
    currentCanvasId: string | null;
    viewSettings: ViewSettings;

    constructor(
        version: string = "1",
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
