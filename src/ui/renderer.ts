import { Application } from "../application/application.js";
import { AppMode, TaskStatus } from "../domain/enums.js";
import { Task } from "../domain/task.js";

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
    readonly saveButton: HTMLButtonElement;
    readonly restoreButton: HTMLButtonElement;
    readonly menuPanel: HTMLElement;
    readonly taskDialog: HTMLDialogElement;
    readonly taskForm: HTMLFormElement;

    private readonly modeIndicator: HTMLElement;
    private readonly taskCount: HTMLElement;
    private readonly dirtyIndicator: HTMLElement;
    private readonly emptyState: HTMLElement;
    private readonly canvasList: HTMLElement;
    private readonly message: HTMLElement;
    private messageTimer: number | null = null;

    constructor(private readonly app: Application) {
        this.viewport = this.required("#viewport", HTMLElement);
        this.canvasWorld = this.required("#canvasWorld", HTMLElement);
        this.connectionLayer = this.required("#connectionLayer", SVGSVGElement);
        this.taskLayer = this.required("#taskLayer", HTMLElement);
        this.canvasTitleInput = this.required("#canvasTitleInput", HTMLInputElement);
        this.addTaskButton = this.required("#addTaskButton", HTMLButtonElement);
        this.editTaskButton = this.required("#editTaskButton", HTMLButtonElement);
        this.connectModeButton = this.required("#connectModeButton", HTMLButtonElement);
        this.saveButton = this.required("#saveButton", HTMLButtonElement);
        this.restoreButton = this.required("#restoreButton", HTMLButtonElement);
        this.menuPanel = this.required("#canvasMenu", HTMLElement);
        this.taskDialog = this.required("#taskDialog", HTMLDialogElement);
        this.taskForm = this.required("#taskForm", HTMLFormElement);
        this.modeIndicator = this.required("#modeIndicator", HTMLElement);
        this.taskCount = this.required("#taskCount", HTMLElement);
        this.dirtyIndicator = this.required("#dirtyIndicator", HTMLElement);
        this.emptyState = this.required("#emptyState", HTMLElement);
        this.canvasList = this.required("#canvasList", HTMLElement);
        this.message = this.required("#message", HTMLElement);
    }

    public render = (): void => {
        const canvas = this.app.getCurrentCanvas();
        const hasCanvas = canvas !== undefined;

        this.canvasTitleInput.disabled = !hasCanvas;
        this.canvasTitleInput.value = canvas?.title ?? "";
        this.addTaskButton.disabled = !hasCanvas || this.app.mode !== AppMode.NORMAL;
        this.editTaskButton.disabled = !hasCanvas
            || this.app.mode !== AppMode.NORMAL
            || !this.app.currentTaskId
            || !this.app.getTask(this.app.currentTaskId);
        this.connectModeButton.disabled = !hasCanvas;
        this.connectModeButton.classList.toggle("is-active", this.app.mode === AppMode.CONNECT);
        this.connectModeButton.setAttribute("aria-pressed", String(this.app.mode === AppMode.CONNECT));
        this.saveButton.disabled = this.app.mode !== AppMode.NORMAL;
        this.restoreButton.disabled = this.app.mode !== AppMode.NORMAL;
        this.modeIndicator.textContent = this.modeLabel();
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

        for (const task of canvas.tasks) {
            this.taskLayer.append(this.createTaskCard(task));
        }
        this.taskCount.textContent = `タスク ${canvas.tasks.length} / 接続 ${canvas.connections.length}`;
        this.updateCanvasTransform();
        this.renderConnections();
    }

    renderConnections = (): void => {
        this.connectionLayer.replaceChildren();
        const canvas = this.app.getCurrentCanvas();
        if (!canvas) return;

        for (const connection of canvas.connections) {
            const parent = this.app.getTask(connection.parentTaskId);
            const child = this.app.getTask(connection.childTaskId);
            const parentElement = this.taskElement(connection.parentTaskId);
            const childElement = this.taskElement(connection.childTaskId);
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

    clientToCanvasPoint = (clientX: number, clientY: number): { x: number; y: number } => {
        const rect = this.viewport.getBoundingClientRect();
        const canvas = this.app.getCurrentCanvas();
        return {
            x: clientX - rect.left - (canvas?.x ?? 0),
            y: clientY - rect.top - (canvas?.y ?? 0),
        };
    }

    openTaskDialog = (task: Task | null = null): void => {
        const title = this.required("#taskDialogTitle", HTMLElement);
        const titleInput = this.required("#taskTitleInput", HTMLInputElement);
        const descriptionInput = this.required("#taskDescriptionInput", HTMLTextAreaElement);
        const statusInput = this.required("#taskStatusInput", HTMLSelectElement);
        const submitButton = this.required("#taskSubmitButton", HTMLButtonElement);
        const error = this.required("#taskFormError", HTMLElement);

        this.taskForm.dataset.taskId = task?.id ?? "";
        title.textContent = task ? "タスクを編集" : "タスクを追加";
        submitButton.textContent = task ? "変更を保存" : "追加";
        titleInput.value = task?.title ?? "";
        descriptionInput.value = task?.description ?? "";
        statusInput.value = task?.status ?? TaskStatus.NOTSTARTED;
        error.textContent = "";
        if (!this.taskDialog.open) this.taskDialog.showModal();
        window.requestAnimationFrame(() => titleInput.focus());
    }

    closeTaskDialog = (): void => {
        if (this.taskDialog.open) this.taskDialog.close();
    }

    showTaskFormError = (text: string): void => {
        this.required("#taskFormError", HTMLElement).textContent = text;
    }

    showMessage = (text: string, kind: "info" | "error" = "info"): void => {
        this.message.textContent = text;
        this.message.dataset.kind = kind;
        this.message.hidden = false;
        if (this.messageTimer !== null) window.clearTimeout(this.messageTimer);
        this.messageTimer = window.setTimeout(() => {
            this.message.hidden = true;
            this.messageTimer = null;
        }, 2800);
    }

    toggleMenu = (force?: boolean): void => {
        const shouldOpen = force ?? this.menuPanel.hidden;
        this.menuPanel.hidden = !shouldOpen;
    }

    private createTaskCard(task: Task): HTMLElement {
        const selected = task.id === this.app.currentTaskId;
        const card = document.createElement("article");
        card.className = `task-card status-${task.status}`;
        card.dataset.taskId = task.id;
        card.tabIndex = 0;
        card.style.transform = `translate(${task.x}px, ${task.y}px)`;
        card.classList.toggle("is-selected", selected);
        card.classList.toggle("is-connection-source", task.id === this.app.connectionParentTaskId);
        card.setAttribute("aria-label", `${task.title}、${STATUS_LABELS[task.status]}`);

        const heading = document.createElement("h2");
        heading.className = "task-title";
        heading.textContent = task.title;

        const badge = document.createElement("span");
        badge.className = "task-status";
        badge.textContent = STATUS_LABELS[task.status];

        card.append(heading, badge);
        if (selected && task.description) {
            const description = document.createElement("p");
            description.className = "task-description";
            description.textContent = task.description;
            card.append(description);
        }
        return card;
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
            this.canvasList.append(button);
        }
    }

    private modeLabel(): string {
        if (this.app.mode === AppMode.CONNECT) {
            return this.app.connectionParentTaskId ? "接続先を選択" : "接続元を選択";
        }
        if (this.app.mode === AppMode.EDIT) return "編集中";
        return "通常モード";
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
