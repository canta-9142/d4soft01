import assert from "node:assert/strict";
import test from "node:test";

import { Application } from "../dist/application/application.js";
import { Task } from "../dist/domain/task.js";
import { TaskStatus } from "../dist/domain/enums.js";
import {
    HistoryManager,
    HistoryOperationType,
} from "../dist/history/history-manager.js";

const createCanvas = (app, title) => {
    app.createCanvas(title);
    return app.state.currentCanvasId;
};

const createTask = (app, title, x = 10, y = 20) => {
    const id = app.createTaskAt(title, "description", TaskStatus.NOTSTARTED, x, y);
    assert.ok(id);
    return id;
};

test("a canvas uses the specified default title", () => {
    const app = new Application();
    app.createCanvas();
    assert.equal(app.getCurrentCanvas()?.title, "新規キャンバス");

    app.createCanvas("   ");
    assert.equal(app.getCurrentCanvas()?.title, "新規キャンバス");
});

test("generated IDs include an explicit timestamp and random component", () => {
    const app = new Application();
    app.createCanvas();
    const canvasId = app.state.currentCanvasId;
    const taskId = app.createTaskAt("task", "", TaskStatus.NOTSTARTED, 0, 0);
    assert.ok(canvasId);
    assert.ok(taskId);
    assert.match(canvasId, /^canvas-\d{17}-[a-z0-9]{12}$/i);
    assert.match(taskId, /^task-\d{17}-[a-z0-9]{12}$/i);
    assert.equal(typeof app.getCurrentCanvas().createdAt, "string");
    assert.equal(typeof app.getTask(taskId).createdAt, "string");
});

test("connections can only be created between currently visible tasks", () => {
    const app = new Application();
    createCanvas(app, "canvas");
    const visibleId = createTask(app, "visible");
    const hiddenId = createTask(app, "hidden");
    assert.equal(app.updateSearchText("visible"), true);

    assert.equal(app.createConnection(visibleId, hiddenId), false);
    assert.equal(app.getCurrentCanvas().connections.length, 0);
});

test("task creation can be undone and redone with a real Task instance", () => {
    const app = new Application();
    createCanvas(app, "canvas");
    const taskId = createTask(app, "task");

    assert.equal(app.undo(), true);
    assert.equal(app.getTask(taskId), undefined);
    assert.equal(app.currentTaskId, null);
    assert.equal(app.historyManager.canRedo(), true);

    assert.equal(app.redo(), true);
    const restored = app.getTask(taskId);
    assert.ok(restored instanceof Task);
    assert.equal(restored.title, "task");
    assert.equal(app.currentTaskId, taskId);
});

test("undoing an edit after a canvas switch keeps the current canvas", () => {
    const app = new Application();
    const firstCanvasId = createCanvas(app, "first");
    const taskId = createTask(app, "before");
    app.historyManager.clear();

    assert.equal(app.updateTask(taskId, "after", "changed", TaskStatus.COMPLETED), true);
    const secondCanvasId = createCanvas(app, "second");

    assert.equal(app.undo(), true);
    assert.equal(app.state.currentCanvasId, secondCanvasId);
    assert.equal(app.getTask(taskId)?.title, "before");
    assert.equal(app.getTask(taskId)?.status, TaskStatus.NOTSTARTED);

    assert.equal(app.redo(), true);
    assert.equal(app.state.currentCanvasId, secondCanvasId);
    assert.equal(app.getTask(taskId)?.title, "after");
    assert.notEqual(firstCanvasId, secondCanvasId);
});

test("a drag is recorded as one task move", () => {
    const app = new Application();
    createCanvas(app, "canvas");
    const taskId = createTask(app, "task", 1, 2);
    app.historyManager.clear();

    assert.equal(app.beginTaskMove(taskId), true);
    assert.equal(app.updateTaskPosition(taskId, 10, 20), true);
    assert.equal(app.updateTaskPosition(taskId, 30, 40), true);
    assert.equal(app.updateTaskPosition(taskId, 50, 60), true);
    assert.equal(app.finishTaskMove(taskId), true);

    assert.equal(app.undo(), true);
    assert.deepEqual(
        { x: app.getTask(taskId)?.x, y: app.getTask(taskId)?.y },
        { x: 1, y: 2 },
    );
    assert.equal(app.undo(), false);

    assert.equal(app.redo(), true);
    assert.deepEqual(
        { x: app.getTask(taskId)?.x, y: app.getTask(taskId)?.y },
        { x: 50, y: 60 },
    );
});

