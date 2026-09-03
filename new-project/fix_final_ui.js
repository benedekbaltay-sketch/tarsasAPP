const fs = require('fs');

// Fix app.js
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// Replace ???? with emojis in app.js
appJs = appJs.replace(/langBtn\.textContent = state\.currentLang === "hu" \? "\?\?\?\?" : "\?\?\?\?";/g, 'langBtn.textContent = state.currentLang === "hu" ? "🇭🇺" : "🇬🇧";');
// Also replace it just in case it's in a different format
appJs = appJs.replace(/langBtn\.textContent = state\.currentLang === 'hu' \? '🇭🇺' : '🇬🇧';/g, 'langBtn.textContent = state.currentLang === "hu" ? "🇭🇺" : "🇬🇧";');

// Remove reset-db-btn references in app.js
appJs = appJs.replace(/if \(document\.getElementById\("reset-db-btn"\)\).*?;\r?\n/g, '');

fs.writeFileSync(appPath, appJs, 'utf8');

// Fix index.html
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// Remove reset db button
indexHtml = indexHtml.replace(/<button id="reset-db-btn"[\s\S]*?<\/button>/, '');

// Give fixed width to buttons to prevent shifting
indexHtml = indexHtml.replace(/<button class="btn btn-outline" id="logout-btn"/, '<button class="btn btn-outline" id="logout-btn" style="min-width: 140px; text-align: center; justify-content: center;"');
indexHtml = indexHtml.replace(/<span class="user-role-badge"/, '<span class="user-role-badge" style="min-width: 120px; text-align: center; justify-content: center;"');
indexHtml = indexHtml.replace(/<div class="user-info">/, '<div class="user-info" style="min-width: 150px;">');

indexHtml = indexHtml.replace('<script src="app.js?v=24"></script>', '<script src="app.js?v=25"></script>');

fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log("Fixed emojis, removed reset db button, and added fixed widths.");
