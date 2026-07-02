import { TaskStatus } from "./enums";

export class ViewSettings{
    searchText: string = "";
    statusFilter: TaskStatus | null = null;
    depthFilterEnabled: boolean = false;
    depthBaseTaskId: string | null = null;
    maxDepth: number = 0;
};
