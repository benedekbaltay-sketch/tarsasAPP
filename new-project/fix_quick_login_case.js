const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const targetQuickLogin = `        (u.role === "Admin" && username.toLowerCase() === "admin"))`;
const replaceQuickLogin = `        (u.role && u.role.toLowerCase() === "admin" && username.toLowerCase() === "admin"))`;

if (appJs.includes(targetQuickLogin)) {
    appJs = appJs.replace(targetQuickLogin, replaceQuickLogin);
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Fixed case sensitivity in quickLogin.");
} else {
    console.log("Failed to find quickLogin logic.");
}
