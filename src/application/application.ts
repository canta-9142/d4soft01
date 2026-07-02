import { AppMode, TaskStatus } from "../domain/enums";
import { Task } from "../domain/task";
import { Connection } from "../domain/connection";
import { Canvas } from "../domain/canvas";
import { ViewSettings } from "../domain/view-settings";
import { ClipboardState } from "./clipboard-state";
import { HistoryEntry, HistoryManager } from "../history/history-manager";
import { FilterService } from "../services/filter-service"
import { LocalStorageService } from "../services/local-storage-service";

export class AppState {
    version: string = "";
    canvases = new Array<Canvas>();
    currentCanvasId: string = "";
    viewSettings = new ViewSettings();
}

export class Application {
    mode = AppMode.NORMAL;
    state = new AppState();
    currentCanvas: Canvas | null = null;
    currentTask: Task | null = null;
    currentConnection: Connection | null = null;
    connectionParentTaskId: string | null = null;
    clipboardState = new ClipboardState();
    historyManager = new HistoryManager();
    isDirty: boolean = false;

    public setMode = (mode: AppMode): void => {
    }
    public createCanvas = (canvas: Canvas): boolean => {
    }
    public removeCanvas = (canvasId: string): boolean => {
    }
    public updateCanvasTitle = (canvasId: string, title: string): boolean => {
    }
    public updateCanvasPosisiton = (canvasId: string, x: number, y: number): boolean => {
    }
    public changeCanvas = (canvasId: string): boolean => {
    }

    public createTask = (task: Task): boolean => {
    }
    public updateTaskTitle = (taskId: string, title: string): boolean => {
    }
    public updateTaskDescription = (taskId: string, description: string): boolean => {
    }
    public updateTaskStatus = (taskId: string, status: TaskStatus): boolean => {
    }
    public updateTaskPosition = (taskId: string, x: number, y: number): boolean => {
    }
    public removeTask = (taskId: string): boolean => {
    }

    public createConnection = (connection: Connection): boolean => {
    }
    public removeConnection = (connectionId: string): boolean => {
    }

    public copyTaskToClipboard = (taskId: string): boolean => {
    }
    public pasteTask = (): boolean => {
    }

    public undo = (): boolean => {
        let result = this.historyManager.undo();
        if (result) return true;
        return false;
    }
    public redo = (): boolean => {
        let result = this.historyManager.redo();
        if (result) return true;
        return false;
    }

    public updateSearchText = (searchText: string): void => {
    }
    public updateStatusFilter = (status: TaskStatus | null): boolean => {
    }

    public setDepthFilter = (baseTaskId: string | null, maxDepth: number): boolean => {
    }
    public clearDepthFilter = (): void => {
    }

    public updateViewSettings = (viewSettings: ViewSettings): void => {
    }

    public save = (): boolean => {
        let result = LocalStorageService.save(this.state);
        if (result) {
            this.isDirty = false;
            return true;
        }
        return false;
    }
    public restore = (): boolean => {
        let result = LocalStorageService.load();
        if (result.success && result.state) {
            this.state = result.state;
            this.currentCanvas = this.state.canvases.find(c => c.id === this.state.currentCanvasId) || null;
            this.isDirty = false;
            return true;
        }
        return false;
    }
}
