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
        this.renderer.saveButton.addEventListener("click", this.saveState);
        this.renderer.restoreButton.addEventListener("click", this.restoreState);
        this.renderer.deleteCanvasButton.addEventListener("click", this.deleteCurrentCanvas);
        this.renderer.addTaskButton.addEventListener("click", () => this.openNewTaskAtViewportCenter()); // 新規タスク作成ボタン
        this.renderer.editTaskButton.addEventListener("click", this.openSelectedTaskEditor); // 選択中タスクの編集ボタン
        this.renderer.connectModeButton.addEventListener("click", this.toggleConnectMode); // 接続モード切替ボタン
        this.renderer.filterButton.addEventListener("click", event => {
            event.stopPropagation();
            this.renderer.toggleMenu(false);
            this.renderer.showFilterError("");
            this.renderer.toggleFilterPanel();
        });
        this.renderer.searchInput.addEventListener("input", this.updateSearchText);
        this.renderer.statusFilterSelect.addEventListener("change", this.updateStatusFilter);
        this.renderer.setDepthBaseButton.addEventListener("click", this.setSelectedTaskAsDepthBase);
        this.renderer.maxDepthInput.addEventListener("input", this.updateEnabledDepthFilter);
        this.renderer.depthFilterCheckbox.addEventListener("change", this.toggleDepthFilter);
        document.querySelector("#clearSearchButton")?.addEventListener("click", this.clearSearchText);
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
            if (!this.renderer.filterPanel.contains(target)
                && !this.renderer.filterButton.contains(target)) {
                this.renderer.toggleFilterPanel(false);
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
        if (!canvasId) return;
        if (!this.app.changeCanvas(canvasId)) {
            this.renderer.showMessage("保存できなかったためキャンバスを切り替えませんでした", "error");
            return;
        }
        this.renderer.toggleMenu(false);
        this.renderer.render();
        this.renderer.showMessage("保存してキャンバスを切り替えました");
    }

    private saveState = (): void => {
        const succeeded = this.app.save();
        this.renderer.toggleMenu(false);
        this.renderer.render();
        this.renderer.showMessage(
            succeeded ? "保存しました" : "保存できませんでした",
            succeeded ? "info" : "error",
        );
    }

    private restoreState = (): void => {
        if (this.app.isDirty
            && !window.confirm("未保存の変更を破棄して、保存状態へ戻しますか？")) return;
        const result = this.app.restore();
        this.renderer.toggleMenu(false);
        this.renderer.toggleFilterPanel(false);
        this.renderer.closeTaskDialog();
        this.renderer.render();
        this.renderer.showMessage(
            result.success ? "保存状態を復元しました" : result.errorMessage ?? "保存データがありません",
            result.success ? "info" : "error",
        );
    }

    private deleteCurrentCanvas = (): void => {
        const canvas = this.app.getCurrentCanvas();
        if (!canvas || !window.confirm(`「${canvas.title}」を削除しますか？`)) return;
        const succeeded = this.app.removeCanvas(canvas.id);
        this.renderer.toggleMenu(false);
        this.renderer.toggleFilterPanel(false);
        this.renderer.render();
        this.renderer.showMessage(
            succeeded ? "キャンバスを削除しました" : "キャンバスを削除できませんでした",
            succeeded ? "info" : "error",
        );
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
        this.renderer.toggleFilterPanel(false);
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

    private updateSearchText = (): void => {
        if (!this.app.updateSearchText(this.renderer.searchInput.value)) return;
        this.renderer.showFilterError("");
        this.renderer.render();
    }

    private updateStatusFilter = (): void => {
        const value = this.renderer.statusFilterSelect.value;
        const status = value === "" ? null : this.toTaskStatus(value);
        if (value !== "" && status === null) return;
        if (!this.app.updateStatusFilter(status)) return;
        this.renderer.showFilterError("");
        this.renderer.render();
    }

    private setSelectedTaskAsDepthBase = (): void => {
        const taskId = this.app.currentTaskId;
        if (!taskId || !this.app.setDepthFilterBaseTask(taskId)) {
            this.renderer.showFilterError("基準にするタスクを選択してください");
            return;
        }
        this.renderer.showFilterError("");
        this.renderer.render();
    }

    private toggleDepthFilter = (): void => {
        if (!this.renderer.depthFilterCheckbox.checked) {
            this.app.clearDepthFilter();
            this.renderer.showFilterError("");
            this.renderer.render();
            return;
        }
        this.applyDepthFilterFromControls();
    }

    private updateEnabledDepthFilter = (): void => {
        if (!this.renderer.depthFilterCheckbox.checked) return;
        this.applyDepthFilterFromControls();
    }

    private applyDepthFilterFromControls(): void {
        const baseTaskId = this.app.state.viewSettings.depthBaseTaskId;
        const depthText = this.renderer.maxDepthInput.value.trim();
        if (!baseTaskId) {
            this.renderer.depthFilterCheckbox.checked = false;
            this.renderer.showFilterError("先に基準タスクを設定してください");
            return;
        }
        if (!/^\d+$/.test(depthText)) {
            this.renderer.showFilterError("最大深さは0以上の整数で入力してください");
            return;
        }
        const maxDepth = Number(depthText);
        if (!Number.isSafeInteger(maxDepth)
            || !this.app.setDepthFilter(baseTaskId, maxDepth)) {
            this.renderer.showFilterError("最大深さと基準タスクを確認してください");
            return;
        }
        this.renderer.showFilterError("");
        this.renderer.render();
    }

    private clearSearchText = (): void => {
        if (!this.app.clearSearchText()) return;
        this.renderer.showFilterError("");
        this.renderer.render();
        this.renderer.searchInput.focus();
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
        // Keep the card DOM node alive between the two clicks. Replacing it here
        // prevents browsers from dispatching dblclick to the task card.
        this.renderer.updateTaskSelection();
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
        const modifier = event.ctrlKey || event.metaKey;

        if (event.key === "Escape") {
            this.renderer.toggleMenu(false);
            this.renderer.toggleFilterPanel(false);
            if (this.renderer.taskDialog.open) {
                this.renderer.closeTaskDialog();
            }
            if (this.app.mode !== AppMode.NORMAL) {
                this.app.setMode(AppMode.NORMAL);
                this.renderer.render();
            }
            return;
        }
        if (modifier
            && event.shiftKey
            && event.key.toLowerCase() === "f"
            && this.app.mode === AppMode.NORMAL) {
            event.preventDefault();
            if (this.app.clearSearchText()) {
                this.renderer.showFilterError("");
                this.renderer.render();
                this.renderer.showMessage("検索条件をクリアしました");
            }
            return;
        }
        if (modifier
            && event.key.toLowerCase() === "f"
            && this.app.mode === AppMode.NORMAL) {
            event.preventDefault();
            if (this.app.getCurrentCanvas()) {
                this.renderer.toggleMenu(false);
                this.renderer.toggleFilterPanel(true);
            }
            return;
        }
        if (modifier && event.key.toLowerCase() === "s" && this.app.mode === AppMode.NORMAL) {
            event.preventDefault();
            this.saveState();
            return;
        }
        if (isEditingText) return;

        if (modifier
            && event.key.toLowerCase() === "c"
            && this.app.mode === AppMode.NORMAL
            && this.app.currentTaskId) {
            event.preventDefault();
            const copied = this.app.copyTaskToClipboard(this.app.currentTaskId);
            this.renderer.showMessage(
                copied ? "タスクをコピーしました" : "タスクをコピーできませんでした",
                copied ? "info" : "error",
            );
            return;
        }
        if (modifier && event.key.toLowerCase() === "v" && this.app.mode === AppMode.NORMAL) {
            event.preventDefault();
            const rect = this.renderer.viewport.getBoundingClientRect();
            const center = this.renderer.clientToCanvasPoint(
                rect.left + rect.width / 2 - 100,
                rect.top + rect.height / 2 - 45,
            );
            const pasted = this.app.pasteTask(center);
            if (pasted) this.renderer.render();
            this.renderer.showMessage(
                pasted ? "タスクを貼り付けました" : "コピーされたタスクがありません",
                pasted ? "info" : "error",
            );
            return;
        }
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
