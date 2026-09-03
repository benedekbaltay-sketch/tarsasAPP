const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const appJs = fs.readFileSync("app.js", "utf8");

const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/" });
const window = dom.window;

// Mock lucide and alerts
window.lucide = { createIcons: () => {} };
window.alert = console.log;

// Inject app
window.eval(appJs);

try {
    // Attempt to open the modal
    window.openFlatDetailModal("Fsz 1");
    console.log("Success: modal opened without crashing");
    console.log("Modal display style:", window.document.getElementById("flat-detail-modal").style.display);
} catch (e) {
    console.error("Crash during openFlatDetailModal:", e);
}
