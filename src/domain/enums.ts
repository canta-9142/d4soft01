export const AppMode = {
    NORMAL: "normal",
    EDIT:"edit",
    CONNECT: "connect",
} as const;
export type AppMode = (typeof AppMode)[keyof typeof AppMode];

export const TaskStatus = {
    NOTSTARTED: "not_started",
    INPROGRESS: "in_progress",
    COMPLETED: "completed",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];