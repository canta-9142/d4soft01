import { Canvas } from "../domain/canvas.js";
import { Connection } from "../domain/connection.js";
import { findCanvasById, findTaskById } from "../domain/entity-finders.js";
import { TaskStatus } from "../domain/enums.js";
import { Task } from "../domain/task.js";
import type {
    CanvasContextSnapshot,
    CanvasDeleteHistoryChange,
    CanvasSnapshot,
    ConnectionCreateHistoryChange,
    ConnectionDeleteHistoryChange,
    ConnectionSnapshot,
    DepthFilterSnapshot,
    HistoryChange,
    HistoryTarget,
    SelectionSnapshot,
    TaskCreateHistoryChange,
    TaskDeleteHistoryChange,
    TaskEditHistoryChange,
    TaskMoveHistoryChange,
    TaskPasteHistoryChange,
    TaskSnapshot,
    ViewSettingsSnapshot,
} from "./history-types.js";
import { HistoryOperationType } from "./history-types.js";

export * from "./history-types.js";

export const MAX_HISTORY_ENTRIES = 50;

type TaskAdditionChange = TaskCreateHistoryChange | TaskPasteHistoryChange;
type HistoryDirection = "undo" | "redo";

export class HistoryEntry<TChange extends HistoryChange = HistoryChange> {
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
    private readonly undoStack: Array<HistoryEntry> = [];
    private readonly redoStack: Array<HistoryEntry> = [];

    public record(change: HistoryChange): void {
        this.undoStack.push(new HistoryEntry(change));
        if (this.undoStack.length > MAX_HISTORY_ENTRIES) {
            this.undoStack.shift();
        }
        this.redoStack.length = 0;
    }

    public undo(target: HistoryTarget): boolean {
        const entry = this.undoStack.at(-1);
        if (!entry || !this.applyHistoryChange(target, entry.change, "undo")) {
            return false;
        }

        this.undoStack.pop();
        this.redoStack.push(entry);
        return true;
    }

