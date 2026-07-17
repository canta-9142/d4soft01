import { AppState } from "../application/application";
import { Canvas } from "../domain/canvas";
import { Task } from "../domain/task";
import { Connection } from "../domain/connection";
import { TaskStatus } from "../domain/enums";

// 有限の数値かどうかを判定する(NaNやInfinity、数値以外の値を弾く)
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// 空欄または空白文字のみでない文字列かどうかを判定する
export function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// TaskStatus(未着手・進行中・完了済み)のいずれかであるかを判定する
export function isValidTaskStatus(value: unknown): value is TaskStatus {
  return (
    value === TaskStatus.NOTSTARTED ||
    value === TaskStatus.INPROGRESS ||
    value === TaskStatus.COMPLETED
    );
}

// タスク単体の形式チェック(ID重複チェックは呼び出し側でまとめて行う)
function isValidTaskShape(task: Task): boolean {
  return (
    isNonBlankString(task.id) &&
    isNonBlankString(task.title) &&
    isValidTaskStatus(task.status) &&
    isFiniteNumber(task.x) &&
    isFiniteNumber(task.y)
    );
}

// 接続単体の形式チェック(参照先タスクの実在チェックは呼び出し側で行う)
function isValidConnectionShape(connection: Connection): boolean {
  return (
    isNonBlankString(connection.id) &&
    isNonBlankString(connection.parentTaskId) &&
    isNonBlankString(connection.childTaskId) &&
    connection.parentTaskId !== connection.childTaskId
    );
}

// キャンバス単体の形式チェック(id, title, x, y, tasks/connections配列の有無)
function isValidCanvasShape(canvas: Canvas): boolean {
  return (
    isNonBlankString(canvas.id) &&
    isNonBlankString(canvas.title) &&
    isFiniteNumber(canvas.x) &&
    isFiniteNumber(canvas.y) &&
    Array.isArray(canvas.tasks) &&
    Array.isArray(canvas.connections)
    );
}

// 配列内にIDの重複がないかどうかを判定する
function hasNoDuplicateIds(ids: string[]): boolean {
  return new Set(ids).size === ids.length;
}

// アプリ状態全体がspec.md 5.9節の保存条件を満たすかどうかを検証する
export function validateAppStateForSave(state: AppState): boolean {
  const canvases = state.canvases;

if (!Array.isArray(canvases)) return false;

// キャンバス単体の形式チェック
for (const canvas of canvases) {
  if (!isValidCanvasShape(canvas)) return false;
}

// キャンバスIDが保存データ全体で重複していないか
const canvasIds = canvases.map(c => c.id);
  if (!hasNoDuplicateIds(canvasIds)) return false;

// タスクID・接続IDは「保存データ全体」で重複してはいけないため、
// 各キャンバスを走査しながら全体分のIDを集めておく
const allTaskIds: string[] = [];
  const allConnectionIds: string[] = [];

for (const canvas of canvases) {
  // タスク単体の形式チェック
  for (const task of canvas.tasks) {
    if (!isValidTaskShape(task)) return false;
  }
  allTaskIds.push(...canvas.tasks.map(t => t.id));

  // このキャンバス内のタスクIDの集合(接続の参照先チェックに使う)
  const taskIdSetInCanvas = new Set(canvas.tasks.map(t => t.id));

  // 接続単体の形式チェック + 参照先タスクがこのキャンバス内に実在するか
  for (const connection of canvas.connections) {
    if (!isValidConnectionShape(connection)) return false;
    if (
      !taskIdSetInCanvas.has(connection.parentTaskId) ||
      !taskIdSetInCanvas.has(connection.childTaskId)
      ) {
      return false;
    }
  }
  allConnectionIds.push(...canvas.connections.map(c => c.id));

  // 同一キャンバス内で「同じ向き・同じ親子ID」の接続が重複していないか
  const directionKeys = canvas.connections.map(
    c => `${c.parentTaskId}->${c.childTaskId}`
    );
  if (!hasNoDuplicateIds(directionKeys)) return false;
}

// タスクID・接続IDが保存データ全体で重複していないか
if (!hasNoDuplicateIds(allTaskIds)) return false;
  if (!hasNoDuplicateIds(allConnectionIds)) return false;

// currentCanvasIdの整合性チェック
// (キャンバスが無ければnull、あれば実在するキャンバスを指していること)
if (canvases.length === 0) {
  if (state.currentCanvasId !== null) return false;
} else {
  if (!canvasIds.includes(state.currentCanvasId as string)) return false;
}

// viewSettings(検索条件・ステータス絞り込み・深さフィルター)の整合性チェック
const viewSettings = state.viewSettings;

if (viewSettings.statusFilter !== null && !isValidTaskStatus(viewSettings.statusFilter)) {
  return false;
}

if (viewSettings.depthFilterEnabled) {
  // 深さフィルターが有効な場合は、現在のキャンバスが存在し、
  // 基準タスクがそのキャンバス内に実在し、最大深さが0以上の整数であること
  const currentCanvas = canvases.find(c => c.id === state.currentCanvasId);
  if (!currentCanvas) return false;

  const baseTaskExists = currentCanvas.tasks.some(
    t => t.id === viewSettings.depthBaseTaskId
    );
  if (!baseTaskExists) return false;

  if (
    !Number.isInteger(viewSettings.maxDepth) ||
    viewSettings.maxDepth < 0
    ) {
    return false;
  }
}

return true;
}
