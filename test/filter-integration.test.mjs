import assert from "node:assert/strict";
import test from "node:test";

import { Application } from "../dist/application/application.js";
import { TaskStatus } from "../dist/domain/enums.js";

const addTask = (app, title, description, status) => {
    const id = app.createTaskAt(title, description, status, 0, 0);
    assert.ok(id);
    return id;
};

test("Application combines keyword, status, and depth filters", () => {
    const app = new Application();
    app.createCanvas("canvas");
    const rootId = addTask(app, "Report root", "", TaskStatus.COMPLETED);
    const childId = addTask(app, "child", "REPORT details", TaskStatus.COMPLETED);
    const otherId = addTask(app, "Report outside", "", TaskStatus.COMPLETED);
    const progressId = addTask(app, "Report progress", "", TaskStatus.INPROGRESS);

    assert.equal(app.createConnection(rootId, childId), true);
    assert.equal(app.createConnection(childId, progressId), true);

    assert.equal(app.updateSearchText(" report "), true);
    assert.equal(app.updateStatusFilter(TaskStatus.COMPLETED), true);
    assert.equal(app.setDepthFilter(rootId, 1), true);

    const visible = app.getVisibleItems();
    assert.deepEqual(visible.tasks.map(task => task.id), [rootId, childId]);
    assert.equal(visible.connections.length, 1);
    assert.equal(visible.connections[0].parentTaskId, rootId);
    assert.ok(!visible.tasks.some(task => task.id === otherId));
});

test("invalid depth settings preserve the previous filtered view", () => {
    const app = new Application();
    app.createCanvas("canvas");
    const rootId = addTask(app, "root", "", TaskStatus.NOTSTARTED);
    addTask(app, "child", "", TaskStatus.NOTSTARTED);

    assert.equal(app.setDepthFilter(rootId, 0), true);
    const settingsBefore = { ...app.state.viewSettings };
    const visibleBefore = app.getVisibleItems().tasks.map(task => task.id);

    assert.equal(app.setDepthFilter(null, 1), false);
    assert.equal(app.setDepthFilter(rootId, -1), false);
    assert.equal(app.setDepthFilter(rootId, 1.5), false);
    assert.deepEqual({ ...app.state.viewSettings }, settingsBefore);
    assert.deepEqual(app.getVisibleItems().tasks.map(task => task.id), visibleBefore);
});

test("filtering clears hidden selections and creating a task resets all filters", () => {
    const app = new Application();
    app.createCanvas("canvas");
    const hiddenId = addTask(app, "hidden", "", TaskStatus.NOTSTARTED);
    const visibleId = addTask(app, "visible", "", TaskStatus.COMPLETED);
    app.currentTaskId = hiddenId;

    assert.equal(app.updateStatusFilter(TaskStatus.COMPLETED), true);
    assert.equal(app.currentTaskId, null);
    assert.deepEqual(app.getVisibleItems().tasks.map(task => task.id), [visibleId]);

    const createdId = addTask(app, "new", "", TaskStatus.NOTSTARTED);
    assert.deepEqual(app.getVisibleItems().tasks.map(task => task.id), [
        hiddenId,
        visibleId,
        createdId,
    ]);
    assert.equal(app.state.viewSettings.searchText, "");
    assert.equal(app.state.viewSettings.statusFilter, null);
    assert.equal(app.state.viewSettings.depthFilterEnabled, false);
    assert.equal(app.state.viewSettings.depthBaseTaskId, null);
    assert.equal(app.state.viewSettings.maxDepth, null);
});

test("undoing and redoing task creation restores its filter side effects", () => {
    const app = new Application();
    app.createCanvas("canvas");
    const rootId = addTask(app, "root", "", TaskStatus.COMPLETED);
    app.historyManager.clear();

    assert.equal(app.updateSearchText("root"), true);
    assert.equal(app.updateStatusFilter(TaskStatus.COMPLETED), true);
    assert.equal(app.setDepthFilter(rootId, 0), true);
    const filtersBefore = { ...app.state.viewSettings };

    const createdId = addTask(app, "new", "", TaskStatus.NOTSTARTED);
    assert.equal(app.state.viewSettings.depthFilterEnabled, false);
    assert.equal(app.undo(), true);
    assert.equal(app.getTask(createdId), undefined);
    assert.deepEqual({ ...app.state.viewSettings }, filtersBefore);

    assert.equal(app.redo(), true);
    assert.ok(app.getTask(createdId));
    assert.deepEqual(
        { ...app.state.viewSettings },
        {
            searchText: "",
            statusFilter: null,
            depthFilterEnabled: false,
            depthBaseTaskId: null,
            maxDepth: null,
        },
    );
});

