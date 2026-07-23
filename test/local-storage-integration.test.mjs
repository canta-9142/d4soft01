import assert from "node:assert/strict";
import test from "node:test";

import { Application } from "../dist/application/application.js";
import { TaskStatus } from "../dist/domain/enums.js";
import { Task } from "../dist/domain/task.js";
import {
    LocalStorageService,
    STORAGE_KEY,
} from "../dist/services/local-storage-service.js";

class MemoryStorage {
    values = new Map();
    failWrites = false;

    get length() {
        return this.values.size;
    }

    clear() {
        this.values.clear();
    }

    getItem(key) {
        return this.values.get(key) ?? null;
    }

    key(index) {
        return [...this.values.keys()][index] ?? null;
    }

    removeItem(key) {
        this.values.delete(key);
    }

    setItem(key, value) {
        if (this.failWrites) throw new Error("quota exceeded");
        this.values.set(key, String(value));
    }
}

const withStorage = async callback => {
    const previous = globalThis.localStorage;
    const storage = new MemoryStorage();
    globalThis.localStorage = storage;
    try {
        await callback(storage);
    } finally {
        if (previous === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previous;
    }
};

test("save and restore round-trip rehydrates domain objects and clears transient history", async () => {
    await withStorage(storage => {
        const app = new Application();
        app.createCanvas("canvas");
        const rootId = app.createTaskAt("root", "description", TaskStatus.COMPLETED, 10, 20);
        const childId = app.createTaskAt("child", "", TaskStatus.COMPLETED, 30, 40);
        assert.ok(rootId);
        assert.ok(childId);
        assert.equal(app.createConnection(rootId, childId), true);
        assert.equal(app.updateSearchText("root"), true);
        assert.equal(app.updateStatusFilter(TaskStatus.COMPLETED), true);
        assert.equal(app.setDepthFilter(rootId, 1), true);

        assert.equal(app.save(), true);
        assert.equal(app.isDirty, false);
        assert.equal(STORAGE_KEY, "d4soft01.todoCanvas.state");

        const storedText = storage.getItem(STORAGE_KEY);
        assert.ok(storedText);
        const stored = JSON.parse(storedText);
        assert.equal(stored.version, "1");
        assert.equal(stored.currentCanvasId, app.state.currentCanvasId);
        assert.equal(typeof stored.canvases[0].tasks[0].createdAt, "string");
        assert.equal("sourceTask" in stored, false);

        assert.equal(app.undo(), true);
        assert.equal(app.isDirty, true);
        assert.equal(app.redo(), true);
        assert.equal(app.isDirty, false);

        assert.equal(app.updateTaskTitle(rootId, "changed"), true);
        assert.equal(app.copyTaskToClipboard(rootId), true);
        assert.equal(app.historyManager.canUndo(), true);
        assert.equal(app.restore().success, true);

        const restoredTask = app.getTask(rootId);
        assert.ok(restoredTask instanceof Task);
        assert.ok(restoredTask.createdAt instanceof Date);
        assert.equal(restoredTask.title, "root");
        assert.equal(app.getVisibleItems().tasks.length, 1);
        assert.equal(app.historyManager.canUndo(), false);
        assert.equal(app.historyManager.canRedo(), false);
        assert.equal(app.clipboardState.hasTask, false);
        assert.equal(app.isDirty, false);
    });
});

test("invalid states and malformed stored data are rejected without overwriting storage", async () => {
    await withStorage(storage => {
        const app = new Application();
        app.createCanvas("canvas");
        const taskId = app.createTaskAt("task", "", TaskStatus.NOTSTARTED, 0, 0);
        assert.ok(taskId);

        storage.setItem(STORAGE_KEY, "existing value");
        app.getTask(taskId).x = Number.POSITIVE_INFINITY;
        assert.equal(app.save(), false);
        assert.equal(storage.getItem(STORAGE_KEY), "existing value");

        const invalidText = JSON.stringify({
            version: "99",
            currentCanvasId: null,
            canvases: [],
            viewSettings: {
                searchText: "",
                statusFilter: null,
                depthFilterEnabled: false,
                depthBaseTaskId: null,
                maxDepth: null,
            },
        });
        storage.setItem(STORAGE_KEY, invalidText);
        const result = LocalStorageService.load();
        assert.equal(result.success, false);
        assert.match(result.errorMessage, /バージョン/);
        assert.equal(storage.getItem(STORAGE_KEY), invalidText);
    });
});

test("canvas switching saves the destination atomically and preserves state on write failure", async () => {
    await withStorage(storage => {
        const app = new Application();
        app.createCanvas("first");
        const firstId = app.state.currentCanvasId;
        app.createCanvas("second");
        const secondId = app.state.currentCanvasId;
        assert.ok(firstId);
        assert.ok(secondId);

        assert.equal(app.changeCanvas(firstId), true);
        assert.equal(app.state.currentCanvasId, firstId);
        assert.equal(app.isDirty, false);
        assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).currentCanvasId, firstId);

        app.updateCanvasTitle(firstId, "changed");
        storage.failWrites = true;
        assert.equal(app.changeCanvas(secondId), false);
        assert.equal(app.state.currentCanvasId, firstId);
        assert.equal(app.isDirty, true);
        assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).currentCanvasId, firstId);
    });
});

