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
    window.openFlatDetailModal("Fsz 1");
    window.toggleFlatEditMode(true);
    
    console.log("Balance A edit display:", window.document.getElementById("flat-edit-balance-a").style.display);
    console.log("Fee A edit wrapper display:", window.document.querySelector("#flat-detail-fee-a + .edit-stat-item").style.display);
    console.log("Ro-stat-item A display:", window.document.getElementById("flat-detail-balance-a").style.display);
} catch (e) {
    console.error("Crash:", e);
}
