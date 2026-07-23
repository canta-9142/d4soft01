import { Canvas } from "./canvas.js";
import { Connection } from "./connection.js";
import type { TaskStatus } from "./enums.js";
import { Task } from "./task.js";

export type TaskSnapshot = Readonly<{
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    x: number;
    y: number;
    createdAt: string;
    updatedAt: string;
}>;

export type ConnectionSnapshot = Readonly<{
    id: string;
    parentTaskId: string;
    childTaskId: string;
    createdAt: string;
}>;

export type CanvasSnapshot = Readonly<{
    id: string;
    title: string;
    tasks: ReadonlyArray<TaskSnapshot>;
    connections: ReadonlyArray<ConnectionSnapshot>;
    x: number;
    y: number;
    createdAt: string;
    updatedAt: string;
}>;

export const createTaskSnapshot = (task: Task): TaskSnapshot => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    x: task.x,
    y: task.y,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
});

export const createConnectionSnapshot = (connection: Connection): ConnectionSnapshot => ({
    id: connection.id,
    parentTaskId: connection.parentTaskId,
    childTaskId: connection.childTaskId,
    createdAt: connection.createdAt.toISOString(),
});

export const createCanvasSnapshot = (canvas: Canvas): CanvasSnapshot => ({
    id: canvas.id,
    title: canvas.title,
    tasks: canvas.tasks.map(createTaskSnapshot),
    connections: canvas.connections.map(createConnectionSnapshot),
    x: canvas.x,
    y: canvas.y,
    createdAt: canvas.createdAt.toISOString(),
    updatedAt: canvas.updatedAt.toISOString(),
});

export const applyTaskSnapshot = (task: Task, snapshot: TaskSnapshot): Task =>
    Object.assign(task, {
        id: snapshot.id,
        title: snapshot.title,
        description: snapshot.description,
        status: snapshot.status,
        x: snapshot.x,
        y: snapshot.y,
        createdAt: new Date(snapshot.createdAt),
        updatedAt: new Date(snapshot.updatedAt),
    });

export const restoreTaskSnapshot = (snapshot: TaskSnapshot): Task =>
    applyTaskSnapshot(new Task(snapshot.id), snapshot);

export const restoreConnectionSnapshot = (snapshot: ConnectionSnapshot): Connection =>
    Object.assign(
        new Connection(snapshot.id, snapshot.parentTaskId, snapshot.childTaskId),
        { createdAt: new Date(snapshot.createdAt) },
    );

export const restoreCanvasSnapshot = (snapshot: CanvasSnapshot): Canvas =>
    Object.assign(new Canvas(snapshot.id, snapshot.title, snapshot.x, snapshot.y), {
        tasks: snapshot.tasks.map(restoreTaskSnapshot),
        connections: snapshot.connections.map(restoreConnectionSnapshot),
        createdAt: new Date(snapshot.createdAt),
        updatedAt: new Date(snapshot.updatedAt),
    });
