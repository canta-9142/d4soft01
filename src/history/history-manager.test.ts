import test from "node:test";
import assert from "node:assert/strict";

import { AppState } from "../application/application.js";
import { Canvas } from "../domain/canvas.js";
import { Task } from "../domain/task.js";
import { HistoryManager } from "./history-manager.js";

test("[P1-1] Undo後の編集で履歴分岐が壊れず、参照共有も起きないこと", () => {
    const manager = new HistoryManager();

    // S0 -> タスクt1追加 -> Undo -> タスクt2追加 -> Redo
    const s0 = new AppState("v1", [new Canvas("canvas-1", "Canvas 1")], "canvas-1");
    manager.record(s0);

    const s1 = new AppState("v1", [new Canvas("canvas-1", "Canvas 1")], "canvas-1");
    s1.canvases[0]?.tasks.push(new Task("t1", "Task 1"));
    manager.record(s1);

    // Undo 実行
    const undoneState = manager.undo();
    assert.ok(undoneState);
    assert.equal(undoneState.canvases[0]?.tasks.length, 0);

    // 返されたオブジェクトを直接ミューテートして t2 追加
    undoneState.canvases[0]?.tasks.push(new Task("t2", "Task 2"));
    manager.record(undoneState);

    // Redo しても t1 は復活せず、分岐が保たれていること
    const redoneState = manager.redo(); // 履歴の先端なので null が返る
    assert.equal(redoneState, null);

    // もう一度 Undo すると t2 が消えて空に戻ること
    const undoneAgain = manager.undo();
    assert.ok(undoneAgain);
    assert.equal(undoneAgain.canvases[0]?.tasks.length, 0);
});

test("[P1-2] 取り消し対象外の変更（検索文字列）が Undo で巻き戻らないこと", () => {
    const manager = new HistoryManager();

    const s0 = new AppState("v1", [new Canvas("canvas-1", "Canvas 1")], "canvas-1");
    (s0 as Record<string, unknown>).searchQuery = "";
    manager.record(s0);

    // 検索窓に入力 ＋ タスク追加
    const s1 = new AppState("v1", [new Canvas("canvas-1", "Canvas 1")], "canvas-1");
    s1.canvases[0]?.tasks.push(new Task("t1", "Task 1"));
    (s1 as Record<string, unknown>).searchQuery = "検索キーワード";
    
    // 操作直前・直後の明示的記録
    manager.recordOperation(s0, s1);

    // 最新のUI状態を渡して Undo
    const undoneState = manager.undo(s1);
    assert.ok(undoneState);

    // タスク追加のみ取り消され、検索ワードは最新のまま残ること
    assert.equal(undoneState.canvases[0]?.tasks.length, 0);
    assert.equal((undoneState as Record<string, unknown>).searchQuery, "検索キーワード");
});

test("[P2] キャンバス内のタスク変更時に全キャンバス配列が複製されず差分保存されること", () => {
    const manager = new HistoryManager();

    const canvas1 = new Canvas("canvas-1", "Canvas 1");
    const canvas2 = new Canvas("canvas-2", "Canvas 2");
    const s0 = new AppState("v1", [canvas1, canvas2], "canvas-1");
    manager.record(s0);

    // canvas1 内のタスクのみ変更
    const s1 = new AppState("v1", [new Canvas("canvas-1", "Canvas 1"), new Canvas("canvas-2", "Canvas 2")], "canvas-1");
    s1.canvases[0]?.tasks.push(new Task("t1", "Task 1"));
    manager.record(s1);

    // 保存された Undo 差分を確認
    const undoStack = (manager as unknown as { undoStack: Array<{ undoDiff: Record<string, unknown> }> }).undoStack;
    const undoDiff = undoStack[0]?.undoDiff;

    assert.ok(undoDiff);
    const canvasesDiff = undoDiff.canvases as Record<string, unknown>;

    // 全配列の複製ではなく、インデックス部分差分（__indexDiff__）として軽易に保持されていること
    assert.ok("__indexDiff__" in canvasesDiff);
    assert.ok(!("1" in (canvasesDiff.__indexDiff__ as Record<string, unknown>))); // 変更のない canvas2 (index 1) は差分に含まれないこと
});