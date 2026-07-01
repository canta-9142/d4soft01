export {}

const AppMode = {
    NORMAL: "normal",
    EDIT:"edit",
    CONNECT: "connect",
} as const;
type AppMode = (typeof AppMode)[keyof typeof AppMode];

class AppState {
    version: string = "";
    canvases = new Array<Canvas>();
    currentCanvasId: string = "";
    viewSettings = new ViewSettings();
}

const TaskStatus = {
    NOTSTARTED: "not_started",
    INPROGRESS: "in_progress",
    COMPLETED: "completed",
} as const;
type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

class Task {
    id: string = "";
    title: string = "";
    description: string = "";
    status: TaskStatus = TaskStatus.NOTSTARTED;
    x: number = 0;
    y: number = 0;
    createdAt = new Date();
    updatedAt = new Date();


}

class Canvas {
}

class ViewSettings {
}