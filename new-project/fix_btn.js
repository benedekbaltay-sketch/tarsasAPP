const fs = require('fs');
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

indexHtml = indexHtml.replace(
    /<button id="logout-btn" class="btn btn-logout btn-sm">[\s\S]*?<\/button>/,
    `<button id="logout-btn" class="btn btn-logout btn-sm" style="width: 140px; flex-shrink: 0; justify-content: center; display: flex; align-items: center;" onclick="logout()">
                <i data-lucide="log-out" style="width:14px;height:14px;"></i>
                <span data-i18n="logout">Kijelentkezés</span>
            </button>`
);

indexHtml = indexHtml.replace('<script src="app.js?v=28"></script>', '<script src="app.js?v=29"></script>');
fs.writeFileSync(indexPath, indexHtml, 'utf8');

console.log("Fixed logout button width");
