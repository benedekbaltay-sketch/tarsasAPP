const fs = require('fs');

// 1. Update index.html
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexData = fs.readFileSync(indexPath, 'utf8');

// Replace table -> div
indexData = indexData.replace(/<table class="ledger-table">\s*<thead>\s*<tr>\s*<th>Dátum<\/th>\s*<th>Típus<\/th>\s*<th>Név \/ Lakás<\/th>\s*<th>Összeg<\/th>\s*<th>Kategória \/ Egyenleg<\/th>\s*<th>Megjegyzés<\/th>\s*<th style="width:60px;text-align:right;">Műveletek<\/th>\s*<\/tr>\s*<\/thead>\s*<tbody id="admin-transactions-tbody"><\/tbody>\s*<\/table>/, '<div id="admin-transactions-tbody" class="modern-list"></div>');

indexData = indexData.replace(/<table class="ledger-table">\s*<thead>\s*<tr>\s*<th>Dátum<\/th>\s*<th>Típus<\/th>\s*<th>Összeg<\/th>\s*<th>Egyenleg<\/th>\s*<th>Megjegyzés<\/th>\s*<th style="width:60px;text-align:right;">Műveletek<\/th>\s*<\/tr>\s*<\/thead>\s*<tbody id="flat-detail-ledger-tbody"><\/tbody>\s*<\/table>/, '<div id="flat-detail-ledger-tbody" class="modern-list"></div>');

indexData = indexData.replace(/<table class="ledger-table">\s*<thead id="fullscreen-tx-thead-tr">\s*<!-- Populated by JS -->\s*<\/thead>\s*<tbody id="fullscreen-tx-tbody">\s*<!-- Populated by JS -->\s*<\/tbody>\s*<\/table>/, '<div id="fullscreen-tx-tbody" class="modern-list">\n                <!-- Populated by JS -->\n            </div>');

// Add max-width to .modern-list
if (indexData.includes('.modern-list {')) {
    indexData = indexData.replace('.modern-list {\n        display: flex;', '.modern-list {\n        max-width: 860px;\n        margin: 0 auto;\n        width: 100%;\n        display: flex;');
}

// Bump version
indexData = indexData.replace('<script src="app.js?v=13"></script>', '<script src="app.js?v=14"></script>');

fs.writeFileSync(indexPath, indexData);
console.log("Updated index.html");

// 2. Update app.js
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appData = fs.readFileSync(appPath, 'utf8');

const rAdmin = fs.readFileSync('C:/Users/bened/.gemini/antigravity/scratch/new-project/replacement.txt', 'utf8');
const rTime = fs.readFileSync('C:/Users/bened/.gemini/antigravity/scratch/new-project/replacement_timeline.txt', 'utf8');
const rFull = fs.readFileSync('C:/Users/bened/.gemini/antigravity/scratch/new-project/replacement_fullscreen.txt', 'utf8');

// Replace renderAdminTransactions
const adminStart = appData.indexOf('function renderAdminTransactions(showAll = false) {');
const adminEnd = appData.indexOf('// --- Action Handlers ---');
if (adminStart !== -1 && adminEnd !== -1) {
    appData = appData.substring(0, adminStart) + rAdmin + "\n\n" + appData.substring(adminEnd);
}

// Replace renderFlatDetailTimeline
const timeStart = appData.indexOf('function renderFlatDetailTimeline(showAll = false) {');
const timeEnd = appData.indexOf('window.deleteLedgerTransaction = function(txId) {');
if (timeStart !== -1 && timeEnd !== -1) {
    appData = appData.substring(0, timeStart) + rTime + "\n\n" + appData.substring(timeEnd);
}

// Replace window.openFullscreenTx
const fullStart = appData.indexOf('window.openFullscreenTx = function(type) {');
const fullEnd = appData.indexOf('window.closeFullscreenTx = function() {');
if (fullStart !== -1 && fullEnd !== -1) {
    appData = appData.substring(0, fullStart) + rFull + "\n\n" + appData.substring(fullEnd);
}

fs.writeFileSync(appPath, appData);
console.log("Updated app.js");
