const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
let appJs = fs.readFileSync("app.js", "utf8");
appJs = appJs.replace("let state = {", "window.state = {"); // Make state globally accessible

const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/" });
const window = dom.window;

window.lucide = { createIcons: () => {} };
window.alert = console.log;

window.eval(appJs);

try {
    // We open the modal for flat Fsz 1
    window.openFlatDetailModal("Fsz 1");
    
    // Initial state
    const flat = window.state.flats.find(f => f.flatNum === "Fsz 1");
    console.log("Initial Monthly Fee:", flat.monthlyFee);
    
    // Switch to edit mode
    window.toggleFlatEditMode(true);
    
    // User types in a new fee
    const feeA = window.document.getElementById("flat-edit-fee-a");
    console.log("Input value before:", feeA.value);
    feeA.value = "20000";
    
    // Check if the change is reflected in the DOM
    console.log("Input value after:", window.document.getElementById("flat-edit-fee-a").value);
    
    // Submit form
    const form = window.document.getElementById("flat-fee-edit-form");
    const event = new window.Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    
    console.log("--- AFTER SAVE ---");
    console.log("Monthly Fee:", flat.monthlyFee);
    console.log("Read-only Fee UI:", window.document.getElementById("flat-detail-fee-a").textContent);
} catch (e) {
    console.error("Crash:", e);
}
