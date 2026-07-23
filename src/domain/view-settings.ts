import type { TaskStatus } from "./enums.js";

export class ViewSettings {
    searchText: string = "";
    statusFilter: TaskStatus | null = null;
    depthFilterEnabled: boolean = false;
    depthBaseTaskId: string | null = null;
    maxDepth: number | null = null;

    resetDepth(): void {
        this.depthFilterEnabled = false;
        this.depthBaseTaskId = null;
        this.maxDepth = null;
    }

    reset(): void {
        this.searchText = "";
        this.statusFilter = null;
        this.resetDepth();
    }
}
