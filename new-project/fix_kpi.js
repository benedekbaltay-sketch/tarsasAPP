const fs = require('fs');
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

const regex = /<div class="financial-stat-row" style="grid-template-columns: repeat\(4, 1fr\);">\s*<div class="stat-item">[\s\S]*?<span class="stat-value" id="admin-kpi-stats">/;

const replacement = `<div class="financial-stat-row" style="grid-template-columns: repeat(3, 1fr);">
                <div class="stat-item" style="display:flex; flex-direction:column; justify-content:space-between; gap:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <span class="stat-label" style="margin-bottom:4px; display:block;">Közös Költség alap</span>
                            <span class="stat-value text-success" id="admin-kpi-balance" style="font-size:22px;">–</span>
                        </div>
                        <button class="btn btn-outline btn-xs btn-icon-only" style="padding:4px; flex-shrink:0;" onclick="openGlobalBalancesModal()" title="Számlafőösszeg szerkesztése">
                            <i data-lucide="pencil" style="width:14px;height:14px;"></i>
                        </button>
                    </div>
                    <div style="border-top:1px solid var(--border-color); padding-top:12px;">
                        <span class="stat-label" style="margin-bottom:4px; display:block;">Felújítási Alap</span>
                        <span class="stat-value" style="color:var(--purple); font-size:22px;" id="admin-kpi-renovation">–</span>
                    </div>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Összes hátralék</span>
                    <span class="stat-value text-danger" id="admin-kpi-arrears">–</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Aktuális havi mérleg</span>
                    <span class="stat-value" id="admin-kpi-stats">`;

if (regex.test(indexHtml)) {
    indexHtml = indexHtml.replace(regex, replacement);
    indexHtml = indexHtml.replace('<script src="app.js?v=32"></script>', '<script src="app.js?v=33"></script>');
    fs.writeFileSync(indexPath, indexHtml, 'utf8');
    console.log("Successfully combined KPI cards!");
} else {
    console.log("Regex did not match!");
}