test("redo clears selections made invisible by the restored task state", () => {
    const app = new Application();
    app.createCanvas("canvas");
    const taskId = addTask(app, "alpha", "", TaskStatus.NOTSTARTED);
    app.historyManager.clear();

    assert.equal(app.updateSearchText("alpha"), true);
    app.currentTaskId = taskId;
    assert.equal(app.updateTask(taskId, "beta", "", TaskStatus.NOTSTARTED), true);
    assert.equal(app.currentTaskId, null);

    assert.equal(app.undo(), true);
    app.currentTaskId = taskId;
    assert.equal(app.redo(), true);
    assert.deepEqual(app.getVisibleItems().tasks, []);
    assert.equal(app.currentTaskId, null);
});

test("undoing creation clears a depth filter based on the removed task", () => {
    const app = new Application();
    app.createCanvas("canvas");
    app.historyManager.clear();

    const taskId = addTask(app, "task", "", TaskStatus.NOTSTARTED);
    assert.equal(app.setDepthFilter(taskId, 0), true);
    assert.equal(app.undo(), true);

    assert.equal(app.getTask(taskId), undefined);
    assert.deepEqual(
        { ...app.state.viewSettings },
        {
            searchText: "",
            statusFilter: null,
            depthFilterEnabled: false,
            depthBaseTaskId: null,
            maxDepth: null,
        },
    );
});

test("undoing an operation on another canvas does not restore an invalid depth filter", () => {
    const app = new Application();
    app.createCanvas("first");
    const rootId = addTask(app, "root", "", TaskStatus.NOTSTARTED);
    app.historyManager.clear();

    assert.equal(app.setDepthFilter(rootId, 0), true);
    const createdId = addTask(app, "new", "", TaskStatus.NOTSTARTED);
    app.createCanvas("second");

    assert.equal(app.undo(), true);
    assert.equal(app.getTask(createdId), undefined);
    assert.equal(app.state.viewSettings.depthFilterEnabled, false);
    assert.equal(app.state.viewSettings.depthBaseTaskId, null);
    assert.equal(app.state.viewSettings.maxDepth, null);
    assert.deepEqual(app.getVisibleItems().tasks, []);
});

test("redoing deletion clears a changed depth filter based on the deleted task", () => {
    const app = new Application();
    app.createCanvas("canvas");
    const taskId = addTask(app, "task", "", TaskStatus.NOTSTARTED);
    assert.equal(app.setDepthFilter(taskId, 1), true);
    app.historyManager.clear();

    assert.equal(app.removeTask(taskId), true);
    assert.equal(app.undo(), true);
    assert.equal(app.setDepthFilter(taskId, 2), true);
    assert.equal(app.redo(), true);

    assert.equal(app.getTask(taskId), undefined);
    assert.equal(app.state.viewSettings.depthFilterEnabled, false);
    assert.equal(app.state.viewSettings.depthBaseTaskId, null);
    assert.equal(app.state.viewSettings.maxDepth, null);
});

test("depth filtering uses shortest undirected paths in a cyclic graph", () => {
    const app = new Application();
    app.createCanvas("canvas");
    const firstId = addTask(app, "first", "", TaskStatus.NOTSTARTED);
    const secondId = addTask(app, "second", "", TaskStatus.NOTSTARTED);
    const thirdId = addTask(app, "third", "", TaskStatus.NOTSTARTED);
    const fourthId = addTask(app, "fourth", "", TaskStatus.NOTSTARTED);

    assert.equal(app.createConnection(firstId, secondId), true);
    assert.equal(app.createConnection(secondId, thirdId), true);
    assert.equal(app.createConnection(thirdId, firstId), true);
    assert.equal(app.createConnection(thirdId, fourthId), true);

    assert.equal(app.setDepthFilter(firstId, 1), true);
    assert.deepEqual(
        app.getVisibleItems().tasks.map(task => task.id),
        [firstId, secondId, thirdId],
    );
});
