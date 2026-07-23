import { Application } from "../application/application.js";
import type { Connection } from "../domain/connection.js";
import { AppMode, TaskStatus } from "../domain/enums.js";
import type { Task } from "../domain/task.js";

const STATUS_LABELS: Record<TaskStatus, string> = {
    [TaskStatus.NOTSTARTED]: "未着手",
    [TaskStatus.INPROGRESS]: "進行中",
    [TaskStatus.COMPLETED]: "完了",
};

export class Renderer {
    readonly viewport: HTMLElement;
    readonly canvasWorld: HTMLElement;
    readonly connectionLayer: SVGSVGElement;
    readonly taskLayer: HTMLElement;
    readonly canvasTitleInput: HTMLInputElement;
    readonly addTaskButton: HTMLButtonElement;
    readonly editTaskButton: HTMLButtonElement;
    readonly connectModeButton: HTMLButtonElement;
    readonly filterButton: HTMLButtonElement;
    readonly filterPanel: HTMLElement;
    readonly searchInput: HTMLInputElement;
    readonly statusFilterSelect: HTMLSelectElement;
    readonly setDepthBaseButton: HTMLButtonElement;
    readonly maxDepthInput: HTMLInputElement;
    readonly depthFilterCheckbox: HTMLInputElement;
    readonly menuPanel: HTMLElement;
    readonly contextMenu: HTMLElement;
    readonly newCanvasButton: HTMLButtonElement;
    readonly saveButton: HTMLButtonElement;
    readonly restoreButton: HTMLButtonElement;
    readonly deleteCanvasButton: HTMLButtonElement;
    readonly taskDialog: HTMLDialogElement;
    readonly taskForm: HTMLFormElement;
    readonly operationGuideButton: HTMLButtonElement;
    readonly operationGuideDialog: HTMLDialogElement;
    readonly operationGuideCloseButton: HTMLButtonElement;
    readonly operationGuideDoneButton: HTMLButtonElement;

    private readonly modeIndicator: HTMLElement;
    private readonly viewStateIndicator: HTMLElement;
    private readonly taskCount: HTMLElement;
    private readonly dirtyIndicator: HTMLElement;
    private readonly emptyState: HTMLElement;
    private readonly canvasList: HTMLElement;
    private readonly message: HTMLElement;
    private readonly messageText: HTMLElement;
    private readonly messageCloseButton: HTMLButtonElement;
    private readonly depthBaseTaskLabel: HTMLElement;
    private readonly filterError: HTMLElement;

    constructor(private readonly app: Application) {
        this.viewport = this.required("#viewport", HTMLElement);
        this.canvasWorld = this.required("#canvasWorld", HTMLElement);
        this.connectionLayer = this.required("#connectionLayer", SVGSVGElement);
        this.taskLayer = this.required("#taskLayer", HTMLElement);
        this.canvasTitleInput = this.required("#canvasTitleInput", HTMLInputElement);
        this.addTaskButton = this.required("#addTaskButton", HTMLButtonElement);
        this.editTaskButton = this.required("#editTaskButton", HTMLButtonElement);
        this.connectModeButton = this.required("#connectModeButton", HTMLButtonElement);
        this.filterButton = this.required("#filterButton", HTMLButtonElement);
        this.filterPanel = this.required("#filterPanel", HTMLElement);
        this.searchInput = this.required("#searchInput", HTMLInputElement);
        this.statusFilterSelect = this.required("#statusFilterSelect", HTMLSelectElement);
        this.setDepthBaseButton = this.required("#setDepthBaseButton", HTMLButtonElement);
        this.maxDepthInput = this.required("#maxDepthInput", HTMLInputElement);
        this.depthFilterCheckbox = this.required("#depthFilterCheckbox", HTMLInputElement);
        this.menuPanel = this.required("#canvasMenu", HTMLElement);
        this.contextMenu = this.required("#contextMenu", HTMLElement);
        this.newCanvasButton = this.required("#newCanvasButton", HTMLButtonElement);
        this.saveButton = this.required("#saveButton", HTMLButtonElement);
        this.restoreButton = this.required("#restoreButton", HTMLButtonElement);
        this.deleteCanvasButton = this.required("#deleteCanvasButton", HTMLButtonElement);
        this.taskDialog = this.required("#taskDialog", HTMLDialogElement);
        this.taskForm = this.required("#taskForm", HTMLFormElement);
        this.operationGuideButton = this.required("#operationGuideButton", HTMLButtonElement);
        this.operationGuideDialog = this.required("#operationGuideDialog", HTMLDialogElement);
        this.operationGuideCloseButton = this.required(
            "#operationGuideCloseButton",
            HTMLButtonElement,
        );
        this.operationGuideDoneButton = this.required(
            "#operationGuideDoneButton",
            HTMLButtonElement,
        );
        this.modeIndicator = this.required("#modeIndicator", HTMLElement);
        this.viewStateIndicator = this.required("#viewStateIndicator", HTMLElement);
        this.taskCount = this.required("#taskCount", HTMLElement);
        this.dirtyIndicator = this.required("#dirtyIndicator", HTMLElement);
        this.emptyState = this.required("#emptyState", HTMLElement);
        this.canvasList = this.required("#canvasList", HTMLElement);
        this.message = this.required("#message", HTMLElement);
        this.messageText = this.required("#messageText", HTMLElement);
        this.messageCloseButton = this.required("#messageCloseButton", HTMLButtonElement);
        this.depthBaseTaskLabel = this.required("#depthBaseTaskLabel", HTMLElement);
        this.filterError = this.required("#filterError", HTMLElement);
    }

