import { Application } from "./application/application.js";
import { EventController } from "./ui/events.js";
import { Renderer } from "./ui/renderer.js";

(() => {
    const app = new Application();
    const renderer = new Renderer(app);
    const events = new EventController(app, renderer);

    events.bind();
    renderer.render();
})();
