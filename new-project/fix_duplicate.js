const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const regex = /tbody\.innerHTML = displayTimeline\.map\(item => \{[\s\S]*?\}\)\.join\(""\);\s*if\s*\(window\.lucide\)\s*lucide\.createIcons\(\);/;

if (regex.test(appJs)) {
    // Keep the first one (the good one), and we need to remove the one below viewAllBtn.
    // Let's just do a specific string replace for the old one.
    
    const targetOld = `    tbody.innerHTML = displayTimeline.map(item => {
        const isDemand = item.type === "Debit";
        const color = isDemand ? "var(--danger)" : "var(--success)";
        const amountPrefix = isDemand ? "-" : "+";
        
        return \`
            <tr>
                <td>\${item.date}</td>
                <td>
                    <div style="font-weight:500;">\${item.method || (isDemand ? 'Havi El\\u0151\\u00edr\\u00e1s' : 'Befizet\\u00e9s')}</div>
                    <div style="font-size:11px; color:var(--text-muted);">\${item.account} \${item.reference ? '- ' + item.reference : ''}</div>
                </td>
                <td style="color:\${color}; font-weight:600; text-align:right;">
                    \${amountPrefix}\${formatCurrency(item.amount)}
                </td>
                <td style="text-align:right; font-weight:500;">
                    \${formatCurrency(item.runningBalance)}
                </td>
            </tr>
        \`;
    }).join("");`;
    
    // Instead of string literal (which has unicode encoding issues), let's use a regex to strip the second tbody.innerHTML assignment.
    // The second assignment doesn't have lucide.createIcons().
    appJs = appJs.replace(/tbody\.innerHTML = displayTimeline\.map\(item => \{\s*const isDemand.*?\}\)\.join\(""\);\s*\}/s, '}');
    
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Removed duplicate mapping");
}
