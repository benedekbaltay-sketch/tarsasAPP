const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const appJs = fs.readFileSync("app.js", "utf8");

const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/" });
const window = dom.window;

window.lucide = { createIcons: () => {} };
window.alert = console.log;

window.eval(appJs);

try {
    window.openFlatDetailModal("Fsz 1");
    window.toggleFlatEditMode(true);
    
    // Simulate setting a new balance
    window.document.getElementById("flat-edit-balance-a").value = "5000";
    
    // Create and dispatch submit event
    const form = window.document.getElementById("flat-fee-edit-form");
    const event = new window.Event('submit');
    form.dispatchEvent(event);
    
    console.log("Form submitted. Is modal closed?", window.document.getElementById("flat-detail-modal").style.display);
} catch (e) {
    console.error("Crash:", e);
}
