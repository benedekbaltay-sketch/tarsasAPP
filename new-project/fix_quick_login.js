const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const quickLoginCode = `
window.quickLogin = function(username) {
    const userObj = state.users.find(u => 
        (u.email.toLowerCase() === username.toLowerCase() || 
        (u.flatNum && u.flatNum.toLowerCase() === username.toLowerCase()) || 
        (u.role === "Admin" && username.toLowerCase() === "admin"))
    );
    
    if (userObj) {
        document.getElementById("login-username").value = username;
        document.getElementById("login-password").value = userObj.pass;
        document.getElementById("login-btn").click();
    }
};

// --- Action Handlers ---`;

appJs = appJs.replace('// --- Action Handlers ---', quickLoginCode);
fs.writeFileSync(appPath, appJs, 'utf8');

// Also bump version in index.html
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');
indexHtml = indexHtml.replace('v=42', 'v=43');
fs.writeFileSync(indexPath, indexHtml, 'utf8');

console.log("Added quickLogin!");
