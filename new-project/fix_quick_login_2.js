const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

appJs = appJs.replace('document.getElementById("login-btn").click();', 'document.getElementById("login-form").dispatchEvent(new Event("submit"));');
fs.writeFileSync(appPath, appJs, 'utf8');

const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');
indexHtml = indexHtml.replace('v=43', 'v=44');
fs.writeFileSync(indexPath, indexHtml, 'utf8');

console.log("Fixed quickLogin!");
