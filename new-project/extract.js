const fs = require('fs');
const path = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
const data = fs.readFileSync(path, 'utf8');

const startStr = 'function renderFlatDetailTimeline(flatNum, targetAccount) {';
const endStr = 'function renderTenantDashboard() {';

const start = data.indexOf(startStr);
const end = data.indexOf(endStr);
console.log(data.substring(start, end));
