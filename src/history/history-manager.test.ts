import test from "node:test";
import assert from "node:assert/strict";

import { AppState } from "../application/application.js";
import { Canvas } from "../domain/canvas.js";
import { Task } from "../domain/task.js";
import { HistoryManager } from "./history-manager.js";

test("[P1] Undo後の状態編集が内部状態を破綻させず、正しく履歴が分岐すること", () => {
    const manager = new HistoryManager();

    const s0 = new AppState("v1", [new Canvas("canvas-1", "Canvas 1")], "canvas-1");
    manager.record(s0);

    const s1 = new AppState("v1", [new Canvas("canvas-1", "Canvas 1")], "canvas-1");
    s1.canvases[0]?.tasks.push(new Task("t1", "Task 1"));
    manager.record(s1);

    // Undo 実行 (S0 へ)
    const undoneState = manager.undo();
    assert.ok(undoneState);
    assert.equal(undoneState.canvases[0]?.tasks.length, 0);

    // 返されたオブジェクトを外部で直接ミューテートして書き換え (Task 2 追加)
    undoneState.canvases[0]?.tasks.push(new Task("t2", "Task 2"));
    manager.record(undoneState);

    // 再度 Undo すると 0 件に戻ること
    const undoneAgain = manager.undo();
    assert.ok(undoneAgain);
    assert.equal(undoneAgain.canvases[0]?.tasks.length, 0);

    // Redo すると Task 2 が復元され、Task 1 ではないこと
    const redoneState = manager.redo();
    assert.ok(redoneState);
    assert.equal(redoneState.canvases[0]?.tasks.length, 1);
    assert.equal(redoneState.canvases[0]?.tasks[0]?.title, "Task 2");
});

test("[P1] 検索ワードなどの対象外プロパティの変更が Undo で巻き戻らないこと", () => {
    const manager = new HistoryManager();

    const s0 = new AppState("v1", [new Canvas("canvas-1", "Canvas 1")], "canvas-1");
    (s0 as Record<string, unknown>).searchQuery = "";
    manager.record(s0);

    const s1 = new AppState("v1", [new Canvas("canvas-1", "Canvas 1")], "canvas-1");
    s1.canvases[0]?.tasks.push(new Task("t1", "Task 1"));
    manager.record(s1);

    // 検索ワードを入力（画面上の最新状態）
    const currentStateWithSearch = new AppState("v1", [new Canvas("canvas-1", "Canvas 1")], "canvas-1");
    currentStateWithSearch.canvases[0]?.tasks.push(new Task("t1", "Task 1"));
    (currentStateWithSearch as Record<string, unknown>).searchQuery = "検索キーワード";

    // 最新状態を渡して Undo 実行
    const undoneState = manager.undo(currentStateWithSearch);
    assert.ok(undoneState);

    // タスク追加は Undo されるが、検索ワードは消えずに残っていること
    assert.equal(undoneState.canvases[0]?.tasks.length, 0);
    assert.equal((undoneState as Record<string, unknown>).searchQuery, "検索キーワード");
});

test("配列要素の並び順およびクラスプロトタイプ（メソッド）が完璧に維持されること", () => {
    const manager = new HistoryManager();

    const s0 = new AppState("v1", [new Canvas("canvas-1", "Canvas 1")], "canvas-1");
    const t1 = new Task("t1", "Task 1");
    const t2 = new Task("t2", "Task 2");
    s0.canvases[0]?.tasks.push(t1, t2);
    manager.record(s0);

    // タスクの並び順を逆転 (t2, t1)
    const s1 = new AppState("v1", [new Canvas("canvas-1", "Canvas 1")], "canvas-1");
    s1.canvases[0]?.tasks.push(t2, t1);
    manager.record(s1);

    // Undo 実行
    const undoneState = manager.undo();
    assert.ok(undoneState);

    // インデックス順序が正しく (t1, t2) に復元されていること
    assert.equal(undoneState.canvases[0]?.tasks[0]?.id, "t1");
    assert.equal(undoneState.canvases[0]?.tasks[1]?.id, "t2");

    // クラスのインスタンス・型が保持されていること
    assert.ok(undoneState.canvases[0] instanceof Canvas);
    assert.ok(undoneState.canvases[0]?.tasks[0] instanceof Task);
});