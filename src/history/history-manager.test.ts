import test from "node:test";
import assert from "node:assert/strict";

import { AppState } from "../application/application.js";
import { Canvas } from "../domain/canvas.js";
import { Task } from "../domain/task.js";
import { HistoryEntry, HistoryManager } from "./history-manager.js";

test("undo and redo return the recorded before and after states", () => {
    const manager = new HistoryManager();

    const canvas = new Canvas("canvas-1", "Canvas 1");
    const initialState = new AppState("v1", [canvas], "canvas-1");
    const task = new Task("task-1", "Task A");

    const beforeState = new AppState("v1", [new Canvas("canvas-1", "Canvas 1")], "canvas-1");
    const afterState = new AppState("v2", [new Canvas("canvas-1", "Canvas 1")], "canvas-1");
    afterState.canvases[0]?.tasks.push(task);

    manager.record(initialState, new HistoryEntry({
        action: "createTask",
        description: "タスク作成",
        targetId: task.id,
        canvasId: "canvas-1",
        beforeState,
        afterState,
        affectedConnectionIds: [],
        affectedCanvasIds: ["canvas-1"]
    }));

    const undoneState = manager.undo();
    if (undoneState === null) {
        assert.fail("undoneState should not be null");
    }
    assert.equal(undoneState.canvases[0]?.tasks.length, 0);

    const redoneState = manager.redo();
    if (redoneState === null) {
        assert.fail("redoneState should not be null");
    }
    assert.equal(redoneState.canvases[0]?.tasks[0]?.title, "Task A");
});
