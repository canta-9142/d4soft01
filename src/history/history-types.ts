import type { Canvas } from "../domain/canvas.js";
import type { Connection } from "../domain/connection.js";
import type { TaskStatus } from "../domain/enums.js";
import type { Task } from "../domain/task.js";
import type { ViewSettings } from "../domain/view-settings.js";

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
    status: TaskStatus;
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
    statusFilter: TaskStatus | null;
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

export interface HistoryTarget {
    state: {
        canvases: Array<Canvas>;
        currentCanvasId: string;
        viewSettings: ViewSettings;
    };
    currentTaskId: string | null;
    currentConnectionId: string | null;
    connectionParentTaskId: string | null;
}

export const createTaskSnapshot = (task: Task): TaskSnapshot => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    x: task.x,
    y: task.y,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
});

export const createConnectionSnapshot = (connection: Connection): ConnectionSnapshot => ({
    id: connection.id,
    parentTaskId: connection.parentTaskId,
    childTaskId: connection.childTaskId,
    createdAt: connection.createdAt.toISOString(),
});

export const createCanvasSnapshot = (canvas: Canvas): CanvasSnapshot => ({
    id: canvas.id,
    title: canvas.title,
    tasks: canvas.tasks.map(createTaskSnapshot),
    connections: canvas.connections.map(createConnectionSnapshot),
    x: canvas.x,
    y: canvas.y,
    createdAt: canvas.createdAt.toISOString(),
    updatedAt: canvas.updatedAt.toISOString(),
});

export const createSelectionSnapshot = (target: HistoryTarget): SelectionSnapshot => ({
    currentTaskId: target.currentTaskId,
    currentConnectionId: target.currentConnectionId,
    connectionParentTaskId: target.connectionParentTaskId,
});

export const createDepthFilterSnapshot = (viewSettings: ViewSettings): DepthFilterSnapshot => ({
    depthFilterEnabled: viewSettings.depthFilterEnabled,
    depthBaseTaskId: viewSettings.depthBaseTaskId,
    maxDepth: viewSettings.maxDepth,
});

export const createViewSettingsSnapshot = (viewSettings: ViewSettings): ViewSettingsSnapshot => ({
    searchText: viewSettings.searchText,
    statusFilter: viewSettings.statusFilter,
    ...createDepthFilterSnapshot(viewSettings),
});

export const createCanvasContextSnapshot = (target: HistoryTarget): CanvasContextSnapshot => ({
    currentCanvasId: target.state.currentCanvasId,
    selection: createSelectionSnapshot(target),
    viewSettings: createViewSettingsSnapshot(target.state.viewSettings),
});
