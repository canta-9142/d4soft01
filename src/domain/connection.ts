export class Connection {
    id: string;
    parentTaskId: string;
    childTaskId: string;
    createdAt: string;

    constructor(id: string, parentTaskId: string, childTaskId: string) {
        this.id = id;
        this.parentTaskId = parentTaskId;
        this.childTaskId = childTaskId;
        this.createdAt = new Date().toISOString();
    }
}