test("task deletion restores its connections, selection, and depth filter", () => {
    const app = new Application();
    createCanvas(app, "canvas");
    const parentId = createTask(app, "parent");
    const childId = createTask(app, "child");
    assert.equal(app.createConnection(parentId, childId), true);
    const connectionId = app.getCurrentCanvas().connections[0].id;
    app.currentTaskId = parentId;
    app.currentConnectionId = null;
    app.setDepthFilter(parentId, 3);
    app.historyManager.clear();

    assert.equal(app.removeTask(parentId), true);
    assert.equal(app.getTask(parentId), undefined);
    assert.equal(app.getCurrentCanvas().connections.length, 0);
    assert.equal(app.state.viewSettings.depthFilterEnabled, false);

    assert.equal(app.undo(), true);
    assert.ok(app.getTask(parentId) instanceof Task);
    assert.equal(app.getCurrentCanvas().connections[0].id, connectionId);
    assert.equal(app.currentTaskId, parentId);
    assert.equal(app.state.viewSettings.depthFilterEnabled, true);
    assert.equal(app.state.viewSettings.depthBaseTaskId, parentId);

    assert.equal(app.redo(), true);
    assert.equal(app.getTask(parentId), undefined);
    assert.equal(app.getTask(childId)?.title, "child");
});

test("connection creation and deletion can be undone and redone", () => {
    const app = new Application();
    createCanvas(app, "canvas");
    const parentId = createTask(app, "parent");
    const childId = createTask(app, "child");
    app.historyManager.clear();

    assert.equal(app.createConnection(parentId, childId), true);
    const connectionId = app.getCurrentCanvas().connections[0].id;
    assert.equal(app.undo(), true);
    assert.equal(app.getCurrentCanvas().connections.length, 0);
    assert.equal(app.redo(), true);
    assert.equal(app.getCurrentCanvas().connections[0].id, connectionId);

    app.historyManager.clear();
    app.currentConnectionId = connectionId;
    assert.equal(app.removeConnection(connectionId), true);
    assert.equal(app.undo(), true);
    assert.equal(app.currentConnectionId, connectionId);
    assert.equal(app.redo(), true);
    assert.equal(app.currentConnectionId, null);
});

test("canvas deletion restores the canvas and its context", () => {
    const app = new Application();
    const firstCanvasId = createCanvas(app, "first");
    const secondCanvasId = createCanvas(app, "second");
    const taskId = createTask(app, "task");
    app.state.viewSettings.searchText = "task";
    app.currentTaskId = taskId;
    app.historyManager.clear();

    assert.equal(app.removeCanvas(secondCanvasId), true);
    assert.equal(app.state.currentCanvasId, firstCanvasId);

    assert.equal(app.undo(), true);
    assert.equal(app.state.currentCanvasId, secondCanvasId);
    assert.equal(app.state.viewSettings.searchText, "task");
    assert.equal(app.currentTaskId, taskId);
    assert.ok(app.getTask(taskId) instanceof Task);

    assert.equal(app.redo(), true);
    assert.equal(app.state.currentCanvasId, firstCanvasId);
    assert.equal(app.getTask(taskId), undefined);
});

test("recording a new operation clears redo history", () => {
    const app = new Application();
    createCanvas(app, "canvas");
    createTask(app, "first");
    assert.equal(app.undo(), true);
    assert.equal(app.historyManager.canRedo(), true);

    createTask(app, "replacement");
    assert.equal(app.historyManager.canRedo(), false);
    assert.equal(app.redo(), false);
});

test("pasting a task is undoable and keeps the generated identity on redo", () => {
    const app = new Application();
    createCanvas(app, "canvas");
    const sourceId = createTask(app, "source", 8, 12);
    assert.equal(app.copyTaskToClipboard(sourceId), true);
    app.historyManager.clear();

    assert.equal(app.pasteTask(), true);
    const pastedId = app.currentTaskId;
    assert.ok(pastedId);
    assert.deepEqual(
        { x: app.getTask(pastedId)?.x, y: app.getTask(pastedId)?.y },
        { x: 32, y: 36 },
    );

    assert.equal(app.undo(), true);
    assert.equal(app.getTask(pastedId), undefined);
    assert.equal(app.redo(), true);
    assert.equal(app.getTask(pastedId)?.id, pastedId);
});

