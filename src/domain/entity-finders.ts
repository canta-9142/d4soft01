import { Canvas } from "./canvas.js";
import { Task } from "./task.js";

export const findCanvasById = (
    canvases: readonly Canvas[],
    canvasId: string,
): Canvas | undefined => {
    return canvases.find(canvas => canvas.id === canvasId);
};

export const findCanvasByTaskId = (
    canvases: readonly Canvas[],
    taskId: string,
): Canvas | undefined => {
    return canvases.find(canvas => canvas.tasks.some(task => task.id === taskId));
};

export const findCanvasByConnectionId = (
    canvases: readonly Canvas[],
    connectionId: string,
): Canvas | undefined => {
    return canvases.find(canvas =>
        canvas.connections.some(connection => connection.id === connectionId)
    );
};

export const findTaskById = (
    canvases: readonly Canvas[],
    taskId: string,
): Task | undefined => {
    return findCanvasByTaskId(canvases, taskId)?.tasks.find(task => task.id === taskId);
};
