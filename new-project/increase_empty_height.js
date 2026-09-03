const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

appJs = appJs.split('min-height:350px').join('min-height:520px');

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Successfully updated empty state height to 520px in app.js");
