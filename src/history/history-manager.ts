import type { Canvas } from "../domain/canvas.js";
import { findCanvasById, findTaskById } from "../domain/entity-finders.js";
import {
    applyTaskSnapshot,
    createCanvasContextSnapshot,
    createDepthFilterSnapshot,
    createSelectionSnapshot,
    createViewSettingsSnapshot,
    HistoryOperationType,
    type CanvasContextSnapshot,
    type CanvasDeleteHistoryChange,
    type ConnectionCreateHistoryChange,
    type ConnectionDeleteHistoryChange,
    type DepthFilterSnapshot,
    type HistoryChange,
    type HistoryTarget,
    type HistoryTransition,
    type SelectionSnapshot,
    type TaskAdditionHistoryChange,
    type TaskDeleteHistoryChange,
    type TaskUpdateHistoryChange,
    type ViewSettingsSnapshot,
    restoreCanvasSnapshot,
    restoreConnectionSnapshot,
    restoreTaskSnapshot,
} from "./history-types.js";

export * from "./history-types.js";

export const MAX_HISTORY_ENTRIES = 50;
type HistoryDirection = "undo" | "redo";

export class HistoryEntry {
    readonly change: HistoryChange;
    readonly createdAt: string;

    constructor(change: HistoryChange, createdAt = new Date().toISOString()) {
        this.change = structuredClone(change) as HistoryChange;
        this.createdAt = createdAt;
    }
}

export class HistoryManager {
    private readonly undoStack: HistoryEntry[] = [];
    private readonly redoStack: HistoryEntry[] = [];

    public record(change: HistoryChange): void {
        this.undoStack.push(new HistoryEntry(change));
        if (this.undoStack.length > MAX_HISTORY_ENTRIES) this.undoStack.shift();
        this.redoStack.length = 0;
    }

    public undo(target: HistoryTarget): boolean {
        return this.moveHistory(this.undoStack, this.redoStack, target, "undo");
    }

