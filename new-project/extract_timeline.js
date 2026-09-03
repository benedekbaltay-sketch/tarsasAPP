const fs = require('fs');
const path = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let data = fs.readFileSync(path, 'utf8');

const startStr = 'function renderFlatDetailTimeline(showAll = false) {';
const endStr = 'function toggleFlatEditMode(isEditing) {';

const start = data.indexOf(startStr);
const end = data.indexOf(endStr);

if (start === -1 || end === -1) {
    console.log("Not found renderFlatDetailTimeline");
    process.exit(1);
}
console.log(data.substring(start, end));
