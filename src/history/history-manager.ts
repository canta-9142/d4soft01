export const MAX_HISTORY_ENTRIES = 50;

export enum HistoryOperationType {
    TaskCreate = "task-create",
    TaskEdit = "task-edit",
    TaskMove = "task-move",
    TaskDelete = "task-delete",
    ConnectionCreate = "connection-create",
    ConnectionDelete = "connection-delete",
    TaskPaste = "task-paste",
    CanvasDelete = "canvas-delete",
}

export type TaskSnapshot = Readonly<{
    id: string;
    title: string;
    description: string;
    status: string;
    x: number;
    y: number;
    createdAt: string;
    updatedAt: string;
}>;

export type ConnectionSnapshot = Readonly<{
    id: string;
    parentTaskId: string;
    childTaskId: string;
    createdAt: string;
}>;

export type CanvasSnapshot = Readonly<{
    id: string;
    title: string;
    tasks: ReadonlyArray<TaskSnapshot>;
    connections: ReadonlyArray<ConnectionSnapshot>;
    x: number;
    y: number;
    createdAt: string;
    updatedAt: string;
}>;

export type SelectionSnapshot = Readonly<{
    currentTaskId: string | null;
    currentConnectionId: string | null;
    connectionParentTaskId: string | null;
}>;

export type DepthFilterSnapshot = Readonly<{
    depthFilterEnabled: boolean;
    depthBaseTaskId: string | null;
    maxDepth: number;
}>;

export type ViewSettingsSnapshot = Readonly<{
    searchText: string;
    statusFilter: string | null;
    depthFilterEnabled: boolean;
    depthBaseTaskId: string | null;
    maxDepth: number;
}>;

export type CanvasContextSnapshot = Readonly<{
    currentCanvasId: string;
    selection: SelectionSnapshot;
    viewSettings: ViewSettingsSnapshot;
}>;

export type IndexedConnectionSnapshot = Readonly<{
    connection: ConnectionSnapshot;
    index: number;
}>;

interface HistoryChangeBase {
    readonly type: HistoryOperationType;
    readonly canvasId: string;
    readonly targetId: string;
}

export interface TaskCreateHistoryChange extends HistoryChangeBase {
    readonly type: HistoryOperationType.TaskCreate;
    readonly task: TaskSnapshot;
    readonly taskIndex: number;
    readonly previousSelection: SelectionSnapshot;
    readonly nextSelection: SelectionSnapshot;
}

export interface TaskPasteHistoryChange extends HistoryChangeBase {
    readonly type: HistoryOperationType.TaskPaste;
    readonly task: TaskSnapshot;
    readonly taskIndex: number;
    readonly previousSelection: SelectionSnapshot;
    readonly nextSelection: SelectionSnapshot;
}

export interface TaskEditHistoryChange extends HistoryChangeBase {
    readonly type: HistoryOperationType.TaskEdit;
    readonly previousTask: TaskSnapshot;
    readonly nextTask: TaskSnapshot;
}

export interface TaskMoveHistoryChange extends HistoryChangeBase {
    readonly type: HistoryOperationType.TaskMove;
    readonly previousTask: TaskSnapshot;
    readonly nextTask: TaskSnapshot;
}

export interface TaskDeleteHistoryChange extends HistoryChangeBase {
    readonly type: HistoryOperationType.TaskDelete;
    readonly task: TaskSnapshot;
    readonly taskIndex: number;
    readonly removedConnections: ReadonlyArray<IndexedConnectionSnapshot>;
    readonly previousSelection: SelectionSnapshot;
    readonly nextSelection: SelectionSnapshot;
    readonly previousDepthFilter: DepthFilterSnapshot;
    readonly nextDepthFilter: DepthFilterSnapshot;
}

export interface ConnectionCreateHistoryChange extends HistoryChangeBase {
    readonly type: HistoryOperationType.ConnectionCreate;
    readonly connection: ConnectionSnapshot;
    readonly connectionIndex: number;
}

export interface ConnectionDeleteHistoryChange extends HistoryChangeBase {
    readonly type: HistoryOperationType.ConnectionDelete;
    readonly connection: ConnectionSnapshot;
    readonly connectionIndex: number;
    readonly previousSelection: SelectionSnapshot;
    readonly nextSelection: SelectionSnapshot;
}

export interface CanvasDeleteHistoryChange extends HistoryChangeBase {
    readonly type: HistoryOperationType.CanvasDelete;
    readonly canvas: CanvasSnapshot;
    readonly canvasIndex: number;
    readonly previousCanvasContext: CanvasContextSnapshot;
    readonly nextCanvasContext: CanvasContextSnapshot;
}

export type HistoryChange =
    | TaskCreateHistoryChange
    | TaskPasteHistoryChange
    | TaskEditHistoryChange
    | TaskMoveHistoryChange
    | TaskDeleteHistoryChange
    | ConnectionCreateHistoryChange
    | ConnectionDeleteHistoryChange
    | CanvasDeleteHistoryChange;

export class HistoryEntry<TChange extends HistoryChange> {
    public readonly change: TChange;
    public readonly createdAt: string;

    constructor(change: TChange, createdAt: string = new Date().toISOString()) {
        this.change = structuredClone(change) as TChange;
        this.createdAt = createdAt;
    }

    public get operationType(): HistoryOperationType {
        return this.change.type;
    }

    public get canvasId(): string {
        return this.change.canvasId;
    }

    public get targetId(): string {
        return this.change.targetId;
    }
}

export class HistoryManager {
    private readonly undoStack: Array<HistoryEntry<HistoryChange>> = [];
    private readonly redoStack: Array<HistoryEntry<HistoryChange>> = [];

    public record(entry: HistoryEntry<HistoryChange>): void {
        this.undoStack.push(entry);

        if (this.undoStack.length > MAX_HISTORY_ENTRIES) {
            this.undoStack.shift();
        }

        this.redoStack.length = 0;
    }

    public undo(): HistoryEntry<HistoryChange> | null {
        const entry = this.undoStack.pop() ?? null;
        if (entry) {
            this.redoStack.push(entry);
        }
        return entry;
    }

    public redo(): HistoryEntry<HistoryChange> | null {
        const entry = this.redoStack.pop() ?? null;
        if (entry) {
            this.undoStack.push(entry);
        }
        return entry;
    }

    public canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    public canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    public clear(): void {
        this.undoStack.length = 0;
        this.redoStack.length = 0;
    }
}
