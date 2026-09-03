const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// Replace openFullscreenCommentEdit with safe inline edit or modal edit
const newCommentFunc = `
window.openFullscreenCommentEdit = function(flatNum, date, type, account, txId) {
    if (txId) {
        openEditModal(txId, 'Befizetés');
    }
};
`;

const si = appJs.indexOf('window.openFullscreenCommentEdit = function');
const ei = appJs.indexOf('window.deleteFlatLedgerTx = function');

if (si !== -1 && ei !== -1) {
    appJs = appJs.substring(0, si) + newCommentFunc + appJs.substring(ei);
    console.log("Cleaned openFullscreenCommentEdit");
}

// Clean saveLedgerComment
const saveLedgerIdx = appJs.indexOf('window.saveLedgerComment = function');
if (saveLedgerIdx !== -1) {
    const endSaveIdx = appJs.indexOf('window.deleteTransaction = function', saveLedgerIdx);
    if (endSaveIdx !== -1) {
        appJs = appJs.substring(0, saveLedgerIdx) + appJs.substring(endSaveIdx);
        console.log("Cleaned saveLedgerComment");
    }
}

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Finished cleaning app.js");
