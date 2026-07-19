import test from "node:test";
import assert from "node:assert/strict";

import { AppState } from "../application/application.js";
import { Canvas } from "../domain/canvas.js";
import { Task } from "../domain/task.js";
import { HistoryEntry, HistoryManager } from "./history-manager.js";

test("undo and redo apply stored transformers to the incoming app state", () => {
    const manager = new HistoryManager();

    const canvas = new Canvas("canvas-1", "Canvas 1");
    const initialState = new AppState("v1", [canvas], "canvas-1");
    const task = new Task("task-1", "Task A");

    manager.record(new HistoryEntry({
        action: "createTask",
        targetId: task.id,
        canvasId: "canvas-1",
        undo: (state) => {
            const targetCanvas = state.canvases[0];
            if (targetCanvas) {
                targetCanvas.tasks = [];
            }
            return state;
        },
        redo: (state) => {
            const targetCanvas = state.canvases[0];
            if (targetCanvas) {
                targetCanvas.tasks.push(task);
            }
            return state;
        }
    }));

    const undoneState = manager.undo(initialState);
    assert.ok(undoneState !== null);
    assert.equal(undoneState.canvases[0]?.tasks.length, 0);

    const redoneState = manager.redo(initialState);
    assert.ok(redoneState !== null);
    assert.equal(redoneState.canvases[0]?.tasks[0]?.title, "Task A");
});
