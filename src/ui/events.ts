import { Application } from "../application/application.js";
import { AppMode, TaskStatus } from "../domain/enums.js";
import { Renderer } from "./renderer.js";

type DragState = {
    kind: "task" | "canvas";
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    taskId?: string;
    moved: boolean;
};

export class EventController {
    private drag: DragState | null = null;
    private pendingTaskPosition = { x: 40, y: 40 };

    constructor(
        private readonly app: Application,
        private readonly renderer: Renderer,
    ) {}

    // Bind event listeners to DOM elements and the application state
    public bind = (): void => {

        // Hamburger menu のトグル
        document.querySelector("#hamburger")?.addEventListener("click", event => {
            event.stopPropagation();
            this.renderer.toggleMenu();
        });
        // manu 内のボタンのイベントリスナー
        document.querySelector("#newCanvasButton")?.addEventListener("click", this.createCanvas); // 新規キャンバス作成ボタン
        document.querySelector("#emptyCreateCanvasButton")?.addEventListener("click", this.createCanvas); // キャンバスがないときの新規キャンバス作成ボタン
        this.renderer.addTaskButton.addEventListener("click", () => this.openNewTaskAtViewportCenter()); // 新規タスク作成ボタン
        this.renderer.editTaskButton.addEventListener("click", this.openSelectedTaskEditor); // 選択中タスクの編集ボタン
        this.renderer.connectModeButton.addEventListener("click", this.toggleConnectMode); // 接続モード切替ボタン
        this.renderer.canvasTitleInput.addEventListener("change", this.updateCanvasTitle); // キャンバスタイトルの変更
        document.querySelector("#canvasList")?.addEventListener("click", this.changeCanvas); // キャンバスリストからキャンバスを選択して切替
        
        // ビューポートのイベントリスナー
        // ポインタ操作
        this.renderer.viewport.addEventListener("pointerdown", this.onPointerDown);
        this.renderer.viewport.addEventListener("pointermove", this.onPointerMove);
        this.renderer.viewport.addEventListener("pointerup", this.onPointerUp);
        this.renderer.viewport.addEventListener("pointercancel", this.onPointerUp);
        // ダブルクリック
        this.renderer.viewport.addEventListener("dblclick", this.onDoubleClick);

        // タスクフォーム(タスク追加ダイアログの中身)の確定ボタン
        this.renderer.taskForm.addEventListener("submit", this.saveTask);
        // タスク追加ダイアログのEscキーでのキャンセル
        this.renderer.taskDialog.addEventListener("cancel", () => {
            this.app.setMode(AppMode.NORMAL);
            this.renderer.render();
        });
        // タスク追加ダイアログのキャンセルボタンでのキャンセル
        document.querySelector("#taskCancelButton")?.addEventListener("click", () => {
            this.renderer.closeTaskDialog();
            this.app.setMode(AppMode.NORMAL);
            this.renderer.render();
        });

        // ドキュメント全体のクリックイベントでメニューを閉じる
        document.addEventListener("click", event => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (!this.renderer.menuPanel.contains(target) && !document.querySelector("#hamburger")?.contains(target)) {
                this.renderer.toggleMenu(false);
            }
        });
        
