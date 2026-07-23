import assert from "node:assert/strict";
import test from "node:test";

import { AppMode } from "../dist/domain/enums.js";
import { EventController } from "../dist/ui/events.js";

class FakeElement {
    constructor(taskId = undefined) {
        this.dataset = taskId ? { taskId } : {};
        this.classList = {
            add() {},
            remove() {},
        };
    }

    closest(selector) {
        return selector === ".task-card" && this.dataset.taskId ? this : null;
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
            viewport: {
                setPointerCapture() {},
                hasPointerCapture: () => true,
                releasePointerCapture() {},
                classList: {
                    add() {},
                    remove() {},
                },
            },
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
        controller.onPointerUp(pointerEvent);
        controller.onPointerDown(pointerEvent);
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
