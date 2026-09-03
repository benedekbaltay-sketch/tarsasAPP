const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// Replace empty state innerHTML in renderAdminTransactions and renderFullscreenList
const emptyHtml = `<div style="padding:80px 24px; text-align:center; color:var(--text-muted); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; min-height:350px;">
        <i data-lucide="search-x" style="width:40px;height:40px;opacity:0.4;"></i>
        <div style="font-size:15px; font-weight:500;">Nem található tranzakció</div>
        <div style="font-size:13px; opacity:0.8;">Próbálj meg más keresési kifejezést beírni!</div>
    </div>`;

// 1. Update renderAdminTransactions empty state
appJs = appJs.replace(/if\s*\(combined\.length\s*===\s*0\)\s*\{\s*tbody\.innerHTML\s*=\s*`<div style="padding:\s*24px;[^`]*<\/div>`;\s*return;\s*\}/, `if (combined.length === 0) {
        tbody.innerHTML = \`${emptyHtml}\`;
        if (window.lucide) lucide.createIcons();
        return;
    }`);

// 2. Update renderFullscreenList empty states
appJs = appJs.replace(/if\s*\(items\.length\s*===\s*0\)\s*\{\s*tbody\.innerHTML\s*=\s*`<div style="padding:32px;[^`]*<\/div>`;\s*lucide\.createIcons\(\);\s*return;\s*\}/g, `if (items.length === 0) {
            tbody.innerHTML = \`${emptyHtml}\`;
            if (window.lucide) lucide.createIcons();
            return;
        }`);

appJs = appJs.replace(/if\s*\(combined\.length\s*===\s*0\)\s*\{\s*tbody\.innerHTML\s*=\s*`<div style="padding:32px;[^`]*<\/div>`;\s*lucide\.createIcons\(\);\s*return;\s*\}/g, `if (combined.length === 0) {
            tbody.innerHTML = \`${emptyHtml}\`;
            if (window.lucide) lucide.createIcons();
            return;
        }`);

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Successfully updated empty states in app.js");
