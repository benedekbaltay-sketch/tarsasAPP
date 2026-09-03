const fs = require('fs');
const path = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let data = fs.readFileSync(path, 'utf8');
const replacement = fs.readFileSync('C:/Users/bened/.gemini/antigravity/scratch/new-project/replacement_fullscreen.txt', 'utf8');

const startStr = 'window.openFullscreenTx = function(type) {';
const endStr = 'window.closeFullscreenTx = function() {';

const start = data.indexOf(startStr);
const end = data.indexOf(endStr);

if (start === -1 || end === -1) {
    console.log("Not found boundaries fullscreen");
    process.exit(1);
}

data = data.substring(0, start) + replacement + "\n" + data.substring(end);
fs.writeFileSync(path, data);
console.log("Replaced fullscreen successfully");
