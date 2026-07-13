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
    private canvasByConnectionId = (connectionId: string): Canvas | undefined => {
        return this.state.canvases.find(canvas => {
            canvas.connections.find(connection => connection.id === connectionId);
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
    public createCanvas = (): void => {
        this.state.canvases.push(new Canvas());
    }
    public removeCanvas = (canvasId: string): boolean => {
        const canvases = this.state.canvases.filter(canvas => canvas.id !== canvasId);
        if (!canvases) return false;
        this.state.canvases = canvases;
        return true;
    }
    public updateCanvasTitle = (canvasId: string, title: string): boolean => {
        const canvas = this.canvasById(canvasId);
        if (!canvas) return false;
        canvas.updateTitle(title);
        return true;
    }
    public updateCanvasPosisiton = (canvasId: string, x: number, y: number): boolean => {
        const canvas = this.canvasById(canvasId);
        if (!canvas) return false;
        canvas.updatePosition(x, y);
        return true;
    }
    public changeCanvas = (canvasId: string): boolean => {
        const id = this.canvasById(canvasId)?.id;
        if (!id) return false;
        this.state.currentCanvasId = id;
        return true;
    }

    // Tasks manipulation
    public createTask = (): boolean => {
        const canvas = this.canvasById(this.state.currentCanvasId);
        if (!canvas) return false;
        canvas.tasks.push(new Task());
        return true;
    }
    public updateTaskTitle = (taskId: string, title: string): boolean => {
        const task = this.taskById(taskId);
        if (!task) return false;
        task.updateTitle(title);
        return true;
    }
    public updateTaskDescription = (taskId: string, description: string): boolean => {
        const task = this.taskById(taskId);
        if (!task) return false;
        task.updateDescription(description);
        return true;
    }
    public updateTaskStatus = (taskId: string, status: TaskStatus): boolean => {
        const task = this.taskById(taskId);
        if (!task) return false;
        task.updateStatus(status);
        return true;
    }
    public updateTaskPosition = (taskId: string, x: number, y: number): boolean => {
        const task = this.taskById(taskId);
        if (!task) return false;
        task.updatePosition(x, y);
        return true;
    }
    public removeTask = (taskId: string): boolean => {
        const canvas = this.canvasByTaskId(taskId);
        if (!canvas) return false;
        const tasks = canvas.tasks.filter(task => task.id !== taskId);
        if (!tasks) return false;
        canvas.tasks = tasks;
        return true;
    }

    public createConnection = (): boolean => {
        const canvas = this.canvasById(this.state.currentCanvasId);
        if (!canvas) return false;
        canvas.connections.push(new Connection());
        return true;
    }
    public removeConnection = (connectionId: string): boolean => {
        const canvas = this.canvasByConnectionId(connectionId);
        if (!canvas) return false;
        const connections = canvas.connections.filter(connection => connection.id !== connectionId);
        if (!connections) return false;
        canvas.connections = connections;
        return true;
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
