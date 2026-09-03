const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let data = fs.readFileSync(appPath, 'utf8');

// 1. Fix emojis
data = data.replace('state.currentLang === "hu" ? "????" : "????"', 'state.currentLang === "hu" ? "🇭🇺" : "🇬🇧"');
data = data.replace('state.currentLang === "hu" ? "HU" : "EN"', 'state.currentLang === "hu" ? "🇭🇺" : "🇬🇧"');

// 2. Fix background scrolling for fullscreen modal
data = data.replace('document.getElementById("fullscreen-tx-modal").style.display = "flex";\n    lucide.createIcons();', 'document.getElementById("fullscreen-tx-modal").style.display = "flex";\n    document.body.style.overflow = "hidden";\n    lucide.createIcons();');

data = data.replace('window.closeFullscreenTx = function() {\n    document.getElementById("fullscreen-tx-modal").style.display = "none";', 'window.closeFullscreenTx = function() {\n    document.getElementById("fullscreen-tx-modal").style.display = "none";\n    document.body.style.overflow = "";');

fs.writeFileSync(appPath, data);
console.log("Fixed emojis and scroll");