    public redo(target: HistoryTarget): boolean {
        const entry = this.redoStack.at(-1);
        if (!entry || !this.applyHistoryChange(target, entry.change, "redo")) {
            return false;
        }

        this.redoStack.pop();
        this.undoStack.push(entry);
        return true;
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

    private applyHistoryChange(
        target: HistoryTarget,
        change: HistoryChange,
        direction: HistoryDirection,
    ): boolean {
        switch (change.type) {
            case HistoryOperationType.TaskCreate:
            case HistoryOperationType.TaskPaste:
                return this.applyTaskAddition(target, change, direction);
            case HistoryOperationType.TaskEdit:
                return this.applyTaskEdit(target, change, direction);
            case HistoryOperationType.TaskMove:
                return this.applyTaskMove(target, change, direction);
            case HistoryOperationType.TaskDelete:
                return this.applyTaskDelete(target, change, direction);
            case HistoryOperationType.ConnectionCreate:
                return this.applyConnectionCreate(target, change, direction);
            case HistoryOperationType.ConnectionDelete:
                return this.applyConnectionDelete(target, change, direction);
            case HistoryOperationType.CanvasDelete:
                return this.applyCanvasDelete(target, change, direction);
        }
    }

    private applyTaskAddition(
        target: HistoryTarget,
        change: TaskAdditionChange,
        direction: HistoryDirection,
    ): boolean {
        const canvas = findCanvasById(target.state.canvases, change.canvasId);
        if (!canvas) return false;

        if (direction === "undo") {
            const taskIndex = canvas.tasks.findIndex(task => task.id === change.targetId);
            if (taskIndex < 0) return false;
            const restoreSelection = target.state.currentCanvasId === change.canvasId
                && this.selectionEquals(target, change.nextSelection);

            canvas.tasks.splice(taskIndex, 1);
            const removedConnectionIds = new Set(
                canvas.connections
                    .filter(connection => connection.parentTaskId === change.targetId
                        || connection.childTaskId === change.targetId)
                    .map(connection => connection.id),
            );
            canvas.connections = canvas.connections.filter(connection => !removedConnectionIds.has(connection.id));

            if (restoreSelection) {
                this.restoreSelection(target, change.previousSelection);
            } else {
                this.clearInvalidSelection(target, change.targetId, removedConnectionIds);
            }
            return true;
        }

        if (findTaskById(target.state.canvases, change.targetId)
            || !this.isInsertionIndex(change.taskIndex, canvas.tasks.length)) {
            return false;
        }
        const restoreSelection = target.state.currentCanvasId === change.canvasId
            && this.selectionEquals(target, change.previousSelection);
        canvas.tasks.splice(change.taskIndex, 0, this.restoreTask(change.task));
        if (restoreSelection) this.restoreSelection(target, change.nextSelection);
        return true;
    }

    private applyTaskEdit(
        target: HistoryTarget,
        change: TaskEditHistoryChange,
        direction: HistoryDirection,
    ): boolean {
        return this.restoreExistingTask(
            target,
            change.canvasId,
            direction === "undo" ? change.previousTask : change.nextTask,
        );
    }

    private applyTaskMove(
        target: HistoryTarget,
        change: TaskMoveHistoryChange,
        direction: HistoryDirection,
    ): boolean {
        return this.restoreExistingTask(
            target,
            change.canvasId,
            direction === "undo" ? change.previousTask : change.nextTask,
        );
    }

    private applyTaskDelete(
        target: HistoryTarget,
        change: TaskDeleteHistoryChange,
        direction: HistoryDirection,
    ): boolean {
        const canvas = findCanvasById(target.state.canvases, change.canvasId);
        if (!canvas) return false;

        if (direction === "undo") {
            if (findTaskById(target.state.canvases, change.targetId)
                || !this.isInsertionIndex(change.taskIndex, canvas.tasks.length)
                || !this.canRestoreConnections(target, canvas.id, change)) {
                return false;
            }
            const restoreSelection = target.state.currentCanvasId === change.canvasId
                && this.selectionEquals(target, change.nextSelection);
            const restoreDepthFilter = this.depthFilterEquals(
                target.state.viewSettings,
                change.nextDepthFilter,
            );

            canvas.tasks.splice(change.taskIndex, 0, this.restoreTask(change.task));
            for (const removed of [...change.removedConnections].sort((a, b) => a.index - b.index)) {
                canvas.connections.splice(removed.index, 0, this.restoreConnection(removed.connection));
            }
            if (restoreSelection) this.restoreSelection(target, change.previousSelection);
            if (restoreDepthFilter) {
                this.restoreDepthFilter(target, change.previousDepthFilter);
            }
            return true;
        }

        const taskIndex = canvas.tasks.findIndex(task => task.id === change.targetId);
        if (taskIndex < 0) return false;
        const restoreSelection = target.state.currentCanvasId === change.canvasId
            && this.selectionEquals(target, change.previousSelection);
        const restoreDepthFilter = this.depthFilterEquals(
            target.state.viewSettings,
            change.previousDepthFilter,
        );
        const removedConnectionIds = new Set(
            canvas.connections
                .filter(connection => connection.parentTaskId === change.targetId
                    || connection.childTaskId === change.targetId)
                .map(connection => connection.id),
        );

        canvas.tasks.splice(taskIndex, 1);
        canvas.connections = canvas.connections.filter(connection => !removedConnectionIds.has(connection.id));
        if (restoreSelection) {
            this.restoreSelection(target, change.nextSelection);
        } else {
            this.clearInvalidSelection(target, change.targetId, removedConnectionIds);
        }
        if (restoreDepthFilter) this.restoreDepthFilter(target, change.nextDepthFilter);
        return true;
    }

    private applyConnectionCreate(
        target: HistoryTarget,
        change: ConnectionCreateHistoryChange,
        direction: HistoryDirection,
    ): boolean {
        const canvas = findCanvasById(target.state.canvases, change.canvasId);
        if (!canvas) return false;
        if (direction === "undo") {
            const index = canvas.connections.findIndex(connection => connection.id === change.targetId);
            if (index < 0) return false;
            canvas.connections.splice(index, 1);
            if (target.currentConnectionId === change.targetId) target.currentConnectionId = null;
            return true;
        }
        return this.insertConnection(target, canvas.id, change.connection, change.connectionIndex);
    }

    private applyConnectionDelete(
        target: HistoryTarget,
        change: ConnectionDeleteHistoryChange,
        direction: HistoryDirection,
    ): boolean {
        const canvas = findCanvasById(target.state.canvases, change.canvasId);
        if (!canvas) return false;
        if (direction === "undo") {
            const restoreSelection = target.state.currentCanvasId === change.canvasId
                && this.selectionEquals(target, change.nextSelection);
            if (!this.insertConnection(target, canvas.id, change.connection, change.connectionIndex)) {
                return false;
            }
            if (restoreSelection) this.restoreSelection(target, change.previousSelection);
            return true;
        }

        const index = canvas.connections.findIndex(connection => connection.id === change.targetId);
        if (index < 0) return false;
        const restoreSelection = target.state.currentCanvasId === change.canvasId
            && this.selectionEquals(target, change.previousSelection);
        canvas.connections.splice(index, 1);
        if (restoreSelection) {
            this.restoreSelection(target, change.nextSelection);
        } else if (target.currentConnectionId === change.targetId) {
            target.currentConnectionId = null;
        }
        return true;
    }

    private applyCanvasDelete(
        target: HistoryTarget,
        change: CanvasDeleteHistoryChange,
        direction: HistoryDirection,
    ): boolean {
        if (direction === "undo") {
            if (!this.canRestoreCanvas(target, change.canvas)
                || !this.isInsertionIndex(change.canvasIndex, target.state.canvases.length)) {
                return false;
            }
            const restoreContext = this.canvasContextEquals(target, change.nextCanvasContext);
            target.state.canvases.splice(change.canvasIndex, 0, this.restoreCanvas(change.canvas));
            if (restoreContext) this.restoreCanvasContext(target, change.previousCanvasContext);
            return true;
        }

        const canvasIndex = target.state.canvases.findIndex(canvas => canvas.id === change.canvasId);
        if (canvasIndex < 0) return false;
        const canvas = target.state.canvases[canvasIndex];
        if (!canvas) return false;
        const restoreContext = this.canvasContextEquals(target, change.previousCanvasContext);
        const removedTaskIds = new Set(canvas.tasks.map(task => task.id));
        const removedConnectionIds = new Set(canvas.connections.map(connection => connection.id));
        target.state.canvases.splice(canvasIndex, 1);

        if (restoreContext) {
            this.restoreCanvasContext(target, change.nextCanvasContext);
        } else {
            if (target.state.currentCanvasId === change.canvasId) {
                target.state.currentCanvasId = target.state.canvases[canvasIndex]?.id
                    ?? target.state.canvases[canvasIndex - 1]?.id
                    ?? "";
            }
            this.clearInvalidSelection(target, removedTaskIds, removedConnectionIds);
            if (target.state.viewSettings.depthBaseTaskId
                && removedTaskIds.has(target.state.viewSettings.depthBaseTaskId)) {
                target.state.viewSettings.depthFilterEnabled = false;
                target.state.viewSettings.depthBaseTaskId = null;
            }
            if (target.state.canvases.length === 0) this.clearViewSettings(target);
        }
        return true;
    }

    private restoreExistingTask(
        target: HistoryTarget,
        canvasId: string,
        snapshot: TaskSnapshot,
    ): boolean {
        const canvas = findCanvasById(target.state.canvases, canvasId);
        const task = canvas?.tasks.find(candidate => candidate.id === snapshot.id);
        if (!task || !Object.values(TaskStatus).includes(snapshot.status)) return false;
        task.title = snapshot.title;
        task.description = snapshot.description;
        task.status = snapshot.status;
        task.x = snapshot.x;
        task.y = snapshot.y;
        task.createdAt = new Date(snapshot.createdAt);
        task.updatedAt = new Date(snapshot.updatedAt);
        return true;
    }

    private insertConnection(
        target: HistoryTarget,
        canvasId: string,
        snapshot: ConnectionSnapshot,
        index: number,
    ): boolean {
        const canvas = findCanvasById(target.state.canvases, canvasId);
        if (!canvas || !this.isInsertionIndex(index, canvas.connections.length)) return false;
        const taskIds = new Set(canvas.tasks.map(task => task.id));
        const duplicateId = target.state.canvases.some(candidate =>
            candidate.connections.some(connection => connection.id === snapshot.id),
        );
        const duplicateDirection = canvas.connections.some(connection =>
            connection.parentTaskId === snapshot.parentTaskId
            && connection.childTaskId === snapshot.childTaskId,
        );
        if (duplicateId || duplicateDirection
            || snapshot.parentTaskId === snapshot.childTaskId
            || !taskIds.has(snapshot.parentTaskId)
            || !taskIds.has(snapshot.childTaskId)) {
            return false;
        }
        canvas.connections.splice(index, 0, this.restoreConnection(snapshot));
        return true;
    }

    private canRestoreConnections(
        target: HistoryTarget,
        canvasId: string,
        change: TaskDeleteHistoryChange,
    ): boolean {
        const canvas = findCanvasById(target.state.canvases, canvasId);
        if (!canvas) return false;
        const connectionIds = new Set<string>();
        const connectionDirections = new Set(
            canvas.connections.map(connection => `${connection.parentTaskId}\u0000${connection.childTaskId}`),
        );
        const existingConnectionIds = new Set(
            target.state.canvases.flatMap(candidate => candidate.connections.map(connection => connection.id)),
        );
        const taskIds = new Set(canvas.tasks.map(task => task.id));
        taskIds.add(change.task.id);
        let connectionCount = canvas.connections.length;
        for (const removed of [...change.removedConnections].sort((a, b) => a.index - b.index)) {
            const connection = removed.connection;
            const direction = `${connection.parentTaskId}\u0000${connection.childTaskId}`;
            if (!this.isInsertionIndex(removed.index, connectionCount)
                || existingConnectionIds.has(connection.id)
                || connectionIds.has(connection.id)
                || connectionDirections.has(direction)
                || connection.parentTaskId === connection.childTaskId
                || !taskIds.has(connection.parentTaskId)
                || !taskIds.has(connection.childTaskId)) {
                return false;
            }
            connectionIds.add(connection.id);
            connectionDirections.add(direction);
            connectionCount += 1;
        }
        return true;
    }

    private canRestoreCanvas(target: HistoryTarget, snapshot: CanvasSnapshot): boolean {
        if (target.state.canvases.some(canvas => canvas.id === snapshot.id)) return false;
        const taskIds = new Set(target.state.canvases.flatMap(canvas => canvas.tasks.map(task => task.id)));
        const canvasTaskIds = new Set<string>();
        const connectionIds = new Set(
            target.state.canvases.flatMap(canvas => canvas.connections.map(connection => connection.id)),
        );
        const connectionDirections = new Set<string>();
        for (const task of snapshot.tasks) {
            if (taskIds.has(task.id)) return false;
            taskIds.add(task.id);
            canvasTaskIds.add(task.id);
        }
        for (const connection of snapshot.connections) {
            const direction = `${connection.parentTaskId}\u0000${connection.childTaskId}`;
            if (connectionIds.has(connection.id)
                || connectionDirections.has(direction)
                || connection.parentTaskId === connection.childTaskId
                || !canvasTaskIds.has(connection.parentTaskId)
                || !canvasTaskIds.has(connection.childTaskId)) {
                return false;
            }
            connectionIds.add(connection.id);
            connectionDirections.add(direction);
        }
        return true;
    }

    private restoreTask(snapshot: TaskSnapshot): Task {
        const task = new Task(
            snapshot.id,
            snapshot.title,
            snapshot.description,
            snapshot.status,
            snapshot.x,
            snapshot.y,
        );
        task.createdAt = new Date(snapshot.createdAt);
        task.updatedAt = new Date(snapshot.updatedAt);
        return task;
    }

    private restoreConnection(snapshot: ConnectionSnapshot): Connection {
        const connection = new Connection(
            snapshot.id,
            snapshot.parentTaskId,
            snapshot.childTaskId,
        );
        connection.createdAt = new Date(snapshot.createdAt);
        return connection;
    }

    private restoreCanvas(snapshot: CanvasSnapshot): Canvas {
        const canvas = new Canvas(snapshot.id, snapshot.title, snapshot.x, snapshot.y);
        canvas.tasks = snapshot.tasks.map(task => this.restoreTask(task));
        canvas.connections = snapshot.connections.map(connection => this.restoreConnection(connection));
        canvas.createdAt = new Date(snapshot.createdAt);
        canvas.updatedAt = new Date(snapshot.updatedAt);
        return canvas;
    }

    private restoreSelection(target: HistoryTarget, snapshot: SelectionSnapshot): void {
        target.currentTaskId = snapshot.currentTaskId;
        target.currentConnectionId = snapshot.currentConnectionId;
        target.connectionParentTaskId = snapshot.connectionParentTaskId;
    }

    private restoreDepthFilter(target: HistoryTarget, snapshot: DepthFilterSnapshot): void {
        target.state.viewSettings.depthFilterEnabled = snapshot.depthFilterEnabled;
        target.state.viewSettings.depthBaseTaskId = snapshot.depthBaseTaskId;
        target.state.viewSettings.maxDepth = snapshot.maxDepth;
    }

    private restoreViewSettings(target: HistoryTarget, snapshot: ViewSettingsSnapshot): void {
        target.state.viewSettings.searchText = snapshot.searchText;
        target.state.viewSettings.statusFilter = snapshot.statusFilter;
        this.restoreDepthFilter(target, snapshot);
    }

    private restoreCanvasContext(target: HistoryTarget, snapshot: CanvasContextSnapshot): void {
        target.state.currentCanvasId = snapshot.currentCanvasId;
        this.restoreSelection(target, snapshot.selection);
        this.restoreViewSettings(target, snapshot.viewSettings);
    }

    private clearInvalidSelection(
        target: HistoryTarget,
        removedTaskIds: string | ReadonlySet<string>,
        removedConnectionIds: ReadonlySet<string>,
    ): void {
        const taskIds = typeof removedTaskIds === "string"
            ? new Set([removedTaskIds])
            : removedTaskIds;
        if (target.currentTaskId && taskIds.has(target.currentTaskId)) target.currentTaskId = null;
        if (target.connectionParentTaskId && taskIds.has(target.connectionParentTaskId)) {
            target.connectionParentTaskId = null;
        }
        if (target.currentConnectionId && removedConnectionIds.has(target.currentConnectionId)) {
            target.currentConnectionId = null;
        }
    }

    private clearViewSettings(target: HistoryTarget): void {
        target.state.viewSettings.searchText = "";
        target.state.viewSettings.statusFilter = null;
        target.state.viewSettings.depthFilterEnabled = false;
        target.state.viewSettings.depthBaseTaskId = null;
        target.state.viewSettings.maxDepth = 0;
    }

    private selectionEquals(target: HistoryTarget, snapshot: SelectionSnapshot): boolean {
        return target.currentTaskId === snapshot.currentTaskId
            && target.currentConnectionId === snapshot.currentConnectionId
            && target.connectionParentTaskId === snapshot.connectionParentTaskId;
    }

    private depthFilterEquals(
        viewSettings: HistoryTarget["state"]["viewSettings"],
        snapshot: DepthFilterSnapshot,
    ): boolean {
        return viewSettings.depthFilterEnabled === snapshot.depthFilterEnabled
            && viewSettings.depthBaseTaskId === snapshot.depthBaseTaskId
            && viewSettings.maxDepth === snapshot.maxDepth;
    }

    private canvasContextEquals(target: HistoryTarget, snapshot: CanvasContextSnapshot): boolean {
        const viewSettings = target.state.viewSettings;
        return target.state.currentCanvasId === snapshot.currentCanvasId
            && this.selectionEquals(target, snapshot.selection)
            && viewSettings.searchText === snapshot.viewSettings.searchText
            && viewSettings.statusFilter === snapshot.viewSettings.statusFilter
            && this.depthFilterEquals(viewSettings, snapshot.viewSettings);
    }

    private isInsertionIndex(index: number, length: number): boolean {
        return Number.isInteger(index) && index >= 0 && index <= length;
    }
}
