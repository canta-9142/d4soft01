import { Application } from "./application/application.js";
import { EventController } from "./ui/events.js";
import { Renderer } from "./ui/renderer.js";

(() => {
    const app = new Application();
    const startupRestore = app.restore();
    const renderer = new Renderer(app);
    const events = new EventController(app, renderer);

    events.bind();
    renderer.render();
    if (!startupRestore.success && startupRestore.errorMessage) {
        renderer.showMessage(`復元に失敗しました: ${startupRestore.errorMessage}`, "error");
    }
})();
