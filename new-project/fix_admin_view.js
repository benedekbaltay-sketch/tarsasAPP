const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const targetAdminCheck1 = `    if (state.currentUser.role === "Admin") {`;
const replaceAdminCheck1 = `    if (state.currentUser.role && state.currentUser.role.toLowerCase() === "admin") {`;

// Replace in updateAppView
if (appJs.includes(targetAdminCheck1)) {
    // We should replace all occurrences just to be safe
    appJs = appJs.split(targetAdminCheck1).join(replaceAdminCheck1);
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Fixed role checking in app.js");
} else {
    console.log("Failed to find target check.");
}
