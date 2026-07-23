import type { Canvas } from "../domain/canvas.js";
import type {
    CanvasSnapshot,
    ConnectionSnapshot,
    TaskSnapshot,
} from "../domain/entity-snapshots.js";
import type { TaskStatus } from "../domain/enums.js";
import type { ViewSettings } from "../domain/view-settings.js";

export {
    applyTaskSnapshot,
    createCanvasSnapshot,
    createConnectionSnapshot,
    createTaskSnapshot,
    restoreCanvasSnapshot,
    restoreConnectionSnapshot,
    restoreTaskSnapshot,
} from "../domain/entity-snapshots.js";
export type {
    CanvasSnapshot,
    ConnectionSnapshot,
    TaskSnapshot,
} from "../domain/entity-snapshots.js";

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

export type SelectionSnapshot = Readonly<{
    currentTaskId: string | null;
    currentConnectionId: string | null;
    connectionParentTaskId: string | null;
}>;

export type DepthFilterSnapshot = Readonly<{
    depthFilterEnabled: boolean;
    depthBaseTaskId: string | null;
    maxDepth: number | null;
}>;

export type ViewSettingsSnapshot = Readonly<{
    searchText: string;
    statusFilter: TaskStatus | null;
}> & DepthFilterSnapshot;

export type CanvasContextSnapshot = Readonly<{
    currentCanvasId: string | null;
    selection: SelectionSnapshot;
    viewSettings: ViewSettingsSnapshot;
}>;

export type IndexedSnapshot<T> = Readonly<{ value: T; index: number }>;
export type HistoryTransition<T> = Readonly<{ before: T; after: T }>;

type HistoryChangeBase = Readonly<{
    canvasId: string;
    targetId: string;
}>;

type TaskAdditionHistoryChangeBase = HistoryChangeBase & Readonly<{
    task: IndexedSnapshot<TaskSnapshot>;
    selection: HistoryTransition<SelectionSnapshot>;
}>;

export type TaskCreateHistoryChange = TaskAdditionHistoryChangeBase & Readonly<{
    type: HistoryOperationType.TaskCreate;
    viewSettings: HistoryTransition<ViewSettingsSnapshot>;
}>;

export type TaskPasteHistoryChange = TaskAdditionHistoryChangeBase & Readonly<{
    type: HistoryOperationType.TaskPaste;
}>;

export type TaskAdditionHistoryChange =
    | TaskCreateHistoryChange
    | TaskPasteHistoryChange;

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
        currentCanvasId: string | null;
        viewSettings: ViewSettings;
    };
    currentTaskId: string | null;
    currentConnectionId: string | null;
    connectionParentTaskId: string | null;
}

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