    public render = (): void => {
        const canvas = this.app.getCurrentCanvas();
        const hasCanvas = canvas !== undefined;

        this.canvasTitleInput.disabled = !hasCanvas || this.app.mode !== AppMode.NORMAL;
        this.canvasTitleInput.value = canvas?.title ?? "";
        this.addTaskButton.disabled = !hasCanvas || this.app.mode !== AppMode.NORMAL;
        this.editTaskButton.disabled = !hasCanvas
            || this.app.mode !== AppMode.NORMAL
            || !this.app.currentTaskId
            || !this.app.getTask(this.app.currentTaskId);
        this.connectModeButton.disabled = !hasCanvas || this.app.mode === AppMode.EDIT;
        this.newCanvasButton.disabled = this.app.mode !== AppMode.NORMAL;
        this.saveButton.disabled = this.app.mode !== AppMode.NORMAL;
        this.restoreButton.disabled = this.app.mode !== AppMode.NORMAL;
        this.deleteCanvasButton.disabled = !hasCanvas || this.app.mode !== AppMode.NORMAL;
        this.connectModeButton.classList.toggle("is-active", this.app.mode === AppMode.CONNECT);
        this.connectModeButton.setAttribute("aria-pressed", String(this.app.mode === AppMode.CONNECT));
        this.renderFilterControls(hasCanvas);
        this.modeIndicator.textContent = this.modeLabel();
        const viewStateLabel = this.viewStateLabel();
        this.viewStateIndicator.textContent = viewStateLabel;
        this.viewStateIndicator.title = viewStateLabel;
        this.dirtyIndicator.textContent = this.app.isDirty ? "未保存" : "変更なし";
        this.dirtyIndicator.classList.toggle("is-dirty", this.app.isDirty);
        this.emptyState.hidden = hasCanvas;
        this.canvasWorld.hidden = !hasCanvas;
        this.viewport.classList.toggle("is-empty", !hasCanvas);

        this.renderCanvasList();
        this.taskLayer.replaceChildren();
        this.connectionLayer.replaceChildren();

        if (!canvas) {
            this.taskCount.textContent = "タスク 0";
            this.updateCanvasTransform();
            return;
        }

        const visible = this.app.getVisibleItems();
        for (const task of visible.tasks) {
            this.taskLayer.append(this.createTaskCard(task));
        }
        const statusCounts = {
            [TaskStatus.NOTSTARTED]: 0,
            [TaskStatus.INPROGRESS]: 0,
            [TaskStatus.COMPLETED]: 0,
        };
        for (const task of visible.tasks) {
            statusCounts[task.status] += 1;
        }
        this.taskCount.textContent = [
            `タスク ${visible.tasks.length}`,
            `未着手 ${statusCounts[TaskStatus.NOTSTARTED]}`,
            `進行中 ${statusCounts[TaskStatus.INPROGRESS]}`,
            `完了 ${statusCounts[TaskStatus.COMPLETED]}`,
            `接続 ${visible.connections.length}`,
        ].join(" / ");
        this.updateCanvasTransform();
        this.renderConnections(visible.connections);
    }

