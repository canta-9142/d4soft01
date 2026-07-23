import { Application } from "./application/application.js";
import { EventController } from "./ui/events.js";
import { Renderer } from "./ui/renderer.js";

(() => {
    const app = new Application();
    const restoreResult = app.restore();
    const renderer = new Renderer(app);
    const events = new EventController(app, renderer);

    events.bind();
    renderer.render();
    if (restoreResult.errorMessage) {
        renderer.showMessage(restoreResult.errorMessage, "error");
    }
})();
