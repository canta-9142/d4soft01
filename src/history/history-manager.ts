import type { AppState } from "../application/application.js";

export const MAX_HISTORY_ENTRIES = 50;

export class HistoryEntry {
    // A snapshot of the application state at the time the history event was recorded.
    snapshot: AppState | null = null;
    createdAt = new Date();
}

export class HistoryManager {
    private undoStack = new Array<HistoryEntry>();
    private redoStack = new Array<HistoryEntry>();

    // Convert the current application state into a history entry.
    private toHistoryEntry = (state: AppState): HistoryEntry => {
        const entry = new HistoryEntry();
        entry.snapshot = state;
        return entry;
    }

    // Record a new snapshot of the application state.
    public record = (state: AppState): void => {
        const entry = this.toHistoryEntry(state);
        this.undoStack.push(entry);
        if (this.undoStack.length > MAX_HISTORY_ENTRIES) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    // Undo returns the latest history entry and moves it to the redo stack.
    public undo = (): HistoryEntry | null => {
        const entry = this.undoStack.pop();
        if (entry) {
            this.redoStack.push(entry);
        }
        return entry || null;
    }

    // Redo returns the latest undone entry and moves it back to the undo stack.
    public redo = (): HistoryEntry | null => {
        const entry = this.redoStack.pop();
        if (entry) {
            this.undoStack.push(entry);
        }
        return entry || null;
    }

    public clear = (): void => {
        this.undoStack = [];
        this.redoStack = [];
    }
}
