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
import {
    createCanvasContextSnapshot,
    createCanvasSnapshot,
    createConnectionSnapshot,
    createDepthFilterSnapshot,
    createSelectionSnapshot,
    createTaskSnapshot,
    HistoryManager,
    HistoryOperationType,
    type TaskSnapshot,
} from "../history/history-manager.js";

export class AppState {
    version: string;
    canvases: Array<Canvas>;
    currentCanvasId: string;
    viewSettings: ViewSettings;

    constructor(version: string, canvases: Array<Canvas> = [], currentCanvasId: string = "", viewSettings: ViewSettings = new ViewSettings()) {
        this.version = version;
        this.canvases = canvases;
        this.currentCanvasId = currentCanvasId;
        this.viewSettings = viewSettings;
    }
}

export class Application {
    mode:AppMode = AppMode.NORMAL;
    state = new AppState(this.generateVersionId());
    currentTaskId: string | null = null;
    currentConnectionId: string | null = null;
    connectionParentTaskId: string | null = null;
    clipboardState = new ClipboardState();
    historyManager = new HistoryManager();
    isDirty: boolean = false;
    private pendingTaskMove: Readonly<{
        canvasId: string;
        taskId: string;
        previousTask: TaskSnapshot;
    }> | null = null;

    private generateVersionId(): string {
        return "v-" + this.generateDateString() + "-" + Math.random().toString(36).slice(-8);
    }
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
        const canvas = this.state.canvases[index];
        if (!canvas) return false;
        const previousCanvasContext = createCanvasContextSnapshot(this);
        const canvasSnapshot = createCanvasSnapshot(canvas);
        const removedTaskIds = new Set(canvas.tasks.map(task => task.id));
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
        if (this.state.viewSettings.depthBaseTaskId
            && removedTaskIds.has(this.state.viewSettings.depthBaseTaskId)) {
            this.state.viewSettings.depthFilterEnabled = false;
            this.state.viewSettings.depthBaseTaskId = null;
        }
        if (this.state.canvases.length === 0) {
            this.state.viewSettings.searchText = "";
            this.state.viewSettings.statusFilter = null;
            this.state.viewSettings.depthFilterEnabled = false;
            this.state.viewSettings.depthBaseTaskId = null;
            this.state.viewSettings.maxDepth = 0;
        }
        this.isDirty = true;
        this.historyManager.record({
            type: HistoryOperationType.CanvasDelete,
            canvasId,
            targetId: canvasId,
            canvas: canvasSnapshot,
            canvasIndex: index,
            previousCanvasContext,
            nextCanvasContext: createCanvasContextSnapshot(this),
        });
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
        const previousSelection = createSelectionSnapshot(this);
        const task = new Task(this.generateTaskId(), normalizedTitle, description, status, x, y);
        canvas.tasks.push(task);
        this.currentTaskId = task.id;
        this.currentConnectionId = null;
        this.isDirty = true;
        this.historyManager.record({
            type: HistoryOperationType.TaskCreate,
            canvasId: canvas.id,
            targetId: task.id,
            task: createTaskSnapshot(task),
            taskIndex: canvas.tasks.length - 1,
            previousSelection,
            nextSelection: createSelectionSnapshot(this),
        });
        return task.id;
    }
    public updateTaskTitle = (taskId: string, title: string): boolean => {
        const canvas = findCanvasByTaskId(this.state.canvases, taskId);
        const task = canvas?.tasks.find(candidate => candidate.id === taskId);
        const normalizedTitle = title.trim();
        if (!canvas || !task || !normalizedTitle) return false;
        const previousTask = createTaskSnapshot(task);
        task.updateTitle(normalizedTitle);
        this.isDirty = true;
        this.recordTaskChange(HistoryOperationType.TaskEdit, canvas.id, previousTask, task);
        return true;
    }
    public updateTaskDescription = (taskId: string, description: string): boolean => {
        const canvas = findCanvasByTaskId(this.state.canvases, taskId);
        const task = canvas?.tasks.find(candidate => candidate.id === taskId);
        if (!canvas || !task) return false;
        const previousTask = createTaskSnapshot(task);
        task.updateDescription(description);
        this.isDirty = true;
        this.recordTaskChange(HistoryOperationType.TaskEdit, canvas.id, previousTask, task);
        return true;
    }
    public updateTaskStatus = (taskId: string, status: TaskStatus): boolean => {
        const canvas = findCanvasByTaskId(this.state.canvases, taskId);
        const task = canvas?.tasks.find(candidate => candidate.id === taskId);
        if (!canvas || !task || !Object.values(TaskStatus).includes(status)) return false;
        const previousTask = createTaskSnapshot(task);
        task.updateStatus(status);
        this.isDirty = true;
        this.recordTaskChange(HistoryOperationType.TaskEdit, canvas.id, previousTask, task);
        return true;
    }
    public updateTask = (taskId: string, title: string, description: string, status: TaskStatus): boolean => {
        const canvas = findCanvasByTaskId(this.state.canvases, taskId);
        const task = canvas?.tasks.find(candidate => candidate.id === taskId);
        const normalizedTitle = title.trim();
        if (!canvas || !task || !normalizedTitle || !Object.values(TaskStatus).includes(status)) return false;
        const previousTask = createTaskSnapshot(task);
        task.updateDetails(normalizedTitle, description, status);
        this.isDirty = true;
        this.recordTaskChange(HistoryOperationType.TaskEdit, canvas.id, previousTask, task);
        return true;
    }
    public updateTaskPosition = (taskId: string, x: number, y: number): boolean => {
        const canvas = findCanvasByTaskId(this.state.canvases, taskId);
        const task = canvas?.tasks.find(candidate => candidate.id === taskId);
        if (!canvas || !task || !Number.isFinite(x) || !Number.isFinite(y)) return false;
        const previousTask = createTaskSnapshot(task);
        task.updatePosition(x, y);
        this.isDirty = true;
        if (this.pendingTaskMove?.taskId !== taskId) {
            this.recordTaskChange(HistoryOperationType.TaskMove, canvas.id, previousTask, task);
        }
        return true;
    }
    public beginTaskMove = (taskId: string): boolean => {
        const canvas = findCanvasByTaskId(this.state.canvases, taskId);
        const task = canvas?.tasks.find(candidate => candidate.id === taskId);
        if (!canvas || !task) return false;
        this.pendingTaskMove = {
            canvasId: canvas.id,
            taskId,
            previousTask: createTaskSnapshot(task),
        };
        return true;
    }
    public finishTaskMove = (taskId: string): boolean => {
        const pending = this.pendingTaskMove;
        this.pendingTaskMove = null;
        if (!pending || pending.taskId !== taskId) return false;
        const canvas = findCanvasById(this.state.canvases, pending.canvasId);
        const task = canvas?.tasks.find(candidate => candidate.id === taskId);
        if (!canvas || !task) return false;
        if (pending.previousTask.x === task.x && pending.previousTask.y === task.y) return true;
        this.recordTaskChange(HistoryOperationType.TaskMove, canvas.id, pending.previousTask, task);
        return true;
    }
    public removeTask = (taskId: string): boolean => {
        const canvas = findCanvasByTaskId(this.state.canvases, taskId);
        if (!canvas) return false;
        const taskIndex = canvas.tasks.findIndex(task => task.id === taskId);
        const task = canvas.tasks[taskIndex];
        if (!task) return false;
        const previousSelection = createSelectionSnapshot(this);
        const previousDepthFilter = createDepthFilterSnapshot(this.state.viewSettings);
        const removedConnections = canvas.connections.flatMap((connection, index) =>
            connection.parentTaskId === taskId || connection.childTaskId === taskId
                ? [{ connection: createConnectionSnapshot(connection), index }]
                : [],
        );
        canvas.tasks = canvas.tasks.filter(task => task.id !== taskId);
        canvas.connections = canvas.connections.filter(connection =>
            connection.parentTaskId !== taskId && connection.childTaskId !== taskId
        );
        if (this.currentTaskId === taskId) this.currentTaskId = null;
        if (this.connectionParentTaskId === taskId) this.connectionParentTaskId = null;
        this.currentConnectionId = null;
        if (this.state.viewSettings.depthBaseTaskId === taskId) {
            this.state.viewSettings.depthFilterEnabled = false;
            this.state.viewSettings.depthBaseTaskId = null;
        }
        this.isDirty = true;
        this.historyManager.record({
            type: HistoryOperationType.TaskDelete,
            canvasId: canvas.id,
            targetId: taskId,
            task: createTaskSnapshot(task),
            taskIndex,
            removedConnections,
            previousSelection,
            nextSelection: createSelectionSnapshot(this),
            previousDepthFilter,
            nextDepthFilter: createDepthFilterSnapshot(this.state.viewSettings),
        });
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
        const connection = new Connection(this.generateConnectionId(), parentTaskId, childTaskId);
        canvas.connections.push(connection);
        this.isDirty = true;
        this.historyManager.record({
            type: HistoryOperationType.ConnectionCreate,
            canvasId: canvas.id,
            targetId: connection.id,
            connection: createConnectionSnapshot(connection),
            connectionIndex: canvas.connections.length - 1,
        });
        return true;
    }

    public removeConnection = (connectionId: string): boolean => {
        const canvas = findCanvasByConnectionId(this.state.canvases, connectionId);
        if (!canvas) return false;
        const connectionIndex = canvas.connections.findIndex(connection => connection.id === connectionId);
        const connection = canvas.connections[connectionIndex];
        if (!connection) return false;
        const previousSelection = createSelectionSnapshot(this);
        canvas.connections = canvas.connections.filter(connection => connection.id !== connectionId);
        if (this.currentConnectionId === connectionId) this.currentConnectionId = null;
        this.isDirty = true;
        this.historyManager.record({
            type: HistoryOperationType.ConnectionDelete,
            canvasId: canvas.id,
            targetId: connectionId,
            connection: createConnectionSnapshot(connection),
            connectionIndex,
            previousSelection,
            nextSelection: createSelectionSnapshot(this),
        });
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
        const previousSelection = createSelectionSnapshot(this);
        const newTask = new Task(this.generateTaskId());
        newTask.title = sourceTask.title;
        newTask.description = sourceTask.description;
        newTask.status = sourceTask.status;
        newTask.x = sourceTask.x + 24;
        newTask.y = sourceTask.y + 24;
        canvas.tasks.push(newTask);
        this.currentTaskId = newTask.id;
        this.currentConnectionId = null;
        this.isDirty = true;
        this.historyManager.record({
            type: HistoryOperationType.TaskPaste,
            canvasId: canvas.id,
            targetId: newTask.id,
            task: createTaskSnapshot(newTask),
            taskIndex: canvas.tasks.length - 1,
            previousSelection,
            nextSelection: createSelectionSnapshot(this),
        });
        return true;
    }

    // Undo and Redo
    public undo = (): boolean => {
        this.pendingTaskMove = null;
        const succeeded = this.historyManager.undo(this);
        if (succeeded) {
            this.isDirty = true;
        }
        return succeeded;
    }
    public redo = (): boolean => {
        this.pendingTaskMove = null;
        const succeeded = this.historyManager.redo(this);
        if (succeeded) {
            this.isDirty = true;
        }
        return succeeded;
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

    private recordTaskChange(
        type: HistoryOperationType.TaskEdit | HistoryOperationType.TaskMove,
        canvasId: string,
        previousTask: TaskSnapshot,
        task: Task,
    ): void {
        const nextTask = createTaskSnapshot(task);
        this.historyManager.record({
            type,
            canvasId,
            targetId: task.id,
            previousTask,
            nextTask,
        });
    }
}
