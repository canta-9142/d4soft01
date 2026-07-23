import assert from "node:assert/strict";
import test from "node:test";

import { AppMode } from "../dist/domain/enums.js";
import { EventController } from "../dist/ui/events.js";

class FakeElement {
    constructor(taskId = undefined) {
        this.dataset = taskId ? { taskId } : {};
        this.capturedPointerId = null;
        this.classList = {
            add() {},
            remove() {},
        };
    }

    setPointerCapture(pointerId) {
        this.capturedPointerId = pointerId;
    }

    hasPointerCapture(pointerId) {
        return this.capturedPointerId === pointerId;
    }

    releasePointerCapture(pointerId) {
        if (this.hasPointerCapture(pointerId)) this.capturedPointerId = null;
    }

    closest(selector) {
        if (selector === ".task-card" && this.dataset.taskId) return this;
        if (selector === "[data-context-action]" && this.dataset.contextAction) return this;
        return null;
    }
}

test("selecting a task keeps its card mounted so double-click can open the editor", () => {
    const originalElement = globalThis.Element;
    const originalHTMLElement = globalThis.HTMLElement;
    const originalSVGElement = globalThis.SVGElement;
    const originalWindow = globalThis.window;
    globalThis.Element = FakeElement;
    globalThis.HTMLElement = FakeElement;
    globalThis.SVGElement = FakeElement;
    globalThis.window = {
        requestAnimationFrame(callback) {
            callback();
        },
    };

    try {
        const taskId = "task-1";
        const task = { id: taskId, x: 10, y: 20 };
        const card = new FakeElement(taskId);
        let fullRenderCount = 0;
        let selectionUpdateCount = 0;
        let focusedEditorCount = 0;

        const app = {
            mode: AppMode.NORMAL,
            currentTaskId: null,
            currentConnectionId: null,
            getCurrentCanvas: () => ({}),
            getTask: id => id === taskId ? task : undefined,
            beginTaskMove: () => true,
            finishTaskMove: () => true,
            setMode(mode) {
                this.mode = mode;
            },
        };
        const renderer = {
            viewport: new FakeElement(),
            updateTaskSelection: () => {
                selectionUpdateCount += 1;
            },
            clearMessage() {},
            hideContextMenu() {},
            toggleMenu() {},
            toggleFilterPanel() {},
            focusTaskEditor() {
                focusedEditorCount += 1;
            },
            render: () => {
                fullRenderCount += 1;
            },
        };
        const controller = new EventController(app, renderer);
        const pointerEvent = {
            button: 0,
            pointerId: 1,
            clientX: 100,
            clientY: 100,
            target: card,
            preventDefault() {},
        };

        controller.onPointerDown(pointerEvent);
        assert.equal(card.capturedPointerId, pointerEvent.pointerId);
        assert.equal(renderer.viewport.capturedPointerId, null);
        controller.onPointerUp(pointerEvent);
        controller.onPointerDown(pointerEvent);
        assert.equal(card.capturedPointerId, pointerEvent.pointerId);
        controller.onPointerUp(pointerEvent);

        assert.equal(selectionUpdateCount, 2);
        assert.equal(fullRenderCount, 0);

        controller.onDoubleClick({
            target: card,
            clientX: 100,
            clientY: 100,
            preventDefault() {},
        });

        assert.equal(app.mode, AppMode.EDIT);
        assert.equal(focusedEditorCount, 1);
        assert.equal(fullRenderCount, 1);
    } finally {
        globalThis.Element = originalElement;
        globalThis.HTMLElement = originalHTMLElement;
        globalThis.SVGElement = originalSVGElement;
        if (originalWindow === undefined) delete globalThis.window;
        else globalThis.window = originalWindow;
    }
});

test("canvas menu passes the context-menu position when pasting a copied task", () => {
    const originalElement = globalThis.Element;
    globalThis.Element = FakeElement;

    try {
        let pastedPosition = null;
        let renderCount = 0;
        let message = null;
        const app = {
            pasteTask(position) {
                pastedPosition = position;
                return true;
            },
        };
        const renderer = {
            contextMenu: { dataset: {} },
            hideContextMenu() {},
            render() {
                renderCount += 1;
            },
            showMessage(text, kind) {
                message = { text, kind };
            },
        };
        const controller = new EventController(app, renderer);
        controller.pendingTaskPosition = { x: 120, y: 240 };
        const action = new FakeElement();
        action.dataset.contextAction = "canvas-paste-task";

        controller.onContextMenuAction({ target: action });

        assert.deepEqual(pastedPosition, { x: 120, y: 240 });
        assert.equal(renderCount, 1);
        assert.deepEqual(message, { text: "タスクを貼り付けました", kind: "info" });
    } finally {
        if (originalElement === undefined) delete globalThis.Element;
        else globalThis.Element = originalElement;
    }
});