    public redo(target: HistoryTarget): boolean {
        return this.moveHistory(this.redoStack, this.undoStack, target, "redo");
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

    private moveHistory(
        source: HistoryEntry[],
        destination: HistoryEntry[],
        target: HistoryTarget,
        direction: HistoryDirection,
    ): boolean {
        const entry = source.at(-1);
        if (!entry || !this.applyHistoryChange(target, entry.change, direction)) return false;
        source.pop();
        destination.push(entry);
        return true;
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
            case HistoryOperationType.TaskMove:
                return this.applyTaskUpdate(target, change, direction);
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
        change: TaskAdditionHistoryChange,
        direction: HistoryDirection,
    ): boolean {
        const canvas = findCanvasById(target.state.canvases, change.canvasId);
        if (!canvas) return false;
        const [selectionFrom, selectionTo] = this.transition(change.selection, direction);
        const restoreSelection = target.state.currentCanvasId === change.canvasId
            && this.matches(createSelectionSnapshot(target), selectionFrom);
        const viewSettingsTransition = change.type === HistoryOperationType.TaskCreate
            ? this.transition(change.viewSettings, direction)
            : null;
        const restoreViewSettings = viewSettingsTransition !== null
            && this.matches(
                createViewSettingsSnapshot(target.state.viewSettings),
                viewSettingsTransition[0],
            );

        if (direction === "undo") {
            const index = canvas.tasks.findIndex(task => task.id === change.targetId);
            if (index < 0) return false;
            canvas.tasks.splice(index, 1);
            const removedConnectionIds = new Set(
                canvas.connections
                    .filter(connection => connection.parentTaskId === change.targetId
                        || connection.childTaskId === change.targetId)
                    .map(connection => connection.id),
            );
            canvas.connections = canvas.connections.filter(connection => !removedConnectionIds.has(connection.id));
            if (restoreSelection) this.restoreSelection(target, selectionTo);
            else this.clearInvalidSelection(target, new Set([change.targetId]), removedConnectionIds);
            if (restoreViewSettings && viewSettingsTransition) {
                this.restoreViewSettings(target, viewSettingsTransition[1]);
            }
            return true;
        }

        if (findTaskById(target.state.canvases, change.targetId)
            || !this.isInsertionIndex(change.task.index, canvas.tasks.length)) return false;
        canvas.tasks.splice(change.task.index, 0, restoreTaskSnapshot(change.task.value));
        if (restoreSelection) this.restoreSelection(target, selectionTo);
        if (restoreViewSettings && viewSettingsTransition) {
            this.restoreViewSettings(target, viewSettingsTransition[1]);
        }
        return true;
    }

    private applyTaskUpdate(
        target: HistoryTarget,
        change: TaskUpdateHistoryChange,
        direction: HistoryDirection,
    ): boolean {
        const canvas = findCanvasById(target.state.canvases, change.canvasId);
        const snapshot = this.transition(change.task, direction)[1];
        const task = canvas?.tasks.find(candidate => candidate.id === snapshot.id);
        if (!task) return false;
        applyTaskSnapshot(task, snapshot);
        return true;
    }

    private applyTaskDelete(
        target: HistoryTarget,
        change: TaskDeleteHistoryChange,
        direction: HistoryDirection,
    ): boolean {
        const canvas = findCanvasById(target.state.canvases, change.canvasId);
        if (!canvas) return false;
        const [selectionFrom, selectionTo] = this.transition(change.selection, direction);
        const [depthFrom, depthTo] = this.transition(change.depthFilter, direction);
        const restoreSelection = target.state.currentCanvasId === change.canvasId
            && this.matches(createSelectionSnapshot(target), selectionFrom);
        const restoreDepth = this.matches(createDepthFilterSnapshot(target.state.viewSettings), depthFrom);

        if (direction === "undo") {
            const existingConnectionIds = new Set(
                target.state.canvases.flatMap(item => item.connections.map(connection => connection.id)),
            );
            if (findTaskById(target.state.canvases, change.targetId)
                || !this.isInsertionIndex(change.task.index, canvas.tasks.length)
                || change.connections.some(item => existingConnectionIds.has(item.value.id))) return false;
            canvas.tasks.splice(change.task.index, 0, restoreTaskSnapshot(change.task.value));
            for (const item of [...change.connections].sort((a, b) => a.index - b.index)) {
                canvas.connections.splice(item.index, 0, restoreConnectionSnapshot(item.value));
            }
            if (restoreSelection) this.restoreSelection(target, selectionTo);
            if (restoreDepth) this.restoreDepthFilter(target, depthTo);
            return true;
        }

        const index = canvas.tasks.findIndex(task => task.id === change.targetId);
        if (index < 0) return false;
        const removedConnectionIds = new Set(
            canvas.connections
                .filter(connection => connection.parentTaskId === change.targetId
                    || connection.childTaskId === change.targetId)
                .map(connection => connection.id),
        );
        canvas.tasks.splice(index, 1);
        canvas.connections = canvas.connections.filter(connection => !removedConnectionIds.has(connection.id));
        if (restoreSelection) this.restoreSelection(target, selectionTo);
        else this.clearInvalidSelection(target, new Set([change.targetId]), removedConnectionIds);
        if (restoreDepth) this.restoreDepthFilter(target, depthTo);
        return true;
    }

    private applyConnectionCreate(
        target: HistoryTarget,
        change: ConnectionCreateHistoryChange,
        direction: HistoryDirection,
    ): boolean {
        const canvas = findCanvasById(target.state.canvases, change.canvasId);
        if (!canvas) return false;
        if (direction === "redo") return this.insertConnection(target, canvas, change.connection);
        const index = canvas.connections.findIndex(connection => connection.id === change.targetId);
        if (index < 0) return false;
        canvas.connections.splice(index, 1);
        if (target.currentConnectionId === change.targetId) target.currentConnectionId = null;
        return true;
    }

    private applyConnectionDelete(
        target: HistoryTarget,
        change: ConnectionDeleteHistoryChange,
        direction: HistoryDirection,
    ): boolean {
        const canvas = findCanvasById(target.state.canvases, change.canvasId);
        if (!canvas) return false;
        const [selectionFrom, selectionTo] = this.transition(change.selection, direction);
        const restoreSelection = target.state.currentCanvasId === change.canvasId
            && this.matches(createSelectionSnapshot(target), selectionFrom);

        if (direction === "undo") {
            if (!this.insertConnection(target, canvas, change.connection)) return false;
        } else {
            const index = canvas.connections.findIndex(connection => connection.id === change.targetId);
            if (index < 0) return false;
            canvas.connections.splice(index, 1);
        }
        if (restoreSelection) this.restoreSelection(target, selectionTo);
        else if (direction === "redo" && target.currentConnectionId === change.targetId) {
            target.currentConnectionId = null;
        }
        return true;
    }

    private applyCanvasDelete(
        target: HistoryTarget,
        change: CanvasDeleteHistoryChange,
        direction: HistoryDirection,
    ): boolean {
        const [contextFrom, contextTo] = this.transition(change.context, direction);
        const restoreContext = this.matches(createCanvasContextSnapshot(target), contextFrom);
        if (direction === "undo") {
            if (findCanvasById(target.state.canvases, change.canvasId)
                || !this.isInsertionIndex(change.canvas.index, target.state.canvases.length)) return false;
            target.state.canvases.splice(
                change.canvas.index,
                0,
                restoreCanvasSnapshot(change.canvas.value),
            );
            if (restoreContext) this.restoreCanvasContext(target, contextTo);
            return true;
        }

        const index = target.state.canvases.findIndex(canvas => canvas.id === change.canvasId);
        const canvas = target.state.canvases[index];
        if (!canvas) return false;
        const removedTaskIds = new Set(canvas.tasks.map(task => task.id));
        const removedConnectionIds = new Set(canvas.connections.map(connection => connection.id));
        target.state.canvases.splice(index, 1);
        if (restoreContext) {
            this.restoreCanvasContext(target, contextTo);
            return true;
        }
        if (target.state.currentCanvasId === change.canvasId) {
            target.state.currentCanvasId = target.state.canvases[index]?.id
                ?? target.state.canvases[index - 1]?.id
                ?? null;
        }
        this.clearInvalidSelection(target, removedTaskIds, removedConnectionIds);
        if (target.state.viewSettings.depthBaseTaskId
            && removedTaskIds.has(target.state.viewSettings.depthBaseTaskId)) {
            target.state.viewSettings.depthFilterEnabled = false;
            target.state.viewSettings.depthBaseTaskId = null;
        }
        if (target.state.canvases.length === 0) this.clearViewSettings(target);
        return true;
    }

    private insertConnection(
        target: HistoryTarget,
        canvas: Canvas,
        item: ConnectionCreateHistoryChange["connection"],
    ): boolean {
        const snapshot = item.value;
        const taskIds = new Set(canvas.tasks.map(task => task.id));
        const duplicateId = target.state.canvases.some(candidate =>
            candidate.connections.some(connection => connection.id === snapshot.id),
        );
        const duplicateDirection = canvas.connections.some(connection =>
            connection.parentTaskId === snapshot.parentTaskId
            && connection.childTaskId === snapshot.childTaskId,
        );
        if (!this.isInsertionIndex(item.index, canvas.connections.length)
            || duplicateId || duplicateDirection
            || !taskIds.has(snapshot.parentTaskId)
            || !taskIds.has(snapshot.childTaskId)) return false;
        canvas.connections.splice(item.index, 0, restoreConnectionSnapshot(snapshot));
        return true;
    }

    private restoreSelection(target: HistoryTarget, snapshot: SelectionSnapshot): void {
        Object.assign(target, snapshot);
    }

    private restoreDepthFilter(target: HistoryTarget, snapshot: DepthFilterSnapshot): void {
        Object.assign(target.state.viewSettings, snapshot);
    }

    private restoreViewSettings(target: HistoryTarget, snapshot: ViewSettingsSnapshot): void {
        Object.assign(target.state.viewSettings, snapshot);
    }

    private restoreCanvasContext(target: HistoryTarget, snapshot: CanvasContextSnapshot): void {
        target.state.currentCanvasId = snapshot.currentCanvasId;
        this.restoreSelection(target, snapshot.selection);
        Object.assign(target.state.viewSettings, snapshot.viewSettings);
    }

    private clearInvalidSelection(
        target: HistoryTarget,
        removedTaskIds: ReadonlySet<string>,
        removedConnectionIds: ReadonlySet<string>,
    ): void {
        if (target.currentTaskId && removedTaskIds.has(target.currentTaskId)) target.currentTaskId = null;
        if (target.connectionParentTaskId && removedTaskIds.has(target.connectionParentTaskId)) {
            target.connectionParentTaskId = null;
        }
        if (target.currentConnectionId && removedConnectionIds.has(target.currentConnectionId)) {
            target.currentConnectionId = null;
        }
    }

    private clearViewSettings(target: HistoryTarget): void {
        target.state.viewSettings.reset();
    }

    private transition<T>(transition: HistoryTransition<T>, direction: HistoryDirection): readonly [T, T] {
        return direction === "undo"
            ? [transition.after, transition.before]
            : [transition.before, transition.after];
    }

    private matches(value: unknown, snapshot: unknown): boolean {
        return JSON.stringify(value) === JSON.stringify(snapshot);
    }

    private isInsertionIndex(index: number, length: number): boolean {
        return Number.isInteger(index) && index >= 0 && index <= length;
    }
}