        // キーボード操作
        document.addEventListener("keydown", this.onKeyDown);
    }

    private createCanvas = (): void => {
        this.app.createCanvas();
        this.renderer.toggleMenu(false);
        this.renderer.render();
        this.renderer.canvasTitleInput.focus();
        this.renderer.canvasTitleInput.select();
        this.renderer.showMessage("キャンバスを作成しました");
    }

    private changeCanvas = (event: Event): void => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const button = target.closest<HTMLElement>("[data-canvas-id]");
        const canvasId = button?.dataset.canvasId;
        if (!canvasId || !this.app.changeCanvas(canvasId)) return;
        this.renderer.toggleMenu(false);
        this.renderer.render();
    }

    private updateCanvasTitle = (): void => {
        const canvas = this.app.getCurrentCanvas();
        if (!canvas) return;
        if (!this.app.updateCanvasTitle(canvas.id, this.renderer.canvasTitleInput.value)) {
            this.renderer.canvasTitleInput.value = canvas.title;
            this.renderer.showMessage("キャンバスタイトルを入力してください", "error");
            return;
        }
        this.renderer.render();
    }

    private toggleConnectMode = (): void => {
        if (!this.app.getCurrentCanvas()) return;
        if (this.app.mode === AppMode.CONNECT) {
            this.app.setMode(AppMode.NORMAL);
            this.renderer.showMessage("接続モードを終了しました");
        } else {
            this.app.setMode(AppMode.CONNECT);
            this.app.currentTaskId = null;
            this.app.currentConnectionId = null;
            this.renderer.showMessage("接続元のカードを選んでください");
        }
        this.renderer.render();
    }

    private onPointerDown = (event: PointerEvent): void => {
        if (event.button !== 0 || !this.app.getCurrentCanvas()) return;
        const target = event.target;
        if (!(target instanceof Element)) return;

        const taskElement = target.closest<HTMLElement>(".task-card");
        if (taskElement?.dataset.taskId) {
            event.preventDefault();
            this.handleTaskPointerDown(event, taskElement.dataset.taskId);
            return;
        }

        const connectionElement = target.closest<SVGElement>("[data-connection-id]");
        if (connectionElement?.dataset.connectionId && this.app.mode === AppMode.NORMAL) {
            event.preventDefault();
            this.app.currentConnectionId = connectionElement.dataset.connectionId;
            this.app.currentTaskId = null;
            this.renderer.render();
            return;
        }

        if (this.app.mode !== AppMode.NORMAL) return;
        const canvas = this.app.getCurrentCanvas();
        if (!canvas) return;
        event.preventDefault();
        this.app.currentTaskId = null;
        this.app.currentConnectionId = null;
        this.renderer.render();
        this.drag = {
            kind: "canvas",
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startX: canvas.x,
            startY: canvas.y,
            moved: false,
        };
        this.renderer.viewport.setPointerCapture(event.pointerId);
        this.renderer.viewport.classList.add("is-panning");
    }

    private handleTaskPointerDown(event: PointerEvent, taskId: string): void {
        this.app.currentTaskId = taskId;
        this.app.currentConnectionId = null;

        if (this.app.mode === AppMode.CONNECT) {
            const parentTaskId = this.app.connectionParentTaskId;
            if (!parentTaskId) {
                this.app.connectionParentTaskId = taskId;
                this.renderer.showMessage("次に接続先のカードを選んでください");
            } else if (parentTaskId === taskId) {
                this.renderer.showMessage("同じカード同士は接続できません", "error");
            } else {
                const created = this.app.createConnection(parentTaskId, taskId);
                this.app.connectionParentTaskId = null;
                this.renderer.showMessage(
                    created ? "接続を作成しました" : "同じ向きの接続が既にあります",
                    created ? "info" : "error",
                );
            }
            this.renderer.render();
            return;
        }

        if (this.app.mode !== AppMode.NORMAL) return;
        const task = this.app.getTask(taskId);
        if (!task) return;
        if (!this.app.beginTaskMove(taskId)) return;
        this.renderer.render();
        this.drag = {
            kind: "task",
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startX: task.x,
            startY: task.y,
            taskId,
            moved: false,
        };
        this.renderer.viewport.setPointerCapture(event.pointerId);
    }

    private onPointerMove = (event: PointerEvent): void => {
        if (!this.drag || this.drag.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - this.drag.startClientX;
        const deltaY = event.clientY - this.drag.startClientY;
        if (Math.abs(deltaX) + Math.abs(deltaY) > 2) this.drag.moved = true;
        if (!this.drag.moved) return;

        const x = this.drag.startX + deltaX;
        const y = this.drag.startY + deltaY;
        if (this.drag.kind === "task" && this.drag.taskId) {
            this.app.updateTaskPosition(this.drag.taskId, x, y);
            this.renderer.moveTask(this.drag.taskId, x, y);
        } else {
            const canvas = this.app.getCurrentCanvas();
            if (!canvas) return;
            this.app.updateCanvasPosition(canvas.id, x, y);
            this.renderer.updateCanvasTransform();
        }
    }

    private onPointerUp = (event: PointerEvent): void => {
        if (!this.drag || this.drag.pointerId !== event.pointerId) return;
        if (this.renderer.viewport.hasPointerCapture(event.pointerId)) {
            this.renderer.viewport.releasePointerCapture(event.pointerId);
        }
        const completedDrag = this.drag;
        const moved = completedDrag.moved;
        this.drag = null;
        this.renderer.viewport.classList.remove("is-panning");
        if (completedDrag.kind === "task" && completedDrag.taskId) {
            this.app.finishTaskMove(completedDrag.taskId);
        }
        if (moved) this.renderer.render();
    }

    private onDoubleClick = (event: MouseEvent): void => {
        if (this.app.mode !== AppMode.NORMAL) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        const taskId = target.closest<HTMLElement>(".task-card")?.dataset.taskId;
        if (taskId) {
            event.preventDefault();
            this.app.currentTaskId = taskId;
            this.openSelectedTaskEditor();
            return;
        }
        if (target.closest("[data-connection-id]")) return;
        event.preventDefault();
        this.pendingTaskPosition = this.renderer.clientToCanvasPoint(event.clientX, event.clientY);
        this.renderer.openTaskDialog();
    }

    private openNewTaskAtViewportCenter(): void {
        if (!this.app.getCurrentCanvas() || this.app.mode !== AppMode.NORMAL) return;
        const rect = this.renderer.viewport.getBoundingClientRect();
        this.pendingTaskPosition = this.renderer.clientToCanvasPoint(
            rect.left + rect.width / 2 - 100,
            rect.top + rect.height / 2 - 45,
        );
        this.renderer.openTaskDialog();
    }

    private openSelectedTaskEditor = (): void => {
        if (this.app.mode !== AppMode.NORMAL || !this.app.currentTaskId) return;
        const task = this.app.getTask(this.app.currentTaskId);
        if (!task) return;
        this.app.setMode(AppMode.EDIT);
        this.renderer.openTaskDialog(task);
        this.renderer.render();
    }

    private saveTask = (event: SubmitEvent): void => {
        event.preventDefault();
        const titleInput = document.querySelector("#taskTitleInput");
        const descriptionInput = document.querySelector("#taskDescriptionInput");
        const statusInput = document.querySelector("#taskStatusInput");
        if (!(titleInput instanceof HTMLInputElement)
            || !(descriptionInput instanceof HTMLTextAreaElement)
            || !(statusInput instanceof HTMLSelectElement)) return;

        const title = titleInput.value.trim();
        if (!title) {
            this.renderer.showTaskFormError("タイトルを入力してください");
            titleInput.focus();
            return;
        }
        const status = this.toTaskStatus(statusInput.value);
        if (!status) return;

        const taskId = this.renderer.taskForm.dataset.taskId;
        if (taskId) {
            const updated = this.app.updateTask(taskId, title, descriptionInput.value, status);
            if (!updated) {
                this.renderer.showTaskFormError("タスクを更新できませんでした");
                return;
            }
        } else {
            const createdTaskId = this.app.createTaskAt(
                title,
                descriptionInput.value,
                status,
                this.pendingTaskPosition.x,
                this.pendingTaskPosition.y,
            );
            if (!createdTaskId) {
                this.renderer.showTaskFormError("タスクを作成できませんでした");
                return;
            }
        }
        this.renderer.closeTaskDialog();
        this.app.setMode(AppMode.NORMAL);
        this.renderer.render();
        this.renderer.showMessage(taskId ? "タスクを更新しました" : "タスクを追加しました");
    }

    private onKeyDown = (event: KeyboardEvent): void => {
        const target = event.target;
        const isEditingText = target instanceof HTMLInputElement
            || target instanceof HTMLTextAreaElement
            || target instanceof HTMLSelectElement
            || (target instanceof HTMLElement && target.isContentEditable);

        if (event.key === "Escape") {
            this.renderer.toggleMenu(false);
            if (this.renderer.taskDialog.open) {
                this.renderer.closeTaskDialog();
            }
            if (this.app.mode !== AppMode.NORMAL) {
                this.app.setMode(AppMode.NORMAL);
                this.renderer.render();
            }
            return;
        }
        if (isEditingText) return;

        const modifier = event.ctrlKey || event.metaKey;
        if (modifier && event.key.toLowerCase() === "z") {
            event.preventDefault();
            const succeeded = event.shiftKey ? this.app.redo() : this.app.undo();
            if (succeeded) {
                this.renderer.render();
                this.renderer.showMessage(event.shiftKey ? "操作をやり直しました" : "操作を取り消しました");
            }
            return;
        }
        if (modifier && event.key.toLowerCase() === "y") {
            event.preventDefault();
            if (this.app.redo()) {
                this.renderer.render();
                this.renderer.showMessage("操作をやり直しました");
            }
            return;
        }
        if (modifier
            && event.key.toLowerCase() === "e"
            && this.app.mode === AppMode.NORMAL
            && this.app.currentTaskId) {
            event.preventDefault();
            this.openSelectedTaskEditor();
            return;
        }
        if (modifier && event.key.toLowerCase() === "x") {
            event.preventDefault();
            this.toggleConnectMode();
            return;
        }
        if (modifier && event.key.toLowerCase() === "a") {
            event.preventDefault();
            this.openNewTaskAtViewportCenter();
            return;
        }
        if (event.key === "Delete" && this.app.mode === AppMode.NORMAL) {
            this.deleteSelection();
        }
    }

    private deleteSelection(): void {
        const canvas = this.app.getCurrentCanvas();
        if (!canvas) return;
        if (this.app.currentTaskId) {
            const task = this.app.getTask(this.app.currentTaskId);
            if (!task || !window.confirm(`「${task.title}」を削除しますか？`)) return;
            this.app.removeTask(task.id);
            this.renderer.render();
            return;
        }
        if (this.app.currentConnectionId) {
            if (!window.confirm("選択中の接続を削除しますか？")) return;
            this.app.removeConnection(this.app.currentConnectionId);
            this.renderer.render();
        }
    }

    private toTaskStatus(value: string): TaskStatus | null {
        if (value === TaskStatus.NOTSTARTED
            || value === TaskStatus.INPROGRESS
            || value === TaskStatus.COMPLETED) return value;
        return null;
    }
}