    renderConnections = (
        connections: readonly Connection[] = this.app.getVisibleItems().connections,
    ): void => {
        this.connectionLayer.replaceChildren();
        const canvas = this.app.getCurrentCanvas();
        if (!canvas) return;

        const tasksById = new Map(canvas.tasks.map(task => [task.id, task]));
        const elementsByTaskId = new Map(
            [...this.taskLayer.querySelectorAll<HTMLElement>(".task-card")]
                .flatMap(element => element.dataset.taskId
                    ? [[element.dataset.taskId, element] as const]
                    : []),
        );
        for (const connection of connections) {
            const parent = tasksById.get(connection.parentTaskId);
            const child = tasksById.get(connection.childTaskId);
            const parentElement = elementsByTaskId.get(connection.parentTaskId);
            const childElement = elementsByTaskId.get(connection.childTaskId);
            if (!parent || !child || !parentElement || !childElement) continue;

            const startX = parent.x + parentElement.offsetWidth / 2;
            const startY = parent.y + parentElement.offsetHeight / 2;
            const endX = child.x + childElement.offsetWidth / 2;
            const endY = child.y + childElement.offsetHeight / 2;
            const middleX = (startX + endX) / 2;
            const middleY = (startY + endY) / 2;
            const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
            const selected = connection.id === this.app.currentConnectionId;

            const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
            group.dataset.connectionId = connection.id;
            group.classList.toggle("is-selected", selected);

            const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "line");
            this.setLineCoordinates(hitArea, startX, startY, endX, endY);
            hitArea.classList.add("connection-hit");
            hitArea.dataset.connectionId = connection.id;

            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            this.setLineCoordinates(line, startX, startY, endX, endY);
            line.classList.add("connection-line");
            line.dataset.connectionId = connection.id;

            const arrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
            arrow.setAttribute("d", "M -7 -6 L 7 0 L -7 6 Z");
            arrow.setAttribute("transform", `translate(${middleX} ${middleY}) rotate(${angle})`);
            arrow.classList.add("connection-arrow");
            arrow.dataset.connectionId = connection.id;

            group.append(hitArea, line, arrow);
            this.connectionLayer.append(group);
        }
    }

    updateCanvasTransform = (): void => {
        const canvas = this.app.getCurrentCanvas();
        const x = canvas?.x ?? 0;
        const y = canvas?.y ?? 0;
        this.canvasWorld.style.transform = `translate(${x}px, ${y}px)`;
        this.viewport.style.setProperty("--grid-x", `${x}px`);
        this.viewport.style.setProperty("--grid-y", `${y}px`);
    }

    moveTask = (taskId: string, x: number, y: number): void => {
        const element = this.taskElement(taskId);
        if (!element) return;
        element.style.transform = `translate(${x}px, ${y}px)`;
        this.renderConnections();
    }

    updateTaskSelection = (): void => {
        for (const element of this.taskLayer.querySelectorAll<HTMLElement>(".task-card")) {
            const taskId = element.dataset.taskId;
            const selected = taskId === this.app.currentTaskId;
            element.classList.toggle("is-selected", selected);
            element.setAttribute("aria-pressed", String(selected));
        }
        this.editTaskButton.disabled = !this.app.currentTaskId
            || !this.app.getTask(this.app.currentTaskId);
        this.renderConnections();
    }

    clientToCanvasPoint = (clientX: number, clientY: number): { x: number; y: number } => {
        const rect = this.viewport.getBoundingClientRect();
        const canvas = this.app.getCurrentCanvas();
        return {
            x: clientX - rect.left - (canvas?.x ?? 0),
            y: clientY - rect.top - (canvas?.y ?? 0),
        };
    }

    openTaskDialog = (): void => {
        const titleInput = this.required("#taskTitleInput", HTMLInputElement);
        const descriptionInput = this.required("#taskDescriptionInput", HTMLTextAreaElement);
        const statusInput = this.required("#taskStatusInput", HTMLSelectElement);
        const error = this.required("#taskFormError", HTMLElement);

        titleInput.value = "";
        descriptionInput.value = "";
        statusInput.value = TaskStatus.NOTSTARTED;
        error.textContent = "";
        if (!this.taskDialog.open) this.taskDialog.showModal();
        window.requestAnimationFrame(() => titleInput.focus());
    }

    closeTaskDialog = (): void => {
        if (this.taskDialog.open) this.taskDialog.close();
    }

    toggleOperationGuide = (force?: boolean): void => {
        const shouldOpen = force ?? !this.operationGuideDialog.open;
        if (shouldOpen === this.operationGuideDialog.open) {
            this.operationGuideButton.setAttribute("aria-expanded", String(shouldOpen));
            return;
        }
        if (shouldOpen) {
            this.operationGuideDialog.showModal();
            this.operationGuideButton.setAttribute("aria-expanded", "true");
            window.requestAnimationFrame(() => this.operationGuideCloseButton.focus());
            return;
        }
        this.operationGuideDialog.close();
        this.operationGuideButton.setAttribute("aria-expanded", "false");
    }

    showTaskFormError = (text: string): void => {
        this.required("#taskFormError", HTMLElement).textContent = text;
    }

    showMessage = (text: string, kind: "info" | "error" = "info"): void => {
        this.messageText.textContent = text;
        this.message.dataset.kind = kind;
        this.message.hidden = false;
    }

    clearMessage = (): void => {
        this.message.hidden = true;
        this.messageText.textContent = "";
        delete this.message.dataset.kind;
    }

    bindMessageClose = (): void => {
        this.messageCloseButton.addEventListener("click", this.clearMessage);
    }

    toggleMenu = (force?: boolean): void => {
        const shouldOpen = force ?? this.menuPanel.hidden;
        this.menuPanel.hidden = !shouldOpen;
    }

    showContextMenu = (
        kind: "task" | "canvas",
        clientX: number,
        clientY: number,
        taskId: string | null = null,
    ): void => {
        const canvas = this.app.getCurrentCanvas();
        const task = taskId ? this.app.getTask(taskId) : undefined;
        if (!canvas || (kind === "task" && !task)) return;

        this.contextMenu.replaceChildren();
        this.contextMenu.dataset.kind = kind;
        if (task) this.contextMenu.dataset.taskId = task.id;
        else delete this.contextMenu.dataset.taskId;

        const heading = document.createElement("div");
        heading.className = "context-menu-heading";
        heading.textContent = kind === "task" ? task?.title ?? "" : canvas.title;
        this.contextMenu.append(heading);

        const addAction = (action: string, label: string, danger = false): void => {
            const button = document.createElement("button");
            button.type = "button";
            button.role = "menuitem";
            button.dataset.contextAction = action;
            button.className = "context-menu-action";
            button.classList.toggle("danger", danger);
            button.textContent = label;
            this.contextMenu.append(button);
        };

        if (kind === "task" && task) {
            addAction("task-edit", "編集");
            addAction("task-copy", "コピー");
            addAction("task-delete", `「${task.title}」を削除`, true);
        } else {
            addAction("canvas-new-task", "新規タスク登録");
            addAction("canvas-new-canvas", "新規キャンバス作成");
            addAction("canvas-rename", "キャンバスタイトル変更");
            addAction("canvas-delete", `「${canvas.title}」を削除`, true);
            addAction("canvas-restore", "保存状態へ復元");
        }

        this.contextMenu.hidden = false;
        this.contextMenu.style.left = `${clientX}px`;
        this.contextMenu.style.top = `${clientY}px`;
        const rect = this.contextMenu.getBoundingClientRect();
        const left = Math.max(8, Math.min(clientX, window.innerWidth - rect.width - 8));
        const top = Math.max(8, Math.min(clientY, window.innerHeight - rect.height - 8));
        this.contextMenu.style.left = `${left}px`;
        this.contextMenu.style.top = `${top}px`;
        window.requestAnimationFrame(() => {
            this.contextMenu.querySelector<HTMLElement>("[role='menuitem']")?.focus();
        });
    }

    hideContextMenu = (): void => {
        this.contextMenu.hidden = true;
        this.contextMenu.replaceChildren();
        delete this.contextMenu.dataset.kind;
        delete this.contextMenu.dataset.taskId;
    }

    toggleFilterPanel = (force?: boolean): void => {
        const shouldOpen = force ?? this.filterPanel.hidden;
        this.filterPanel.hidden = !shouldOpen;
        this.filterButton.setAttribute("aria-expanded", String(shouldOpen));
        if (shouldOpen) {
            window.requestAnimationFrame(() => this.searchInput.focus());
        }
    }

    showFilterError = (text: string): void => {
        this.filterError.textContent = text;
    }

    private createTaskCard(task: Task): HTMLElement {
        const selected = task.id === this.app.currentTaskId;
        const card = document.createElement("article");
        card.className = `task-card status-${task.status}`;
        card.dataset.taskId = task.id;
        card.style.transform = `translate(${task.x}px, ${task.y}px)`;
        card.classList.toggle("is-selected", selected);
        card.classList.toggle("is-connection-source", task.id === this.app.connectionParentTaskId);
        card.setAttribute("aria-label", `${task.title}、${STATUS_LABELS[task.status]}`);

        if (selected && this.app.mode === AppMode.EDIT) {
            card.tabIndex = -1;
            card.classList.add("is-editing");
            card.append(this.createTaskEditor(task));
            return card;
        }

        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-pressed", String(selected));

        const heading = document.createElement("h2");
        heading.className = "task-title";
        heading.textContent = task.title;

        const badge = document.createElement("span");
        badge.className = "task-status";
        badge.textContent = STATUS_LABELS[task.status];

        card.append(heading, badge);
        if (task.description) {
            const description = document.createElement("p");
            description.className = "task-description";
            description.textContent = task.description;
            card.append(description);
        }
        return card;
    }

    focusTaskEditor = (): void => {
        const input = this.taskLayer.querySelector<HTMLInputElement>(
            ".task-card.is-editing .task-edit-title",
        );
        input?.focus();
        input?.select();
    }

    private createTaskEditor(task: Task): HTMLFormElement {
        const form = document.createElement("form");
        form.className = "task-card-editor";
        form.dataset.taskId = task.id;

        const titleLabel = document.createElement("label");
        titleLabel.textContent = "タイトル";
        const titleInput = document.createElement("input");
        titleInput.className = "task-edit-title";
        titleInput.name = "title";
        titleInput.type = "text";
        titleInput.maxLength = 120;
        titleInput.required = true;
        titleInput.value = task.title;
        titleLabel.append(titleInput);

        const statusLabel = document.createElement("label");
        statusLabel.textContent = "ステータス";
        const statusSelect = document.createElement("select");
        statusSelect.className = "task-edit-status";
        statusSelect.name = "status";
        for (const status of [
            TaskStatus.NOTSTARTED,
            TaskStatus.INPROGRESS,
            TaskStatus.COMPLETED,
        ]) {
            const option = document.createElement("option");
            option.value = status;
            option.textContent = STATUS_LABELS[status];
            option.selected = task.status === status;
            statusSelect.append(option);
        }
        statusLabel.append(statusSelect);

        const descriptionLabel = document.createElement("label");
        descriptionLabel.textContent = "説明";
        const descriptionInput = document.createElement("textarea");
        descriptionInput.className = "task-edit-description";
        descriptionInput.name = "description";
        descriptionInput.rows = 4;
        descriptionInput.value = task.description;
        descriptionLabel.append(descriptionInput);

        const error = document.createElement("p");
        error.className = "task-card-edit-error";
        error.setAttribute("role", "alert");

        const actions = document.createElement("div");
        actions.className = "task-card-edit-actions";
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "button compact";
        cancel.dataset.taskEditAction = "cancel";
        cancel.textContent = "キャンセル";
        const submit = document.createElement("button");
        submit.type = "submit";
        submit.className = "button compact primary";
        submit.textContent = "確定";
        actions.append(cancel, submit);

        form.append(titleLabel, statusLabel, descriptionLabel, error, actions);
        return form;
    }

    private renderCanvasList(): void {
        this.canvasList.replaceChildren();
        for (const canvas of this.app.state.canvases) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "canvas-list-item";
            button.dataset.canvasId = canvas.id;
            button.textContent = canvas.title;
            button.classList.toggle("is-current", canvas.id === this.app.state.currentCanvasId);
            button.disabled = this.app.mode !== AppMode.NORMAL;
            this.canvasList.append(button);
        }
    }

    private renderFilterControls(hasCanvas: boolean): void {
        const settings = this.app.state.viewSettings;
        const filtersActive = settings.searchText.trim() !== ""
            || settings.statusFilter !== null
            || settings.depthFilterEnabled;
        this.filterButton.disabled = !hasCanvas || this.app.mode !== AppMode.NORMAL;
        this.filterButton.classList.toggle("is-active", filtersActive);
        this.filterButton.setAttribute("aria-pressed", String(filtersActive));
        if (!hasCanvas) this.toggleFilterPanel(false);

        this.searchInput.disabled = !hasCanvas || this.app.mode !== AppMode.NORMAL;
        this.searchInput.value = settings.searchText;
        this.statusFilterSelect.disabled = !hasCanvas || this.app.mode !== AppMode.NORMAL;
        this.statusFilterSelect.value = settings.statusFilter ?? "";
        this.setDepthBaseButton.disabled = !hasCanvas
            || this.app.mode !== AppMode.NORMAL
            || !this.app.currentTaskId;
        this.maxDepthInput.disabled = !hasCanvas || this.app.mode !== AppMode.NORMAL;
        this.maxDepthInput.value = settings.maxDepth === null ? "" : String(settings.maxDepth);
        this.depthFilterCheckbox.disabled = !hasCanvas || this.app.mode !== AppMode.NORMAL;
        this.depthFilterCheckbox.checked = settings.depthFilterEnabled;

        const canvas = this.app.getCurrentCanvas();
        const baseTask = settings.depthBaseTaskId
            ? canvas?.tasks.find(task => task.id === settings.depthBaseTaskId)
            : undefined;
        this.depthBaseTaskLabel.textContent = baseTask?.title ?? "未設定";
    }

    private modeLabel(): string {
        if (this.app.mode === AppMode.CONNECT) {
            return this.app.connectionParentTaskId ? "接続先を選択" : "接続元を選択";
        }
        if (this.app.mode === AppMode.EDIT) return "編集中";
        return "通常モード";
    }

    private viewStateLabel(): string {
        const settings = this.app.state.viewSettings;
        const search = settings.searchText.trim();
        const searchLabel = search ? `検索: “${search}”` : "検索なし";
        const statusLabel = settings.statusFilter === null
            ? "ステータス: すべて"
            : `ステータス: ${STATUS_LABELS[settings.statusFilter]}`;
        const depthLabel = settings.depthFilterEnabled
            ? `深さ: 有効（${settings.maxDepth ?? 0}）`
            : "深さ: 無効";
        return `${searchLabel} / ${statusLabel} / ${depthLabel}`;
    }

    private taskElement(taskId: string): HTMLElement | null {
        for (const element of this.taskLayer.querySelectorAll<HTMLElement>(".task-card")) {
            if (element.dataset.taskId === taskId) return element;
        }
        return null;
    }

    private setLineCoordinates(line: SVGLineElement, x1: number, y1: number, x2: number, y2: number): void {
        line.setAttribute("x1", String(x1));
        line.setAttribute("y1", String(y1));
        line.setAttribute("x2", String(x2));
        line.setAttribute("y2", String(y2));
    }

    private required<T extends Element>(selector: string, constructor: { new(): T }): T {
        const element = document.querySelector(selector);
        if (!(element instanceof constructor)) {
            throw new Error(`必要な要素が見つかりません: ${selector}`);
        }
        return element;
    }
}
