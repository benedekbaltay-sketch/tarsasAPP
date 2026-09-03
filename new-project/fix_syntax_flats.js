const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const regex = /flats: \[\s*\{\s*flatNum:\s*"Fsz 1"[\s\S]*?\]\s*flats: \[\s*/;
const match = appJs.match(regex);

if (match) {
    appJs = appJs.replace(regex, 'flats: [\n');
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Fixed duplicated flats syntax!");
} else {
    console.log("Could not find duplicated flats!");
}
