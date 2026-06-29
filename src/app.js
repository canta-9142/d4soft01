(() => {
  "use strict";

  const STORAGE_KEY = "d4soft01.todoCanvas.state";
  const VERSION = 1;
  const STATUS = {
    NotStarted: "未着手",
    InProgress: "進行中",
    Completed: "完了済み",
  };
  const CARD = { width: 210, height: 80, selectedWidth: 240, selectedHeight: 116 };

  const els = {
    menuButton: document.querySelector("#menuButton"),
    canvasTitleInput: document.querySelector("#canvasTitleInput"),
    addTaskButton: document.querySelector("#addTaskButton"),
    connectModeButton: document.querySelector("#connectModeButton"),
    searchButton: document.querySelector("#searchButton"),
    undoButton: document.querySelector("#undoButton"),
    redoButton: document.querySelector("#redoButton"),
    saveButton: document.querySelector("#saveButton"),
    statusSummary: document.querySelector("#statusSummary"),
    modeSummary: document.querySelector("#modeSummary"),
    viewport: document.querySelector("#canvasViewport"),
    world: document.querySelector("#canvasWorld"),
    connectionLayer: document.querySelector("#connectionLayer"),
    taskLayer: document.querySelector("#taskLayer"),
    emptyState: document.querySelector("#emptyState"),
    emptyCreateCanvasButton: document.querySelector("#emptyCreateCanvasButton"),
    searchPanel: document.querySelector("#searchPanel"),
    searchTextInput: document.querySelector("#searchTextInput"),
    statusFilterSelect: document.querySelector("#statusFilterSelect"),
    depthBaseLabel: document.querySelector("#depthBaseLabel"),
    setDepthBaseButton: document.querySelector("#setDepthBaseButton"),
    maxDepthInput: document.querySelector("#maxDepthInput"),
    depthEnabledInput: document.querySelector("#depthEnabledInput"),
    filterError: document.querySelector("#filterError"),
    clearFiltersButton: document.querySelector("#clearFiltersButton"),
    closeSearchButton: document.querySelector("#closeSearchButton"),
    canvasMenu: document.querySelector("#canvasMenu"),
    taskMenu: document.querySelector("#taskMenu"),
    toast: document.querySelector("#toast"),
  };

  const app = {
    mode: "Normal",
    state: createInitialState(),
    isDirty: false,
    selectedTaskId: null,
    selectedConnectionId: null,
    connectionSourceTaskId: null,
    editingTaskId: null,
    clipboard: null,
    undoStack: [],
    redoStack: [],
    drag: null,
    lastTaskPoint: null,
    toastTimer: null,
  };

  function now() {
    return new Date().toISOString();
  }

  function generateId(prefix) {
    const stamp = new Date().toISOString().replace(/\D/g, "");
    const rand = Math.random().toString(16).slice(2, 8);
    return `${prefix}-${stamp}-${rand}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createInitialState() {
    return {
      version: VERSION,
      currentCanvasId: null,
      canvases: [],
      viewSettings: {
        searchText: "",
        statusFilter: null,
        depthFilterEnabled: false,
        depthBaseTaskId: null,
        maxDepth: null,
      },
    };
  }

  function currentCanvas() {
    return app.state.canvases.find((canvas) => canvas.id === app.state.currentCanvasId) || null;
  }

  function findTask(taskId, canvas = currentCanvas()) {
    return canvas ? canvas.tasks.find((task) => task.id === taskId) || null : null;
  }

  function findConnection(connectionId, canvas = currentCanvas()) {
    return canvas ? canvas.connections.find((connection) => connection.id === connectionId) || null : null;
  }

  function pointToCanvas(event) {
    const rect = els.viewport.getBoundingClientRect();
    const canvas = currentCanvas();
    const panX = canvas ? canvas.x : 0;
    const panY = canvas ? canvas.y : 0;
    return {
      x: event.clientX - rect.left - panX,
      y: event.clientY - rect.top - panY,
    };
  }

  function viewportCenterPoint() {
    const canvas = currentCanvas();
    const rect = els.viewport.getBoundingClientRect();
    return {
      x: Math.round(rect.width / 2 - (canvas ? canvas.x : 0) - CARD.width / 2),
      y: Math.round(rect.height / 2 - (canvas ? canvas.y : 0) - CARD.height / 2),
    };
  }

  function setDirty() {
    app.isDirty = true;
    renderHeader();
  }

  function showToast(message, type = "") {
    window.clearTimeout(app.toastTimer);
    els.toast.textContent = message;
    els.toast.className = `toast ${type}`.trim();
    els.toast.hidden = false;
    app.toastTimer = window.setTimeout(() => {
      els.toast.hidden = true;
    }, 3200);
  }

  function setMode(mode) {
    app.mode = mode;
    if (mode !== "Connect") {
      app.connectionSourceTaskId = null;
    }
    if (mode !== "Edit") {
      app.editingTaskId = null;
    }
    closeMenus();
    render();
  }

  function recordHistory(before, after) {
    app.undoStack.push({ before, after, createdAt: now() });
    if (app.undoStack.length > 50) app.undoStack.shift();
    app.redoStack = [];
  }

  function commitChange(before, renderAfter = true) {
    recordHistory(before, clone(app.state));
    setDirty();
    if (renderAfter) render();
  }

  function applyStateSnapshot(state) {
    app.state = clone(state);
    app.selectedTaskId = null;
    app.selectedConnectionId = null;
    app.connectionSourceTaskId = null;
    app.editingTaskId = null;
    app.mode = "Normal";
    render();
  }

  function createCanvas(title = "新規キャンバス") {
    const trimmed = title.trim();
    if (!trimmed) {
      showToast("キャンバスタイトルを入力してください。", "error");
      return;
    }
    const before = clone(app.state);
    const createdAt = now();
    const canvas = {
      id: generateId("canvas"),
      title: trimmed,
      x: 0,
      y: 0,
      tasks: [],
      connections: [],
      createdAt,
      updatedAt: createdAt,
    };
    app.state.canvases.push(canvas);
    app.state.currentCanvasId = canvas.id;
    clearSelection();
    commitChange(before);
  }

  function renameCurrentCanvas(title) {
    const canvas = currentCanvas();
    if (!canvas) return;
    const trimmed = title.trim();
    if (!trimmed) {
      els.canvasTitleInput.value = canvas.title;
      showToast("キャンバスタイトルを入力してください。", "error");
      return;
    }
    if (trimmed === canvas.title) return;
    const before = clone(app.state);
    canvas.title = trimmed;
    canvas.updatedAt = now();
    commitChange(before);
  }

  function deleteCurrentCanvas() {
    const canvas = currentCanvas();
    if (!canvas) return;
    if (!window.confirm(`キャンバス「${canvas.title}」を削除しますか。`)) return;
    const before = clone(app.state);
    const index = app.state.canvases.findIndex((item) => item.id === canvas.id);
    app.state.canvases.splice(index, 1);
    const next = app.state.canvases[index] || app.state.canvases[index - 1] || null;
    app.state.currentCanvasId = next ? next.id : null;
    if (!next) {
      app.state.viewSettings.searchText = "";
      app.state.viewSettings.statusFilter = null;
      app.state.viewSettings.depthFilterEnabled = false;
      app.state.viewSettings.depthBaseTaskId = null;
      app.state.viewSettings.maxDepth = null;
    }
    clearSelection();
    closePanels();
    commitChange(before);
  }

  function changeCanvas(canvasId) {
    if (canvasId === app.state.currentCanvasId) return;
    if (!app.state.canvases.some((canvas) => canvas.id === canvasId)) {
      showToast("切り替え先のキャンバスが見つかりません。", "error");
      return;
    }
    const nextState = clone(app.state);
    nextState.currentCanvasId = canvasId;
    const validation = validateState(nextState);
    if (!validation.ok) {
      showToast(`保存条件を満たさないため切り替えできません: ${validation.message}`, "error");
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      app.state.currentCanvasId = canvasId;
      app.isDirty = false;
      clearSelection();
      render();
      showToast("保存してキャンバスを切り替えました。", "success");
    } catch {
      showToast("localStorageへの保存に失敗したため切り替えできません。", "error");
    }
  }

  function createTaskAt(point) {
    const canvas = currentCanvas();
    if (!canvas) {
      showToast("先にキャンバスを作成してください。", "error");
      return;
    }
    const before = clone(app.state);
    const createdAt = now();
    const task = {
      id: generateId("task"),
      title: "新規タスク",
      description: "",
      status: "NotStarted",
      x: Math.max(0, Math.round(point.x)),
      y: Math.max(0, Math.round(point.y)),
      createdAt,
      updatedAt: createdAt,
    };
    canvas.tasks.push(task);
    resetViewSettings();
    app.selectedTaskId = task.id;
    app.selectedConnectionId = null;
    app.editingTaskId = task.id;
    app.mode = "Edit";
    commitChange(before);
  }

  function updateTask(taskId, values) {
    const canvas = currentCanvas();
    const task = findTask(taskId, canvas);
    if (!task) return false;
    const title = values.title.trim();
    if (!title) {
      showToast("タスクタイトルを入力してください。", "error");
      return false;
    }
    if (!STATUS[values.status]) {
      showToast("ステータスが不正です。", "error");
      return false;
    }
    const before = clone(app.state);
    task.title = title;
    task.description = values.description;
    task.status = values.status;
    task.updatedAt = now();
    app.mode = "Normal";
    app.editingTaskId = null;
    if (!visibleTaskSet().has(task.id)) {
      app.selectedTaskId = null;
    }
    commitChange(before);
    return true;
  }

  function deleteTask(taskId) {
    const canvas = currentCanvas();
    const task = findTask(taskId, canvas);
    if (!task) return;
    if (!window.confirm(`タスク「${task.title}」を削除しますか。`)) return;
    const before = clone(app.state);
    canvas.tasks = canvas.tasks.filter((item) => item.id !== taskId);
    canvas.connections = canvas.connections.filter((connection) => {
      return connection.parentTaskId !== taskId && connection.childTaskId !== taskId;
    });
    if (app.state.viewSettings.depthBaseTaskId === taskId) {
      app.state.viewSettings.depthFilterEnabled = false;
      app.state.viewSettings.depthBaseTaskId = null;
      app.state.viewSettings.maxDepth = null;
    }
    clearSelection();
    commitChange(before);
  }

  function copyTask(taskId) {
    const task = findTask(taskId);
    const canvas = currentCanvas();
    if (!task || !canvas) return;
    app.clipboard = {
      sourceTaskId: task.id,
      sourceCanvasId: canvas.id,
      title: task.title,
      description: task.description,
      status: task.status,
      x: task.x,
      y: task.y,
    };
    showToast("タスクをコピーしました。");
  }

  function pasteTask() {
    const canvas = currentCanvas();
    if (!canvas) return showToast("先にキャンバスを作成してください。", "error");
    if (!app.clipboard) return showToast("貼り付けるタスクがありません。", "error");
    const sourceExists = canvas.id === app.clipboard.sourceCanvasId && findTask(app.clipboard.sourceTaskId, canvas);
    const position = sourceExists ? { x: app.clipboard.x + 24, y: app.clipboard.y + 24 } : viewportCenterPoint();
    const before = clone(app.state);
    const createdAt = now();
    const task = {
      id: generateId("task"),
      title: app.clipboard.title,
      description: app.clipboard.description,
      status: app.clipboard.status,
      x: Math.round(position.x),
      y: Math.round(position.y),
      createdAt,
      updatedAt: createdAt,
    };
    canvas.tasks.push(task);
    app.selectedTaskId = task.id;
    app.selectedConnectionId = null;
    commitChange(before);
  }

  function createConnection(parentTaskId, childTaskId) {
    const canvas = currentCanvas();
    if (!canvas) return;
    if (parentTaskId === childTaskId) {
      showToast("同じタスクには接続できません。", "error");
      return;
    }
    const visible = visibleTaskSet();
    if (!visible.has(parentTaskId) || !visible.has(childTaskId)) {
      showToast("表示中のタスク同士だけ接続できます。", "error");
      return;
    }
    if (canvas.connections.some((item) => item.parentTaskId === parentTaskId && item.childTaskId === childTaskId)) {
      showToast("同じ向きの接続が既にあります。", "error");
      return;
    }
    const before = clone(app.state);
    canvas.connections.push({
      id: generateId("connection"),
      parentTaskId,
      childTaskId,
      createdAt: now(),
    });
    app.connectionSourceTaskId = null;
    commitChange(before);
  }

  function deleteConnection(connectionId) {
    const canvas = currentCanvas();
    if (!canvas || !findConnection(connectionId, canvas)) return;
    const before = clone(app.state);
    canvas.connections = canvas.connections.filter((item) => item.id !== connectionId);
    app.selectedConnectionId = null;
    commitChange(before);
  }

  function clearSelection() {
    app.selectedTaskId = null;
    app.selectedConnectionId = null;
    app.connectionSourceTaskId = null;
    app.editingTaskId = null;
    app.mode = "Normal";
  }

  function resetViewSettings() {
    app.state.viewSettings.searchText = "";
    app.state.viewSettings.statusFilter = null;
    app.state.viewSettings.depthFilterEnabled = false;
    app.state.viewSettings.depthBaseTaskId = null;
    app.state.viewSettings.maxDepth = null;
  }

  function visibleTaskSet() {
    const canvas = currentCanvas();
    if (!canvas) return new Set();
    return new Set(getVisibleTasks(canvas).map((task) => task.id));
  }

  function getVisibleTasks(canvas) {
    const settings = app.state.viewSettings;
    let tasks = canvas.tasks.slice();
    const query = settings.searchText.trim().toLowerCase();
    if (query) {
      tasks = tasks.filter((task) => {
        return task.title.toLowerCase().includes(query) || task.description.toLowerCase().includes(query);
      });
    }
    if (settings.statusFilter) {
      tasks = tasks.filter((task) => task.status === settings.statusFilter);
    }
    if (settings.depthFilterEnabled && settings.depthBaseTaskId !== null && Number.isInteger(settings.maxDepth)) {
      const allowed = calculateDepthSet(canvas, settings.depthBaseTaskId, settings.maxDepth);
      tasks = tasks.filter((task) => allowed.has(task.id));
    }
    return tasks;
  }

  function calculateDepthSet(canvas, baseTaskId, maxDepth) {
    if (!canvas.tasks.some((task) => task.id === baseTaskId)) return new Set();
    const neighbors = new Map(canvas.tasks.map((task) => [task.id, []]));
    canvas.connections.forEach((connection) => {
      if (neighbors.has(connection.parentTaskId) && neighbors.has(connection.childTaskId)) {
        neighbors.get(connection.parentTaskId).push(connection.childTaskId);
        neighbors.get(connection.childTaskId).push(connection.parentTaskId);
      }
    });
    const allowed = new Set([baseTaskId]);
    const queue = [{ id: baseTaskId, depth: 0 }];
    while (queue.length) {
      const current = queue.shift();
      if (current.depth >= maxDepth) continue;
      neighbors.get(current.id).forEach((nextId) => {
        if (allowed.has(nextId)) return;
        allowed.add(nextId);
        queue.push({ id: nextId, depth: current.depth + 1 });
      });
    }
    return allowed;
  }

  function validateState(state) {
    if (!state || state.version !== VERSION || !Array.isArray(state.canvases) || typeof state.viewSettings !== "object") {
      return { ok: false, message: "保存形式が不正です。" };
    }
    const canvasIds = new Set();
    const taskIds = new Set();
    const connectionIds = new Set();
    for (const canvas of state.canvases) {
      if (!isNonEmptyString(canvas.id) || canvasIds.has(canvas.id)) return { ok: false, message: "キャンバスIDが不正です。" };
      canvasIds.add(canvas.id);
      if (!isNonEmptyString(canvas.title)) return { ok: false, message: "キャンバスタイトルが空です。" };
      if (!isFiniteNumber(canvas.x) || !isFiniteNumber(canvas.y)) return { ok: false, message: "キャンバス座標が不正です。" };
      if (!isIsoDate(canvas.createdAt) || !isIsoDate(canvas.updatedAt)) return { ok: false, message: "キャンバス日時が不正です。" };
      if (!Array.isArray(canvas.tasks) || !Array.isArray(canvas.connections)) return { ok: false, message: "キャンバス配列が不正です。" };
      const localTaskIds = new Set();
      for (const task of canvas.tasks) {
        if (!isNonEmptyString(task.id) || taskIds.has(task.id)) return { ok: false, message: "タスクIDが不正です。" };
        taskIds.add(task.id);
        localTaskIds.add(task.id);
        if (!isNonEmptyString(task.title)) return { ok: false, message: "タスクタイトルが空です。" };
        if (typeof task.description !== "string") return { ok: false, message: "説明文が不正です。" };
        if (!STATUS[task.status]) return { ok: false, message: "ステータスが不正です。" };
        if (!isFiniteNumber(task.x) || !isFiniteNumber(task.y)) return { ok: false, message: "タスク座標が不正です。" };
        if (!isIsoDate(task.createdAt) || !isIsoDate(task.updatedAt)) return { ok: false, message: "タスク日時が不正です。" };
      }
      const pairs = new Set();
      for (const connection of canvas.connections) {
        if (!isNonEmptyString(connection.id) || connectionIds.has(connection.id)) return { ok: false, message: "接続IDが不正です。" };
        connectionIds.add(connection.id);
        if (!localTaskIds.has(connection.parentTaskId) || !localTaskIds.has(connection.childTaskId)) {
          return { ok: false, message: "接続の参照先が不正です。" };
        }
        if (connection.parentTaskId === connection.childTaskId) return { ok: false, message: "自己接続があります。" };
        const pair = `${connection.parentTaskId}->${connection.childTaskId}`;
        if (pairs.has(pair)) return { ok: false, message: "重複接続があります。" };
        pairs.add(pair);
        if (!isIsoDate(connection.createdAt)) return { ok: false, message: "接続日時が不正です。" };
      }
    }
    if (state.canvases.length === 0 && state.currentCanvasId !== null) return { ok: false, message: "現在キャンバスIDが不正です。" };
    if (state.canvases.length > 0 && !canvasIds.has(state.currentCanvasId)) return { ok: false, message: "現在キャンバスが存在しません。" };
    const settings = state.viewSettings;
    if (typeof settings.searchText !== "string") return { ok: false, message: "検索条件が不正です。" };
    if (settings.statusFilter !== null && !STATUS[settings.statusFilter]) return { ok: false, message: "ステータス絞り込みが不正です。" };
    if (typeof settings.depthFilterEnabled !== "boolean") return { ok: false, message: "深さフィルター設定が不正です。" };
    if (settings.depthFilterEnabled) {
      const canvas = state.canvases.find((item) => item.id === state.currentCanvasId);
      if (!canvas || !canvas.tasks.some((task) => task.id === settings.depthBaseTaskId)) return { ok: false, message: "深さ基準タスクが不正です。" };
      if (!Number.isInteger(settings.maxDepth) || settings.maxDepth < 0) return { ok: false, message: "最大深さが不正です。" };
    }
    return { ok: true };
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function isIsoDate(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(new Date(value).getTime());
  }

  function saveState() {
    const validation = validateState(app.state);
    if (!validation.ok) {
      showToast(`保存失敗: ${validation.message}`, "error");
      return false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(app.state));
      app.isDirty = false;
      renderHeader();
      showToast("保存しました。", "success");
      return true;
    } catch {
      showToast("localStorageへの保存に失敗しました。", "error");
      return false;
    }
  }

  function restoreState(manual = false) {
    if (manual && app.isDirty && !window.confirm("未保存の変更を破棄して復元しますか。")) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      app.state = createInitialState();
      app.isDirty = false;
      app.undoStack = [];
      app.redoStack = [];
      clearSelection();
      render();
      if (manual) showToast("保存データがありません。");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const validation = validateState(parsed);
      if (!validation.ok) throw new Error(validation.message);
      app.state = parsed;
      app.isDirty = false;
      app.undoStack = [];
      app.redoStack = [];
      clearSelection();
      render();
      if (manual) showToast("復元しました。", "success");
    } catch (error) {
      app.state = createInitialState();
      app.isDirty = false;
      app.undoStack = [];
      app.redoStack = [];
      clearSelection();
      render();
      showToast(`復元失敗: ${error.message}`, "error");
    }
  }

  function render() {
    const canvas = currentCanvas();
    if (!canvas) {
      els.world.style.transform = "translate(0px, 0px)";
      els.taskLayer.replaceChildren();
      clearConnections();
      els.emptyState.hidden = false;
    } else {
      els.emptyState.hidden = true;
      els.world.style.transform = `translate(${canvas.x}px, ${canvas.y}px)`;
      ensureSelectionVisible(canvas);
      renderTasks(canvas);
      renderConnections(canvas);
    }
    renderHeader();
    renderSearchPanel();
  }

  function renderHeader() {
    const canvas = currentCanvas();
    els.canvasTitleInput.disabled = !canvas;
    els.canvasTitleInput.value = canvas ? canvas.title : "";
    els.addTaskButton.disabled = !canvas || app.mode === "Edit";
    els.connectModeButton.disabled = !canvas || app.mode === "Edit";
    els.searchButton.disabled = !canvas;
    els.saveButton.disabled = false;
    els.undoButton.disabled = app.undoStack.length === 0;
    els.redoButton.disabled = app.redoStack.length === 0;
    els.connectModeButton.classList.toggle("primary", app.mode === "Connect");
    if (!canvas) {
      els.statusSummary.textContent = "合計 0";
    } else {
      const visible = getVisibleTasks(canvas);
      const counts = countByStatus(visible);
      els.statusSummary.textContent = `合計 ${visible.length} / 未着手 ${counts.NotStarted} / 進行中 ${counts.InProgress} / 完了 ${counts.Completed}`;
    }
    const settings = app.state.viewSettings;
    const modeLabel = app.mode === "Connect" ? "接続モード" : app.mode === "Edit" ? "編集モード" : "通常モード";
    const filters = [];
    if (settings.searchText.trim()) filters.push(`検索「${settings.searchText.trim()}」`);
    if (settings.statusFilter) filters.push(STATUS[settings.statusFilter]);
    if (settings.depthFilterEnabled) filters.push(`深さ${settings.maxDepth}`);
    const dirty = app.isDirty ? "未保存" : "保存済み";
    els.modeSummary.textContent = `${modeLabel} / ${dirty}${filters.length ? " / " + filters.join(" / ") : ""}`;
  }

  function countByStatus(tasks) {
    return tasks.reduce(
      (counts, task) => {
        counts[task.status] += 1;
        return counts;
      },
      { NotStarted: 0, InProgress: 0, Completed: 0 },
    );
  }

  function ensureSelectionVisible(canvas) {
    const visible = visibleTaskSet();
    if (app.selectedTaskId && !visible.has(app.selectedTaskId)) app.selectedTaskId = null;
    if (app.selectedConnectionId && !canvas.connections.some((item) => item.id === app.selectedConnectionId)) {
      app.selectedConnectionId = null;
    }
  }

  function renderTasks(canvas) {
    const visible = new Set(getVisibleTasks(canvas).map((task) => task.id));
    const fragment = document.createDocumentFragment();
    canvas.tasks.forEach((task) => {
      if (!visible.has(task.id)) return;
      const card = document.createElement("article");
      card.className = "task-card";
      if (task.status === "Completed") card.classList.add("completed");
      if (task.id === app.selectedTaskId) card.classList.add("selected");
      if (task.id === app.connectionSourceTaskId) card.classList.add("connect-source");
      card.style.left = `${task.x}px`;
      card.style.top = `${task.y}px`;
      card.dataset.taskId = task.id;

      if (task.id === app.editingTaskId && app.mode === "Edit") {
        appendTaskEditor(card, task);
      } else {
        const title = document.createElement("div");
        title.className = "task-title";
        title.textContent = task.title;
        const meta = document.createElement("div");
        meta.className = "task-meta";
        meta.textContent = STATUS[task.status];
        card.append(title, meta);
        if (task.id === app.selectedTaskId && task.description) {
          const desc = document.createElement("div");
          desc.className = "task-description";
          desc.textContent = task.description;
          card.append(desc);
        }
      }
      fragment.append(card);
    });
    els.taskLayer.replaceChildren(fragment);
  }

  function appendTaskEditor(card, task) {
    const form = document.createElement("form");
    form.className = "task-edit";
    const title = document.createElement("input");
    title.name = "title";
    title.value = task.title;
    title.required = true;
    const status = document.createElement("select");
    status.name = "status";
    Object.entries(STATUS).forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = task.status === value;
      status.append(option);
    });
    const desc = document.createElement("textarea");
    desc.name = "description";
    desc.value = task.description;
    const actions = document.createElement("div");
    actions.className = "task-edit-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "キャンセル";
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "primary";
    submit.textContent = "確定";
    actions.append(cancel, submit);
    form.append(title, status, desc, actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      updateTask(task.id, {
        title: title.value,
        description: desc.value,
        status: status.value,
      });
    });
    cancel.addEventListener("click", () => {
      app.mode = "Normal";
      app.editingTaskId = null;
      render();
    });
    card.append(form);
    window.setTimeout(() => title.focus(), 0);
  }

  function renderConnections(canvas) {
    clearConnections();
    const visible = visibleTaskSet();
    const fragment = document.createDocumentFragment();
    canvas.connections.forEach((connection) => {
      if (!visible.has(connection.parentTaskId) || !visible.has(connection.childTaskId)) return;
      const parent = findTask(connection.parentTaskId, canvas);
      const child = findTask(connection.childTaskId, canvas);
      if (!parent || !child) return;
      const start = taskCenter(parent);
      const end = taskCenter(child);
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.dataset.connectionId = connection.id;
      const hit = document.createElementNS("http://www.w3.org/2000/svg", "line");
      hit.setAttribute("class", "connection-hit");
      setLinePosition(hit, start, end);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("class", `connection-line${connection.id === app.selectedConnectionId ? " selected" : ""}`);
      line.setAttribute("marker-mid", connection.id === app.selectedConnectionId ? "url(#arrowSelected)" : "url(#arrow)");
      setLinePosition(line, start, end);
      const mid = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      const points = midArrowPoints(start, end);
      mid.setAttribute("points", points);
      mid.setAttribute("fill", "none");
      mid.setAttribute("stroke", connection.id === app.selectedConnectionId ? "#2F6FEB" : "#9AA0A6");
      mid.setAttribute("stroke-width", connection.id === app.selectedConnectionId ? "3" : "2");
      mid.setAttribute("pointer-events", "none");
      group.append(hit, line, mid);
      fragment.append(group);
    });
    els.connectionLayer.append(fragment);
  }

  function clearConnections() {
    Array.from(els.connectionLayer.querySelectorAll("g")).forEach((node) => node.remove());
  }

  function setLinePosition(line, start, end) {
    line.setAttribute("x1", start.x);
    line.setAttribute("y1", start.y);
    line.setAttribute("x2", end.x);
    line.setAttribute("y2", end.y);
  }

  function taskCenter(task) {
    const selected = task.id === app.selectedTaskId;
    return {
      x: task.x + (selected ? CARD.selectedWidth : CARD.width) / 2,
      y: task.y + (selected ? CARD.selectedHeight : CARD.height) / 2,
    };
  }

  function midArrowPoints(start, end) {
    const mx = (start.x + end.x) / 2;
    const my = (start.y + end.y) / 2;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const size = 8;
    const left = {
      x: mx - Math.cos(angle - Math.PI / 6) * size,
      y: my - Math.sin(angle - Math.PI / 6) * size,
    };
    const right = {
      x: mx - Math.cos(angle + Math.PI / 6) * size,
      y: my - Math.sin(angle + Math.PI / 6) * size,
    };
    return `${left.x},${left.y} ${mx},${my} ${right.x},${right.y}`;
  }

  function renderSearchPanel() {
    const canvas = currentCanvas();
    const settings = app.state.viewSettings;
    els.searchTextInput.value = settings.searchText;
    els.statusFilterSelect.value = settings.statusFilter || "";
    els.maxDepthInput.value = settings.maxDepth ?? "";
    els.depthEnabledInput.checked = settings.depthFilterEnabled;
    const base = canvas && settings.depthBaseTaskId ? findTask(settings.depthBaseTaskId, canvas) : null;
    els.depthBaseLabel.textContent = base ? `基準: ${base.title}` : "基準: 未設定";
    els.setDepthBaseButton.disabled = !app.selectedTaskId || !canvas;
  }

  function openSearchPanel() {
    if (!currentCanvas()) return;
    closeMenus();
    els.searchPanel.hidden = false;
    renderSearchPanel();
    els.searchTextInput.focus();
  }

  function closePanels() {
    els.searchPanel.hidden = true;
    closeMenus();
  }

  function closeMenus() {
    els.canvasMenu.hidden = true;
    els.taskMenu.hidden = true;
  }

  function openCanvasMenu(x, y) {
    closeMenus();
    const menu = els.canvasMenu;
    menu.replaceChildren();
    appendMenuButton(menu, "新規タスク", () => createTaskAt(app.lastTaskPoint || viewportCenterPoint()), !currentCanvas());
    appendMenuButton(menu, "新規キャンバス", () => createCanvas(window.prompt("キャンバスタイトル", "新規キャンバス") || "新規キャンバス"));
    appendMenuButton(menu, "キャンバスタイトル変更", () => {
      const canvas = currentCanvas();
      if (!canvas) return;
      const title = window.prompt("キャンバスタイトル", canvas.title);
      if (title !== null) renameCurrentCanvas(title);
    }, !currentCanvas());
    appendMenuButton(menu, "キャンバス削除", deleteCurrentCanvas, !currentCanvas(), "danger");
    appendMenuButton(menu, "復元", () => restoreState(true));
    if (app.state.canvases.length) {
      const separator = document.createElement("hr");
      menu.append(separator);
      app.state.canvases.forEach((canvas) => {
        appendMenuButton(menu, `${canvas.id === app.state.currentCanvasId ? "✓ " : ""}${canvas.title}`, () => changeCanvas(canvas.id));
      });
    }
    positionMenu(menu, x, y);
  }

  function openTaskMenu(taskId, x, y) {
    closeMenus();
    const menu = els.taskMenu;
    menu.replaceChildren();
    appendMenuButton(menu, "編集", () => startEdit(taskId));
    appendMenuButton(menu, "コピー", () => copyTask(taskId));
    appendMenuButton(menu, "削除", () => deleteTask(taskId), false, "danger");
    positionMenu(menu, x, y);
  }

  function appendMenuButton(menu, label, onClick, disabled = false, className = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.disabled = disabled;
    if (className) button.className = className;
    button.addEventListener("click", () => {
      closeMenus();
      onClick();
    });
    menu.append(button);
  }

  function positionMenu(menu, x, y) {
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.hidden = false;
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${Math.max(8, window.innerWidth - rect.width - 8)}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${Math.max(8, window.innerHeight - rect.height - 8)}px`;
  }

  function startEdit(taskId) {
    const task = findTask(taskId);
    if (!task) return;
    app.selectedTaskId = taskId;
    app.selectedConnectionId = null;
    app.editingTaskId = taskId;
    app.mode = "Edit";
    render();
  }

  function undo() {
    const entry = app.undoStack.pop();
    if (!entry) return;
    app.redoStack.push(entry);
    app.isDirty = true;
    applyStateSnapshot(entry.before);
  }

  function redo() {
    const entry = app.redoStack.pop();
    if (!entry) return;
    app.undoStack.push(entry);
    app.isDirty = true;
    applyStateSnapshot(entry.after);
  }

  function updateSearchText(value) {
    app.state.viewSettings.searchText = value;
    setDirty();
    render();
  }

  function updateStatusFilter(value) {
    app.state.viewSettings.statusFilter = value || null;
    setDirty();
    render();
  }

  function updateDepthEnabled(enabled) {
    els.filterError.textContent = "";
    if (enabled) {
      const baseId = app.state.viewSettings.depthBaseTaskId;
      const maxDepth = Number(els.maxDepthInput.value);
      if (!baseId) {
        els.depthEnabledInput.checked = false;
        els.filterError.textContent = "基準タスクを設定してください。";
        return;
      }
      if (!Number.isInteger(maxDepth) || maxDepth < 0) {
        els.depthEnabledInput.checked = false;
        els.filterError.textContent = "最大深さは0以上の整数です。";
        return;
      }
      app.state.viewSettings.maxDepth = maxDepth;
    }
    app.state.viewSettings.depthFilterEnabled = enabled;
    setDirty();
    render();
  }

  function updateMaxDepth(value) {
    els.filterError.textContent = "";
    if (value === "") {
      app.state.viewSettings.maxDepth = null;
    } else {
      const depth = Number(value);
      if (!Number.isInteger(depth) || depth < 0) {
        els.filterError.textContent = "最大深さは0以上の整数です。";
        return;
      }
      app.state.viewSettings.maxDepth = depth;
    }
    if (app.state.viewSettings.depthFilterEnabled && app.state.viewSettings.maxDepth === null) {
      app.state.viewSettings.depthFilterEnabled = false;
    }
    setDirty();
    render();
  }

  function setDepthBase() {
    if (!app.selectedTaskId) return;
    app.state.viewSettings.depthBaseTaskId = app.selectedTaskId;
    setDirty();
    render();
  }

  function clearFilters() {
    resetViewSettings();
    els.filterError.textContent = "";
    setDirty();
    render();
  }

  function handleTaskClick(taskId) {
    if (app.mode === "Connect") {
      if (!app.connectionSourceTaskId) {
        app.connectionSourceTaskId = taskId;
        app.selectedTaskId = taskId;
        app.selectedConnectionId = null;
        render();
        return;
      }
      createConnection(app.connectionSourceTaskId, taskId);
      return;
    }
    if (app.mode === "Edit") return;
    app.selectedTaskId = taskId;
    app.selectedConnectionId = null;
    render();
  }

  function handlePointerDown(event) {
    if (event.button !== 0) return;
    closeMenus();
    const card = event.target.closest(".task-card");
    const canvas = currentCanvas();
    if (card && canvas && app.mode === "Normal") {
      const task = findTask(card.dataset.taskId, canvas);
      if (!task) return;
      app.selectedTaskId = task.id;
      app.selectedConnectionId = null;
      app.drag = {
        type: "task",
        taskId: task.id,
        startX: event.clientX,
        startY: event.clientY,
        originalX: task.x,
        originalY: task.y,
        before: clone(app.state),
        moved: false,
      };
      card.setPointerCapture(event.pointerId);
      render();
      return;
    }
    if (!card && canvas && app.mode === "Normal" && isCanvasBlankTarget(event.target)) {
      app.selectedTaskId = null;
      app.selectedConnectionId = null;
      app.drag = {
        type: "canvas",
        startX: event.clientX,
        startY: event.clientY,
        originalX: canvas.x,
        originalY: canvas.y,
        before: clone(app.state),
        moved: false,
      };
    }
  }

  function handlePointerMove(event) {
    if (!app.drag) return;
    const canvas = currentCanvas();
    if (!canvas) return;
    const dx = event.clientX - app.drag.startX;
    const dy = event.clientY - app.drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 2) app.drag.moved = true;
    if (app.drag.type === "task") {
      const task = findTask(app.drag.taskId, canvas);
      if (!task) return;
      task.x = Math.max(0, Math.round(app.drag.originalX + dx));
      task.y = Math.max(0, Math.round(app.drag.originalY + dy));
      task.updatedAt = now();
      renderTasks(canvas);
      renderConnections(canvas);
    } else if (app.drag.type === "canvas") {
      canvas.x = Math.round(app.drag.originalX + dx);
      canvas.y = Math.round(app.drag.originalY + dy);
      canvas.updatedAt = now();
      els.world.style.transform = `translate(${canvas.x}px, ${canvas.y}px)`;
    }
  }

  function handlePointerUp() {
    if (!app.drag) return;
    const drag = app.drag;
    app.drag = null;
    if (drag.moved) {
      if (drag.type === "task") {
        recordHistory(drag.before, clone(app.state));
      }
      setDirty();
      render();
    }
  }

  function isCanvasBlankTarget(target) {
    return target === els.viewport || target === els.world || target === els.taskLayer || target === els.connectionLayer;
  }

  function handleKeydown(event) {
    const inputFocused = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);
    if (event.key === "Escape") {
      if (!els.searchPanel.hidden) els.searchPanel.hidden = true;
      closeMenus();
      if (app.mode !== "Normal") setMode("Normal");
      return;
    }
    if (inputFocused && app.mode !== "Edit") return;
    if (app.mode === "Edit" && event.key === "Enter" && document.activeElement.tagName !== "TEXTAREA") {
      const form = document.activeElement.closest("form");
      if (form) {
        event.preventDefault();
        form.requestSubmit();
      }
      return;
    }
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey && event.key === "Delete") {
      if (app.selectedTaskId) deleteTask(app.selectedTaskId);
      else if (app.selectedConnectionId) deleteConnection(app.selectedConnectionId);
      return;
    }
    const ctrl = event.ctrlKey || event.metaKey;
    if (!ctrl && event.shiftKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      switchCanvasByOffset(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (!ctrl) return;
    const key = event.key.toLowerCase();
    if (key === "s") {
      event.preventDefault();
      saveState();
    } else if (key === "a" && !inputFocused) {
      event.preventDefault();
      createTaskAt(viewportCenterPoint());
    } else if (key === "x" && !inputFocused) {
      event.preventDefault();
      setMode(app.mode === "Connect" ? "Normal" : "Connect");
    } else if (key === "f" && !event.shiftKey) {
      event.preventDefault();
      openSearchPanel();
    } else if (key === "f" && event.shiftKey) {
      event.preventDefault();
      clearFilters();
    } else if (key === "e" && app.selectedTaskId && !inputFocused) {
      event.preventDefault();
      startEdit(app.selectedTaskId);
    } else if (key === "d" && app.selectedTaskId && !inputFocused) {
      event.preventDefault();
      deleteTask(app.selectedTaskId);
    } else if (key === "c" && app.selectedTaskId && !inputFocused) {
      event.preventDefault();
      copyTask(app.selectedTaskId);
    } else if (key === "v" && !inputFocused) {
      event.preventDefault();
      pasteTask();
    } else if (key === "z" && !inputFocused) {
      event.preventDefault();
      undo();
    } else if (key === "y" && !inputFocused) {
      event.preventDefault();
      redo();
    }
  }

  function switchCanvasByOffset(offset) {
    const index = app.state.canvases.findIndex((canvas) => canvas.id === app.state.currentCanvasId);
    if (index < 0) return;
    const next = app.state.canvases[index + offset];
    if (next) changeCanvas(next.id);
  }

  function bindEvents() {
    els.menuButton.addEventListener("click", (event) => openCanvasMenu(event.clientX, event.clientY));
    els.emptyCreateCanvasButton.addEventListener("click", () => createCanvas());
    els.addTaskButton.addEventListener("click", () => createTaskAt(viewportCenterPoint()));
    els.connectModeButton.addEventListener("click", () => setMode(app.mode === "Connect" ? "Normal" : "Connect"));
    els.searchButton.addEventListener("click", openSearchPanel);
    els.saveButton.addEventListener("click", saveState);
    els.undoButton.addEventListener("click", undo);
    els.redoButton.addEventListener("click", redo);
    els.canvasTitleInput.addEventListener("change", () => renameCurrentCanvas(els.canvasTitleInput.value));
    els.viewport.addEventListener("dblclick", (event) => {
      if (!isCanvasBlankTarget(event.target)) return;
      createTaskAt(pointToCanvas(event));
    });
    els.viewport.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      app.lastTaskPoint = pointToCanvas(event);
      const card = event.target.closest(".task-card");
      if (card) {
        app.selectedTaskId = card.dataset.taskId;
        app.selectedConnectionId = null;
        render();
        openTaskMenu(card.dataset.taskId, event.clientX, event.clientY);
      } else {
        openCanvasMenu(event.clientX, event.clientY);
      }
    });
    els.viewport.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    els.taskLayer.addEventListener("click", (event) => {
      if (app.drag && app.drag.moved) return;
      const card = event.target.closest(".task-card");
      if (!card) {
        if (app.mode === "Normal") {
          app.selectedTaskId = null;
          app.selectedConnectionId = null;
          render();
        }
        return;
      }
      if (event.target.closest("form")) return;
      handleTaskClick(card.dataset.taskId);
    });
    els.taskLayer.addEventListener("dblclick", (event) => {
      const card = event.target.closest(".task-card");
      if (!card) return;
      event.stopPropagation();
      startEdit(card.dataset.taskId);
    });
    els.connectionLayer.addEventListener("click", (event) => {
      const group = event.target.closest("g");
      if (!group || app.mode !== "Normal") return;
      app.selectedConnectionId = group.dataset.connectionId;
      app.selectedTaskId = null;
      render();
    });
    els.searchTextInput.addEventListener("input", () => updateSearchText(els.searchTextInput.value));
    els.statusFilterSelect.addEventListener("change", () => updateStatusFilter(els.statusFilterSelect.value));
    els.setDepthBaseButton.addEventListener("click", setDepthBase);
    els.maxDepthInput.addEventListener("input", () => updateMaxDepth(els.maxDepthInput.value));
    els.depthEnabledInput.addEventListener("change", () => updateDepthEnabled(els.depthEnabledInput.checked));
    els.clearFiltersButton.addEventListener("click", clearFilters);
    els.closeSearchButton.addEventListener("click", () => (els.searchPanel.hidden = true));
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".context-menu") && event.target !== els.menuButton) closeMenus();
      if (!event.target.closest("#searchPanel") && event.target !== els.searchButton && !els.searchPanel.hidden) {
        els.searchPanel.hidden = true;
      }
    });
  }

  bindEvents();
  restoreState(false);
})();
