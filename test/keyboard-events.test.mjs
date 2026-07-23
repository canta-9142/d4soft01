import assert from "node:assert/strict";
import test from "node:test";

import { AppMode } from "../dist/domain/enums.js";
import { EventController } from "../dist/ui/events.js";

class FakeElement {}
class FakeInput extends FakeElement {}
class FakeTextarea extends FakeElement {}
class FakeSelect extends FakeElement {}

const installDomGlobals = () => {
    const originals = {
        HTMLElement: globalThis.HTMLElement,
        HTMLInputElement: globalThis.HTMLInputElement,
        HTMLTextAreaElement: globalThis.HTMLTextAreaElement,
        HTMLSelectElement: globalThis.HTMLSelectElement,
        window: globalThis.window,
    };
    globalThis.HTMLElement = FakeElement;
    globalThis.HTMLInputElement = FakeInput;
    globalThis.HTMLTextAreaElement = FakeTextarea;
    globalThis.HTMLSelectElement = FakeSelect;
    globalThis.window = { confirm: () => true };
    return () => {
        for (const [name, value] of Object.entries(originals)) {
            if (value === undefined) delete globalThis[name];
            else globalThis[name] = value;
        }
    };
};

const keyboardEvent = (key, options = {}) => {
    let prevented = false;
    return {
        key,
        target: new FakeElement(),
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        isComposing: false,
        preventDefault() {
            prevented = true;
        },
        get prevented() {
            return prevented;
        },
        ...options,
    };
};

const createRenderer = () => ({
    taskDialog: { open: false },
    operationGuideDialog: { open: false },
    taskForm: { requestSubmit() {} },
    toggleMenu() {},
    toggleFilterPanel() {},
    hideContextMenu() {},
    clearMessage() {},
    toggleOperationGuide(force) {
        this.operationGuideDialog.open = force ?? !this.operationGuideDialog.open;
    },
    closeTaskDialog() {
        this.taskDialog.open = false;
    },
    render() {},
    showMessage() {},
});

test("Ctrl+G toggles the operation guide, including while editing text", () => {
    const restoreGlobals = installDomGlobals();
    try {
        const app = {
            mode: AppMode.NORMAL,
            setMode(mode) {
                this.mode = mode;
            },
        };
        const renderer = createRenderer();
        const controller = new EventController(app, renderer);

        const openEvent = keyboardEvent("g", {
            target: new FakeInput(),
            ctrlKey: true,
        });
        controller.onKeyDown(openEvent);
        assert.equal(openEvent.prevented, true);
        assert.equal(renderer.operationGuideDialog.open, true);

        const closeEvent = keyboardEvent("g", { ctrlKey: true });
        controller.onKeyDown(closeEvent);
        assert.equal(closeEvent.prevented, true);
        assert.equal(renderer.operationGuideDialog.open, false);
    } finally {
        restoreGlobals();
    }
});

test("arrow keys select visible tasks and Shift+arrow switches canvases", () => {
    const restoreGlobals = installDomGlobals();
    try {
        const tasks = [{ id: "task-1" }, { id: "task-2" }, { id: "task-3" }];
        const canvases = [{ id: "canvas-1" }, { id: "canvas-2" }, { id: "canvas-3" }];
        const app = {
            mode: AppMode.NORMAL,
            state: {
                canvases,
                currentCanvasId: "canvas-2",
            },
            currentTaskId: "task-2",
            currentConnectionId: "connection-1",
            setMode(mode) {
                this.mode = mode;
            },
            getVisibleItems: () => ({ tasks, connections: [] }),
            changeCanvas(canvasId) {
                this.state.currentCanvasId = canvasId;
                return true;
            },
        };
        let renderCount = 0;
        const renderer = {
            ...createRenderer(),
            render() {
                renderCount += 1;
            },
        };
        const controller = new EventController(app, renderer);

        const nextTask = keyboardEvent("ArrowDown");
        controller.onKeyDown(nextTask);
        assert.equal(nextTask.prevented, true);
        assert.equal(app.currentTaskId, "task-3");
        assert.equal(app.currentConnectionId, null);

        const previousTask = keyboardEvent("ArrowUp");
        controller.onKeyDown(previousTask);
        assert.equal(app.currentTaskId, "task-2");

        const nextCanvas = keyboardEvent("ArrowDown", { shiftKey: true });
        controller.onKeyDown(nextCanvas);
        assert.equal(nextCanvas.prevented, true);
        assert.equal(app.state.currentCanvasId, "canvas-3");

        const previousCanvas = keyboardEvent("ArrowUp", { shiftKey: true });
        controller.onKeyDown(previousCanvas);
        assert.equal(app.state.currentCanvasId, "canvas-2");
        assert.equal(renderCount, 4);
    } finally {
        restoreGlobals();
    }
});

test("Ctrl+D deletes the selected task without opening the browser bookmark action", () => {
    const restoreGlobals = installDomGlobals();
    try {
        let removedTaskId = null;
        const task = { id: "task-1", title: "selected" };
        const app = {
            mode: AppMode.NORMAL,
            state: { canvases: [], currentCanvasId: null },
            currentTaskId: task.id,
            currentConnectionId: null,
            setMode(mode) {
                this.mode = mode;
            },
            getCurrentCanvas: () => ({}),
            getTask: taskId => taskId === task.id ? task : undefined,
            removeTask(taskId) {
                removedTaskId = taskId;
                this.currentTaskId = null;
                return true;
            },
        };
        const controller = new EventController(app, createRenderer());
        const event = keyboardEvent("d", { ctrlKey: true });

        controller.onKeyDown(event);

        assert.equal(event.prevented, true);
        assert.equal(removedTaskId, task.id);
    } finally {
        restoreGlobals();
    }
});

test("Enter submits the new-task form except in the description, while input shortcuts stay native", () => {
    const restoreGlobals = installDomGlobals();
    try {
        let submitCount = 0;
        const app = {
            mode: AppMode.EDIT,
            setMode(mode) {
                this.mode = mode;
            },
        };
        const renderer = {
            ...createRenderer(),
            taskDialog: { open: true },
            taskForm: {
                requestSubmit() {
                    submitCount += 1;
                },
            },
        };
        const controller = new EventController(app, renderer);

        const titleEnter = keyboardEvent("Enter", { target: new FakeInput() });
        controller.onKeyDown(titleEnter);
        assert.equal(titleEnter.prevented, true);
        assert.equal(submitCount, 1);

        const descriptionEnter = keyboardEvent("Enter", { target: new FakeTextarea() });
        controller.onKeyDown(descriptionEnter);
        assert.equal(descriptionEnter.prevented, false);
        assert.equal(submitCount, 1);

        const selectAll = keyboardEvent("a", {
            target: new FakeInput(),
            ctrlKey: true,
        });
        controller.onKeyDown(selectAll);
        assert.equal(selectAll.prevented, false);
        assert.equal(submitCount, 1);

        const escape = keyboardEvent("Escape", { target: new FakeInput() });
        controller.onKeyDown(escape);
        assert.equal(escape.prevented, true);
        assert.equal(renderer.taskDialog.open, false);
        assert.equal(app.mode, AppMode.NORMAL);
    } finally {
        restoreGlobals();
    }
});
