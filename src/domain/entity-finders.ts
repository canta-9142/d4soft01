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

export function findTaskById(
    canvases: readonly Canvas[],
    taskId: string,
): Task | undefined;
export function findTaskById(
    tasks: readonly Task[],
    taskId: string,
): Task | undefined;
export function findTaskById(
    source: readonly Canvas[] | readonly Task[],
    taskId: string,
): Task | undefined {
    for (const item of source) {
        if ("tasks" in item) {
            const task = item.tasks.find(candidate => candidate.id === taskId);
            if (task) return task;
        } else if (item.id === taskId) {
            return item;
        }
    }
    return undefined;
}