test("canvas transitions clear depth settings that do not belong to the destination", async () => {
    await withStorage(storage => {
        const app = new Application();
        app.createCanvas("first");
        const firstId = app.state.currentCanvasId;
        const rootId = app.createTaskAt("root", "", TaskStatus.NOTSTARTED, 0, 0);
        app.createCanvas("second");
        const secondId = app.state.currentCanvasId;
        assert.ok(firstId);
        assert.ok(rootId);
        assert.ok(secondId);

        assert.equal(app.changeCanvas(firstId), true);
        assert.equal(app.setDepthFilter(rootId, 1), true);
        assert.equal(app.changeCanvas(secondId), true);
        assert.deepEqual(
            {
                enabled: app.state.viewSettings.depthFilterEnabled,
                base: app.state.viewSettings.depthBaseTaskId,
                maxDepth: app.state.viewSettings.maxDepth,
            },
            { enabled: false, base: null, maxDepth: null },
        );
        assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).currentCanvasId, secondId);

        assert.equal(app.changeCanvas(firstId), true);
        assert.equal(app.setDepthFilter(rootId, 1), true);
        app.createCanvas("third");
        assert.equal(app.state.viewSettings.depthFilterEnabled, false);
        assert.equal(app.state.viewSettings.depthBaseTaskId, null);
        assert.equal(app.state.viewSettings.maxDepth, null);
        assert.equal(app.save(), true);
    });
});

test("nullable depth settings survive a load and save round-trip", async () => {
    await withStorage(storage => {
        const stored = {
            version: "1",
            currentCanvasId: null,
            canvases: [],
            viewSettings: {
                searchText: "",
                statusFilter: null,
                depthFilterEnabled: false,
                depthBaseTaskId: null,
                maxDepth: null,
            },
        };
        storage.setItem(STORAGE_KEY, JSON.stringify(stored));

        const result = LocalStorageService.load();
        assert.equal(result.success, true);
        assert.equal(result.state.viewSettings.maxDepth, null);
        assert.equal(LocalStorageService.save(result.state), true);
        assert.equal(
            JSON.parse(storage.getItem(STORAGE_KEY)).viewSettings.maxDepth,
            null,
        );
    });
});

test("undoing task creation can return exactly to the saved filtered state", async () => {
    await withStorage(() => {
        const app = new Application();
        app.createCanvas("canvas");
        const rootId = app.createTaskAt("root", "", TaskStatus.COMPLETED, 0, 0);
        assert.ok(rootId);
        assert.equal(app.updateSearchText("root"), true);
        assert.equal(app.updateStatusFilter(TaskStatus.COMPLETED), true);
        assert.equal(app.setDepthFilter(rootId, 0), true);
        assert.equal(app.save(), true);

        assert.ok(app.createTaskAt("new", "", TaskStatus.NOTSTARTED, 0, 0));
        assert.equal(app.isDirty, true);
        assert.equal(app.undo(), true);
        assert.equal(app.isDirty, false);
        assert.equal(app.state.viewSettings.searchText, "root");
        assert.equal(app.state.viewSettings.statusFilter, TaskStatus.COMPLETED);
        assert.equal(app.state.viewSettings.depthFilterEnabled, true);
        assert.equal(app.state.viewSettings.depthBaseTaskId, rootId);
        assert.equal(app.state.viewSettings.maxDepth, 0);
    });
});

test("history normalization keeps state saveable after removing a depth base task", async () => {
    await withStorage(() => {
        const app = new Application();
        app.createCanvas("canvas");
        app.historyManager.clear();
        const taskId = app.createTaskAt("task", "", TaskStatus.NOTSTARTED, 0, 0);
        assert.ok(taskId);

        assert.equal(app.setDepthFilter(taskId, 0), true);
        assert.equal(app.undo(), true);
        assert.equal(app.save(), true);
    });
});
