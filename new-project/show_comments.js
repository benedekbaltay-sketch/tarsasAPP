const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// Update renderTimelineTable
const targetTimelineHTML = `<div style="font-size:11px; color:var(--text-muted);">\${item.account} \${item.reference ? '- ' + item.reference : ''}</div>`;
const replaceTimelineHTML = `<div style="font-size:11px; color:var(--text-muted);">\${item.account} \${item.reference ? '- ' + item.reference : ''} \${item.comment ? ' • ' + item.comment : ''}</div>`;
if (appJs.includes(targetTimelineHTML)) {
    appJs = appJs.replace(targetTimelineHTML, replaceTimelineHTML);
}

// Update renderFlatDetailTimeline
const targetFullscreenSubtitle = `<div style="font-size:12px; color:var(--text-muted); margin-top:2px;">\${item.account} \${item.reference ? '- ' + item.reference : ''}</div>`;
const replaceFullscreenSubtitle = `<div style="font-size:12px; color:var(--text-muted); margin-top:2px;">\${item.account} \${item.reference ? '- ' + item.reference : ''} \${item.comment ? ' • ' + item.comment : ''}</div>`;
if (appJs.includes(targetFullscreenSubtitle)) {
    appJs = appJs.replace(targetFullscreenSubtitle, replaceFullscreenSubtitle);
}

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Updated HTML generators in app.js to show comments.");
