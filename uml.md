# UMLクラス図

```mermaid
classDiagram
    class AppState {
        -int version
        -List~Canvas~ canvases
        -String? currentCanvasId
        -ViewSettings viewSettings
    }
    class ViewSettings {
        -String searchText
        -TaskStatus? statusFilter
        -boolean depthFilterEnabled
        -String? depthBaseTaskId
        -int? maxDepth
    }
    
    class AppMode {
        <<enumeration>>
        Normal
        Edit
        Connect
    }
    class TaskStatus {
        <<enumeration>>
        NotStarted
        InProgress
        Completed
    }

    class LocalStorageService {
        <<static class>>
        +save(AppState state): boolean
        +restore(void): RestoreResult
    }
    class RestoreResult {
        -boolean success
        -AppState state
        -String? errorMessage
    }
    class FilterService {
        <<static class>>
        +filterByStatus(List~Task~ tasks, TaskStatus status): List~Task~
        +filterByKeyword(List~Task~ tasks, String keyword): List~Task~
        +filterByDepth(List~Task~ tasks, List~Connection~ connections, Task baseTask, int depth): List~Task~
    }
    class HistoryManager {
        -int maxEntries
        -List~HistoryEntry~ undoStack
        -List~HistoryEntry~ redoStack

        +record(HistoryEntry entry)
        +undo(void): HistoryEntry?
        +redo(void): HistoryEntry?
        +clear(void)
    }
    class HistoryEntry {
        -String type
        -String targetId
        -String? canvasId
        -Object? beforeState
        -Object? afterState
        -List~Connection~? affectedConnections
        -Canvas? affectedCanvas
        -String createdAt
    }
    class ClipboardState {
        -String? sourceTaskId
        -String? sourceCanvasId
        -String? title
        -String? description
        -TaskStatus? status
        -int? x
        -int? y
    }

    class Application{
        -AppMode mode
        -AppState state
        -Canvas? currentCanvas
        -Task? currentTask
        -Connection? currentConnection
        -String? connectionSourceTaskId
        -ClipboardState clipboardState
        -HistoryManager historyManager
        -boolean isDirty

        +setMode(AppMode mode)
        +createCanvas(Canvas canvas)
        +removeCanvas(String canvasId)
        +updateCanvasTitle(String canvasId, String title)
        +updateCanvasPosition(String canvasId, int x, int y)
        +changeCanvas(String canvasId)
        +createTask(Task task)
        +updateTaskAttribute(String taskId, String title, String description, TaskStatus status)
        +updateTaskPosition(String taskId, int x, int y)
        +removeTask(String taskId)
        +createConnection(String parentTaskId, String childTaskId)
        +removeConnection(String connectionId)
        +copyTask(String taskId)
        +pasteTask(void)
        +undo(void)
        +redo(void)
        +updateSearchText(String searchText)
        +updateStatusFilter(TaskStatus? status)
        +setDepthFilter(String baseTaskId, int maxDepth)
        +clearDepthFilter(void)
        +updateViewSettings(ViewSettings viewSettings)
        +save(AppState state): boolean
        +restore(void): RestoreResult
    }
    class Canvas {
        -String id
        -String title
        -List~Task~ tasks
        -List~Connection~ connections
        -int x
        -int y
        -String createdAt
        -String updatedAt
    }
    class Task {
        -String id
        -String title
        -String description
        -TaskStatus status
        -int x
        -int y
        -String createdAt
        -String updatedAt

        +updateTitle(String title)
        +updateDescription(String description)
        +updateStatus(TaskStatus status)
        +updatePosition(int x, int y)
        +updateTimestamps(String updatedAt)
    }
    class Connection {
        -String id
        -String parentTaskId
        -String childTaskId
        -String createdAt
    }


    Application -- AppMode : uses
    Task -- TaskStatus : uses

    AppState "1" *-- "1" ViewSettings : contains
    AppState "1" *-- "0..*" Canvas : contains

    Application "1" *-- "1" AppState : owns
    Application "1" *-- "1" ClipboardState : owns
    Application "1" *-- "1" HistoryManager : owns

    Application .. LocalStorageService : uses
    Application .. FilterService : uses
    LocalStorageService .. RestoreResult : returns
    RestoreResult "1" o-- "1" AppState : state

    Canvas "1" *-- "0..*" Task : contains
    Canvas "1" *-- "0..*" Connection : contains
    Connection "0..*" --> "1" Task : parentTaskId(ID reference)
    Connection "0..*" --> "1" Task : childTaskId(ID reference)
    HistoryManager "1" *-- "0..50" HistoryEntry : contains
```
