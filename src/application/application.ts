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
    mode:AppMode = AppMode.NORMAL;
    state = new AppState();
    currentCanvas: Canvas | null = null;
    currentTask: Task | null = null;
    currentConnection: Connection | null = null;
    connectionParentTaskId: string | null = null;
    clipboardState = new ClipboardState();
    historyManager = new HistoryManager();
    isDirty: boolean = false;

    // Utils
    private canvasById = (canvasId: string): Canvas | undefined => {
        return this.state.canvases.find(canvas => canvas.id === canvasId);
    }
    private canvasByTaskId = (taskId: string): Canvas | undefined => {
        return this.state.canvases.find(canvas => {
            canvas.tasks.find(task => task.id === taskId);
        });
    }
    private taskById = (taskId: string): Task | undefined => {
        this.state.canvases.find(canvas => {
            return canvas.tasks.find(task => task.id === taskId);
        });
        return undefined;
    }

    // Public methods
    public setMode = (mode: AppMode): void => {
        this.mode = mode;
    }

    // Canvas manipulation
    public createCanvas = (canvas: Canvas): boolean => {
        try {
            this.state.canvases.push(new Canvas());
        } catch (e) {
            console.error("Canvasの追加に失敗しました。", e);
            return false;
        }
        return true;
    }
    public removeCanvas = (canvasId: string): boolean => {
        try {
            this.state.canvases = this.state.canvases.filter(canvas => canvas.id !== canvasId);
        } catch (e) {
            console.error("Canvasを削除できませんでした。", e);
            return false;
        }
        return true;
    }
    public updateCanvasTitle = (canvasId: string, title: string): boolean => {
        try {
            this.canvasById(canvasId)?.updateTitle(title);
        } catch (e) {
            console.error("タイトルを変更できませんでした。", e);
            return false;
        }
        return true;
    }
    public updateCanvasPosisiton = (canvasId: string, x: number, y: number): boolean => {
        try {
            this.canvasById(canvasId)?.updatePosition(x, y);
        } catch (e) {
            console.error("エラーが発生しました。", e);
            return false;
        }
        return true;
    }
    public changeCanvas = (canvasId: string): boolean => {
        let id: string | undefined;
        try {
            id = this.canvasById(canvasId)?.id;
        } catch (e) {
            console.error("選択したCanvasは存在しません。", e);
            return false;
        }
        if (!id) return false;
        this.state.currentCanvasId = id;
        return true;
    }

    // Tasks manipulation
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

    // Undo and Redo
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

    // Searching and Filters
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

    // Save and Restore
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
