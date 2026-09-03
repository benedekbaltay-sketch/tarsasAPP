const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const oldQuickLoginRegex = /window\.quickLogin = function\(username\) \{[\s\S]*?\}\s*};\s*/;
const newQuickLogin = `window.quickLogin = function(username) {
    const userObj = state.users.find(u => 
        (u.email.toLowerCase() === username.toLowerCase() || 
        (u.flatNum && u.flatNum.toLowerCase() === username.toLowerCase()) || 
        (u.role === "Admin" && username.toLowerCase() === "admin"))
    );
    
    if (userObj) {
        state.currentUser = userObj;
        saveStateToLocalStorage();
        updateAppView();
    }
};
`;

appJs = appJs.replace(oldQuickLoginRegex, newQuickLogin);
fs.writeFileSync(appPath, appJs, 'utf8');

const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');
indexHtml = indexHtml.replace('v=44', 'v=45');
fs.writeFileSync(indexPath, indexHtml, 'utf8');

console.log("Rewrote quickLogin to be direct!");
