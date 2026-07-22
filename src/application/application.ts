import { AppMode, TaskStatus } from "../domain/enums.js";
import { Task } from "../domain/task.js";
import { Connection } from "../domain/connection.js";
import { Canvas } from "../domain/canvas.js";
import { ViewSettings } from "../domain/view-settings.js";
import {
    findCanvasByConnectionId,
    findCanvasById,
    findCanvasByTaskId,
    findTaskById,
} from "../domain/entity-finders.js";
import { ClipboardState } from "./clipboard-state.js";
import { HistoryManager } from "../history/history-manager.js";

export class AppState {
    version: string;
    canvases: Array<Canvas>;
    currentCanvasId: string;
    viewSettings: ViewSettings;

    constructor(canvases: Array<Canvas> = [], currentCanvasId: string = "", viewSettings: ViewSettings = new ViewSettings()) {
        this.version = "1";
        this.canvases = canvases;
        this.currentCanvasId = currentCanvasId;
        this.viewSettings = viewSettings;
    }
}

export class Application {
    mode:AppMode = AppMode.NORMAL;
    state = new AppState();
    currentTaskId: string | null = null;
    currentConnectionId: string | null = null;
    connectionParentTaskId: string | null = null;
    clipboardState = new ClipboardState();
    historyManager = new HistoryManager();
    isDirty: boolean = false;

    private generateCanvasId(): string {
        return "canvas-" + this.generateDateString() + "-" + Math.random().toString(36).slice(-8);
    }
    private generateTaskId(): string {
        return "task-" + this.generateDateString() + "-" + Math.random().toString(36).slice(-8);
    }
    private generateConnectionId(): string {
        return "connection-" + this.generateDateString() + "-" + Math.random().toString(36).slice(-8);
    }
    private generateDateString(): string {
        const date = new Date();
        return "" + date.getFullYear() + date.getMonth() + date.getDate() + date.getHours() + date.getMinutes() + date.getSeconds() + date.getMilliseconds();
    }

    // Public methods
    public setMode = (mode: AppMode): void => {
        this.mode = mode;
        if (mode !== AppMode.CONNECT) {
            this.connectionParentTaskId = null;
        }
    }

    public getCurrentCanvas = (): Canvas | undefined => {
        return findCanvasById(this.state.canvases, this.state.currentCanvasId);
    }

    public getTask = (taskId: string): Task | undefined => {
        return findTaskById(this.state.canvases, taskId);
    }

    // Canvas manipulation
    public createCanvas = (title: string = "新しいキャンバス"): void => {
        const normalizedTitle = title.trim() || "新しいキャンバス";
        const canvas = new Canvas(this.generateCanvasId(), normalizedTitle);
        this.state.canvases.push(canvas);
        this.state.currentCanvasId = canvas.id;
        this.currentTaskId = null;
        this.currentConnectionId = null;
        this.connectionParentTaskId = null;
        this.mode = AppMode.NORMAL;
        this.isDirty = true;
    }
    public removeCanvas = (canvasId: string): boolean => {
        const index = this.state.canvases.findIndex(canvas => canvas.id === canvasId);
        if (index < 0) return false;
        this.state.canvases.splice(index, 1);
        if (this.state.currentCanvasId === canvasId) {
            this.state.currentCanvasId = this.state.canvases[index]?.id
                ?? this.state.canvases[index - 1]?.id
                ?? "";
        }
        this.currentTaskId = null;
        this.currentConnectionId = null;
        this.connectionParentTaskId = null;
        this.mode = AppMode.NORMAL;
        this.isDirty = true;
        return true;
    }
    public updateCanvasTitle = (canvasId: string, title: string): boolean => {
        const canvas = findCanvasById(this.state.canvases, canvasId);
        const normalizedTitle = title.trim();
        if (!canvas || !normalizedTitle) return false;
        canvas.updateTitle(normalizedTitle);
        this.isDirty = true;
        return true;
    }
    public updateCanvasPosisiton = (canvasId: string, x: number, y: number): boolean => {
        const canvas = findCanvasById(this.state.canvases, canvasId);
        if (!canvas || !Number.isFinite(x) || !Number.isFinite(y)) return false;
        canvas.updatePosition(x, y);
        this.isDirty = true;
        return true;
    }
    public updateCanvasPosition = this.updateCanvasPosisiton;
    public changeCanvas = (canvasId: string): boolean => {
        const id = findCanvasById(this.state.canvases, canvasId)?.id;
        if (!id) return false;
        this.state.currentCanvasId = id;
        this.currentTaskId = null;
        this.currentConnectionId = null;
        this.connectionParentTaskId = null;
        this.mode = AppMode.NORMAL;
        return true;
    }

