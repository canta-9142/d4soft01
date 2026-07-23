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
}> & DepthFilterSnapshot;

export type CanvasContextSnapshot = Readonly<{
    currentCanvasId: string;
    selection: SelectionSnapshot;
    viewSettings: ViewSettingsSnapshot;
}>;

export type IndexedSnapshot<T> = Readonly<{ value: T; index: number }>;
export type HistoryTransition<T> = Readonly<{ before: T; after: T }>;

type HistoryChangeBase = Readonly<{
    canvasId: string;
    targetId: string;
}>;

export type TaskAdditionHistoryChange = HistoryChangeBase & Readonly<{
    type: HistoryOperationType.TaskCreate | HistoryOperationType.TaskPaste;
    task: IndexedSnapshot<TaskSnapshot>;
    selection: HistoryTransition<SelectionSnapshot>;
}>;

export type TaskUpdateHistoryChange = HistoryChangeBase & Readonly<{
    type: HistoryOperationType.TaskEdit | HistoryOperationType.TaskMove;
    task: HistoryTransition<TaskSnapshot>;
}>;

export type TaskDeleteHistoryChange = HistoryChangeBase & Readonly<{
    type: HistoryOperationType.TaskDelete;
    task: IndexedSnapshot<TaskSnapshot>;
    connections: ReadonlyArray<IndexedSnapshot<ConnectionSnapshot>>;
    selection: HistoryTransition<SelectionSnapshot>;
    depthFilter: HistoryTransition<DepthFilterSnapshot>;
}>;

export type ConnectionCreateHistoryChange = HistoryChangeBase & Readonly<{
    type: HistoryOperationType.ConnectionCreate;
    connection: IndexedSnapshot<ConnectionSnapshot>;
}>;

export type ConnectionDeleteHistoryChange = HistoryChangeBase & Readonly<{
    type: HistoryOperationType.ConnectionDelete;
    connection: IndexedSnapshot<ConnectionSnapshot>;
    selection: HistoryTransition<SelectionSnapshot>;
}>;

export type CanvasDeleteHistoryChange = HistoryChangeBase & Readonly<{
    type: HistoryOperationType.CanvasDelete;
    canvas: IndexedSnapshot<CanvasSnapshot>;
    context: HistoryTransition<CanvasContextSnapshot>;
}>;

export type HistoryChange =
    | TaskAdditionHistoryChange
    | TaskUpdateHistoryChange
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
