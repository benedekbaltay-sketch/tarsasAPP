const fs = require('fs');
const path = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let data = fs.readFileSync(path, 'utf8');

const rAdmin = fs.readFileSync('C:/Users/bened/.gemini/antigravity/scratch/new-project/original_admin.txt', 'utf8');
const rTime = fs.readFileSync('C:/Users/bened/.gemini/antigravity/scratch/new-project/original_timeline.txt', 'utf8');
const rFull = fs.readFileSync('C:/Users/bened/.gemini/antigravity/scratch/new-project/original_fullscreen.txt', 'utf8');

// Replace renderAdminTransactions
const adminStart = data.indexOf('function renderAdminTransactions(showAll = false) {');
const adminEnd = data.indexOf('// --- Action Handlers ---');
if(adminStart !== -1 && adminEnd !== -1) {
    data = data.substring(0, adminStart) + rAdmin + "\n\n" + data.substring(adminEnd);
}

// Replace renderFlatDetailTimeline
const timeStart = data.indexOf('function renderFlatDetailTimeline(showAll = false) {');
const timeEnd = data.indexOf('window.deleteLedgerTransaction = function(txId) {');
if(timeStart !== -1 && timeEnd !== -1) {
    data = data.substring(0, timeStart) + rTime + "\n\n" + data.substring(timeEnd);
}

// Replace window.openFullscreenTx
const fullStart = data.indexOf('window.openFullscreenTx = function(type) {');
const fullEnd = data.indexOf('window.closeFullscreenTx = function() {');
if(fullStart !== -1 && fullEnd !== -1) {
    data = data.substring(0, fullStart) + rFull + "\n\n" + data.substring(fullEnd);
}

fs.writeFileSync(path, data);
console.log("Restored all functions successfully");

// Cache bust index.html
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexData = fs.readFileSync(indexPath, 'utf8');
indexData = indexData.replace('<script src="app.js?v=12"></script>', '<script src="app.js?v=13"></script>');
fs.writeFileSync(indexPath, indexData);
