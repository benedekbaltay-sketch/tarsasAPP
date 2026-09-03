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
    
    const flat = window.state.flats.find(f => f.flatNum === "Fsz 1");
    
    // Switch to edit mode
    window.toggleFlatEditMode(true);
    
    // User types in a new fee
    const feeA = window.document.getElementById("flat-edit-fee-a");
    feeA.value = "25000";
    
    // User types in a date
    const feeDateA = window.document.getElementById("flat-edit-fee-date-a");
    feeDateA.value = "2026-06"; // June 2026 (current month is Aug 2026!)
    
    // Submit form
    const form = window.document.getElementById("flat-fee-edit-form");
    const event = new window.Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    
    console.log("--- AFTER SAVE WITH DATE ---");
    console.log("Monthly Fee:", flat.monthlyFee);
    console.log("feeChangesKK length:", flat.feeChangesKK ? flat.feeChangesKK.length : 0);
    if (flat.feeChangesKK && flat.feeChangesKK.length > 0) {
        console.log("Last feeChangeKK:", flat.feeChangesKK[flat.feeChangesKK.length-1]);
    }
    
    // Check UI value
    console.log("Read-only Fee UI:", window.document.getElementById("flat-detail-fee-a").textContent);
} catch (e) {
    console.error("Crash:", e);
}
