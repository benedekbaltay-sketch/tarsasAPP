const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const closeFunc = `
window.closeFullscreenTx = function() {
    document.getElementById("fullscreen-tx-modal").style.display = "none";
    document.body.style.overflow = "";
};
`;

if (!appJs.includes('window.closeFullscreenTx')) {
    appJs += '\n' + closeFunc;
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Successfully added closeFullscreenTx to app.js");
} else {
    console.log("closeFullscreenTx already exists");
}