    // Tasks manipulation
    public createTask = (): boolean => {
        return this.createTaskAt("新しいタスク", "", TaskStatus.NOTSTARTED, 40, 40) !== null;
    }
    public createTaskAt = (title: string, description: string, status: TaskStatus, x: number, y: number): string | null => {
        const canvas = findCanvasById(this.state.canvases, this.state.currentCanvasId);
        const normalizedTitle = title.trim();
        if (!canvas || !normalizedTitle || !Number.isFinite(x) || !Number.isFinite(y)) return null;
        const task = new Task(this.generateTaskId(), normalizedTitle, description, status, x, y);
        canvas.tasks.push(task);
        this.currentTaskId = task.id;
        this.currentConnectionId = null;
        this.isDirty = true;
        return task.id;
    }
    public updateTaskTitle = (taskId: string, title: string): boolean => {
        const task = findTaskById(this.state.canvases, taskId);
        const normalizedTitle = title.trim();
        if (!task || !normalizedTitle) return false;
        task.updateTitle(normalizedTitle);
        this.isDirty = true;
        return true;
    }
    public updateTaskDescription = (taskId: string, description: string): boolean => {
        const task = findTaskById(this.state.canvases, taskId);
        if (!task) return false;
        task.updateDescription(description);
        this.isDirty = true;
        return true;
    }
    public updateTaskStatus = (taskId: string, status: TaskStatus): boolean => {
        const task = findTaskById(this.state.canvases, taskId);
        if (!task) return false;
        task.updateStatus(status);
        this.isDirty = true;
        return true;
    }
    public updateTaskPosition = (taskId: string, x: number, y: number): boolean => {
        const task = findTaskById(this.state.canvases, taskId);
        if (!task || !Number.isFinite(x) || !Number.isFinite(y)) return false;
        task.updatePosition(x, y);
        this.isDirty = true;
        return true;
    }
    public removeTask = (taskId: string): boolean => {
        const canvas = findCanvasByTaskId(this.state.canvases, taskId);
        if (!canvas) return false;
        canvas.tasks = canvas.tasks.filter(task => task.id !== taskId);
        canvas.connections = canvas.connections.filter(connection =>
            connection.parentTaskId !== taskId && connection.childTaskId !== taskId
        );
        if (this.currentTaskId === taskId) this.currentTaskId = null;
        if (this.connectionParentTaskId === taskId) this.connectionParentTaskId = null;
        this.currentConnectionId = null;
        this.isDirty = true;
        return true;
    }

    public createConnection = (parentTaskId: string, childTaskId: string): boolean => {
        const canvas = findCanvasById(this.state.canvases, this.state.currentCanvasId);
        if (!canvas) return false;
        if (parentTaskId === childTaskId) return false;
        const taskIds = new Set(canvas.tasks.map(task => task.id));
        if (!taskIds.has(parentTaskId) || !taskIds.has(childTaskId)) return false;
        const duplicated = canvas.connections.some(connection =>
            connection.parentTaskId === parentTaskId && connection.childTaskId === childTaskId
        );
        if (duplicated) return false;
        canvas.connections.push(new Connection(this.generateConnectionId(), parentTaskId, childTaskId));
        this.isDirty = true;
        return true;
    }

    public removeConnection = (connectionId: string): boolean => {
        const canvas = findCanvasByConnectionId(this.state.canvases, connectionId);
        if (!canvas) return false;
        canvas.connections = canvas.connections.filter(connection => connection.id !== connectionId);
        if (this.currentConnectionId === connectionId) this.currentConnectionId = null;
        this.isDirty = true;
        return true;
    }

    public copyTaskToClipboard = (taskId: string): boolean => {
        const task = findTaskById(this.state.canvases, taskId);
        if (!task) return false;
        this.clipboardState.sourceTask = task;
        return true;
    }
    public pasteTask = (): boolean => {
        const sourceTask = this.clipboardState.sourceTask;
        if (!sourceTask) return false;
        const canvas = findCanvasById(this.state.canvases, this.state.currentCanvasId);
        if (!canvas) return false;
        const newTask = new Task(this.generateTaskId());
        newTask.title = sourceTask.title;
        newTask.description = sourceTask.description;
        newTask.status = sourceTask.status;
        newTask.x = sourceTask.x + 10; // Offset to avoid overlap
        newTask.y = sourceTask.y + 10; // Offset to avoid overlap
        canvas.tasks.push(newTask);
        return true;
    }

    // Undo and Redo
    public undo = (): boolean => {
        let result = this.historyManager.undo();
        if (!result) return false;
        return true;
    }
    public redo = (): boolean => {
        let result = this.historyManager.redo();
        if (!result) return false;
        return true;
    }

    // Searching and Filters
    public updateSearchText = (searchText: string): void => {
        this.state.viewSettings.searchText = searchText;
    }
    public updateStatusFilter = (status: TaskStatus | null): void => {
        this.state.viewSettings.statusFilter = status;
    }

    public setDepthFilter = (baseTaskId: string | null, maxDepth: number): void => {
        this.state.viewSettings.depthFilterEnabled = true;
        this.state.viewSettings.depthBaseTaskId = baseTaskId;
        this.state.viewSettings.maxDepth = maxDepth;
    }
    public clearDepthFilter = (): void => {
        this.state.viewSettings.depthFilterEnabled = false;
    }

    // 保存・復元は今回の実装範囲外。LocalStorageService の実装時に戻す。
    // public save = (): boolean => { ... }
    // public restore = (): boolean => { ... }
}