test("clipboard keeps a copy-time snapshot and uses the fallback position on another canvas", () => {
    const app = new Application();
    createCanvas(app, "source");
    const sourceId = createTask(app, "source task", 8, 12);
    assert.equal(app.copyTaskToClipboard(sourceId), true);
    assert.equal(
        app.updateTask(sourceId, "changed after copy", "", TaskStatus.NOTSTARTED),
        true,
    );

    createCanvas(app, "destination");
    app.historyManager.clear();
    assert.equal(app.pasteTask({ x: 100, y: 200 }), true);
    const pastedId = app.currentTaskId;
    assert.ok(pastedId);
    assert.deepEqual(
        {
            title: app.getTask(pastedId)?.title,
            x: app.getTask(pastedId)?.x,
            y: app.getTask(pastedId)?.y,
        },
        { title: "source task", x: 100, y: 200 },
    );
    assert.equal(app.undo(), true);
    assert.equal(app.getTask(pastedId), undefined);
    assert.equal(app.redo(), true);
    assert.equal(app.getTask(pastedId)?.title, "source task");
});

test("a failed history application does not move the entry to redo", () => {
    const app = new Application();
    const manager = new HistoryManager();
    const snapshot = {
        id: "missing-task",
        title: "title",
        description: "",
        status: TaskStatus.NOTSTARTED,
        x: 0,
        y: 0,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
    };
    manager.record({
        type: HistoryOperationType.TaskEdit,
        canvasId: "missing-canvas",
        targetId: snapshot.id,
        task: {
            before: snapshot,
            after: { ...snapshot, title: "changed" },
        },
    });

    assert.equal(manager.undo(app), false);
    assert.equal(manager.canUndo(), true);
    assert.equal(manager.canRedo(), false);
});

test("only the latest fifty operations are retained", () => {
    const app = new Application();
    createCanvas(app, "canvas");
    app.historyManager.clear();
    for (let index = 0; index < 51; index += 1) {
        createTask(app, `task-${index}`);
    }

    for (let index = 0; index < 50; index += 1) {
        assert.equal(app.undo(), true);
    }
    assert.equal(app.undo(), false);
    assert.equal(app.getCurrentCanvas().tasks.length, 1);
    assert.equal(app.getCurrentCanvas().tasks[0].title, "task-0");
});

test("no-op updates preserve timestamps and do not create history entries", () => {
    const app = new Application();
    const canvasId = createCanvas(app, "canvas");
    const taskId = createTask(app, "task", 10, 20);
    const canvas = app.getCurrentCanvas();
    const task = app.getTask(taskId);
    const canvasUpdatedAt = canvas.updatedAt;
    const taskUpdatedAt = task.updatedAt;
    app.historyManager.clear();

    assert.equal(app.updateCanvasTitle(canvasId, "canvas"), true);
    assert.equal(app.updateCanvasPosition(canvasId, 0, 0), true);
    assert.equal(
        app.updateTask(taskId, "task", "description", TaskStatus.NOTSTARTED),
        true,
    );
    assert.equal(app.updateTaskPosition(taskId, 10, 20), true);

    assert.equal(canvas.updatedAt, canvasUpdatedAt);
    assert.equal(task.updatedAt, taskUpdatedAt);
    assert.equal(app.historyManager.canUndo(), false);
});

test("mutating another canvas preserves the current canvas selection", () => {
    const app = new Application();
    const firstCanvasId = createCanvas(app, "first");
    const firstTaskId = createTask(app, "first task");
    createCanvas(app, "second");
    const secondTaskId = createTask(app, "second task");
    app.currentTaskId = secondTaskId;
    app.historyManager.clear();

    assert.equal(app.removeTask(firstTaskId), true);
    assert.equal(app.currentTaskId, secondTaskId);
    assert.equal(app.removeCanvas(firstCanvasId), true);
    assert.equal(app.currentTaskId, secondTaskId);
    assert.equal(app.getTask(secondTaskId)?.title, "second task");
});

test("runtime-invalid task and clipboard values are rejected", () => {
    const app = new Application();
    createCanvas(app, "canvas");
    assert.equal(app.createTaskAt("invalid", "", "unknown", 0, 0), null);

    const taskId = createTask(app, "source");
    assert.equal(app.copyTaskToClipboard(taskId), true);
    app.clipboardState.x = Number.POSITIVE_INFINITY;
    assert.equal(app.clipboardState.hasTask, false);
    assert.equal(app.pasteTask(), false);
});
