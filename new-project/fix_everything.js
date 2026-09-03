const fs = require('fs');

const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// The flat modal starts at <div id="flat-detail-modal" class="modal-overlay" style="display:none;">
// and ends at the next <!-- ================================================================
// I will replace the ENTIRE modal body to ensure it is clean and perfect.

const startMarker = '<div id="flat-detail-modal"';
const endMarker = '<!-- ================================================================\r\n     EDIT TRANSACTION MODAL';
const endMarker2 = '<!-- ================================================================\n     EDIT TRANSACTION MODAL';

let startIndex = indexHtml.indexOf(startMarker);
let endIndex = indexHtml.indexOf(endMarker);
if (endIndex === -1) endIndex = indexHtml.indexOf(endMarker2);

const newModalHTML = `<div id="flat-detail-modal" class="modal-overlay" style="display:none;">
    <div class="modal-box modal-box-wide">
        <div class="modal-header">
            <h3 id="flat-detail-title">Lakás adatlap</h3>
            <div style="display:flex;gap:8px;">
                <button class="btn btn-outline btn-sm btn-icon-only" onclick="toggleFlatEditMode(true)" id="flat-detail-edit-btn" title="Adatok szerkesztése">
                    <i data-lucide="pencil" style="width:16px;height:16px;"></i>
                </button>
                <button id="flat-detail-close-btn" class="btn btn-outline btn-sm btn-icon-only">
                    <i data-lucide="x" style="width:16px;height:16px;"></i>
                </button>
            </div>
        </div>
        <div class="modal-body">

            <!-- Summary row (Always visible) -->
            <div class="financial-stat-row" style="margin-bottom:16px;">
                <div class="stat-item">
                    <span class="stat-label">Jelenlegi KK egyenleg</span>
                    <span class="stat-value" id="flat-detail-balance-a">–</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Jelenlegi FA egyenleg</span>
                    <span class="stat-value" id="flat-detail-balance-b">–</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Havi előírás (KK+FA)</span>
                    <span class="stat-value" id="flat-detail-fees-summary">–</span>
                </div>
            </div>
            
            <!-- Read-only details (Hid in edit mode) -->
            <div id="flat-info-readonly" style="margin-bottom:24px;">
                <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 12px; background: var(--bg-body); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                    <div>
                        <span class="stat-label" style="margin-bottom:2px; display:block;">Tulajdonos neve</span>
                        <strong style="font-size:14px;" id="ro-flat-owner">–</strong>
                    </div>
                    <div>
                        <span class="stat-label" style="margin-bottom:2px; display:block;">Lakók száma</span>
                        <strong style="font-size:14px;" id="ro-flat-tenant-count">–</strong>
                    </div>
                    <div>
                        <span class="stat-label" style="margin-bottom:2px; display:block;">E-mail cím</span>
                        <strong style="font-size:14px;" id="flat-detail-email">–</strong>
                    </div>
                    <div>
                        <span class="stat-label" style="margin-bottom:2px; display:block;">Telefonszám</span>
                        <strong style="font-size:14px;" id="ro-flat-phone">–</strong>
                    </div>
                </div>
            </div>

            <!-- Fee edit form -->
            <form id="flat-fee-edit-form" style="display:none;flex-direction:column;gap:12px;margin-bottom:24px;background:var(--bg-card);padding:16px;border:1px solid var(--border-color);border-radius:var(--radius-md);">
                <input type="hidden" id="flat-detail-flatnum-hidden" />
                
                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                    <div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-owner-input">Tulajdonos neve</label>
                        <input id="flat-owner-input" type="text" class="form-input" />
                    </div>
                    <div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-phone-input">Telefonszám</label>
                        <input id="flat-phone-input" type="text" class="form-input" placeholder="pl. +36 30 123 4567" />
                    </div>
                    <div class="form-group" style="margin:0;flex:1;min-width:100px;">
                        <label for="flat-tenant-input">Lakók száma (fő)</label>
                        <input id="flat-tenant-input" type="number" min="0" class="form-input" />
                    </div>
                </div>
                
                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                    <div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-fee-input">Közös Költség (Ft/hó)</label>
                        <input id="flat-fee-input" type="number" min="0" class="form-input" />
                    </div>
                    <div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-renovation-fee-input">Felújítási Alap (Ft/hó)</label>
                        <input id="flat-renovation-fee-input" type="number" min="0" class="form-input" />
                    </div>
                </div>

                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                    <div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-start-balance-a">Induló egyenleg - KK (Ft)</label>
                        <input id="flat-start-balance-a" type="number" class="form-input" placeholder="pl. -15000 (hátralék) vagy 10000 (túlfizetés)" />
                    </div>
                    <div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-start-balance-b">Induló egyenleg - FA (Ft)</label>
                        <input id="flat-start-balance-b" type="number" class="form-input" placeholder="pl. -5000" />
                    </div>
                </div>
                
                <div style="display:flex;justify-content:flex-end;gap:8px;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="toggleFlatEditMode(false)">
                        Mégse
                    </button>
                    <button type="submit" class="btn btn-primary btn-sm">
                        Mentés
                    </button>
                </div>
            </form>

            <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-main); border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">Tranzakciók és Előírások</h4>
            
            <!-- Ledger table -->
            <div id="flat-detail-ledger-wrapper">
                <div class="table-responsive" style="border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                    <table class="data-table">
                        <thead style="position: sticky; top: 0; z-index: 10;">
                            <tr>
                                <th>Dátum</th>
                                <th>Megjegyzés</th>
                                <th>Összeg</th>
                                <th>Egyenleg</th>
                            </tr>
                        </thead>
                        <tbody id="flat-detail-ledger-tbody">
                            <!-- populated by JS -->
                        </tbody>
                    </table>
                </div>
                <div id="flat-view-all-container" style="text-align:center; padding-top:16px;">
                    <button class="btn btn-outline" id="flat-view-all-btn" onclick="toggleFlatViewAll()">Minden tranzakció megjelenítése</button>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button id="flat-detail-close-btn-bottom" class="btn btn-outline">Bezárás</button>
        </div>
    </div>
</div>

`;

indexHtml = indexHtml.substring(0, startIndex) + newModalHTML + indexHtml.substring(endIndex);
indexHtml = indexHtml.replace('v=37', 'v=38');
fs.writeFileSync(indexPath, indexHtml, 'utf8');

// Now update app.js
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// Delete switchFlatDetailTab
appJs = appJs.replace(/window\.switchFlatDetailTab = function\(targetAccount\) \{[\s\S]*?renderFlatDetailTimeline\(\);\s*\};/, '');

// Replace renderFlatDetailTimeline entirely
const renderDetailRegex = /function renderFlatDetailTimeline\(showAll = false\) \{[\s\S]*?\}\s*lucide\.createIcons\(\);\s*\}/;
const newRenderDetail = `function renderFlatDetailTimeline() {
    const flatNum = state.currentFlatDetailNum;
    const tbody = document.getElementById("flat-detail-ledger-tbody");
    if (!tbody) return;
    
    // We expect getCombinedFlatLedgerTimeline to exist because it was added in fix_app_js_3.js
    const timeline = getCombinedFlatLedgerTimeline(flatNum);
    
    if (timeline.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Nincsenek tranzakciók</td></tr>';
        document.getElementById("flat-view-all-container").style.display = "none";
        return;
    }
    
    const displayTimelineFull = [...timeline].reverse();
    const displayTimeline = state.flatViewAll ? displayTimelineFull : displayTimelineFull.slice(0, 3);
    
    const viewAllBtn = document.getElementById("flat-view-all-btn");
    if (viewAllBtn) {
        if (displayTimelineFull.length <= 3) {
            document.getElementById("flat-view-all-container").style.display = "none";
        } else {
            document.getElementById("flat-view-all-container").style.display = "block";
            viewAllBtn.innerHTML = state.flatViewAll ? "Kevesebb tranzakció" : "Minden tranzakció megjelenítése";
        }
    }
    
    tbody.innerHTML = displayTimeline.map(item => {
        const isDemand = item.type === "Debit";
        const color = isDemand ? "var(--danger)" : "var(--success)";
        const amountPrefix = isDemand ? "-" : "+";
        
        return \`
            <tr>
                <td>\${item.date}</td>
                <td>
                    <div style="font-weight:500;">\${item.method || (isDemand ? 'Havi Előírás' : 'Befizetés')}</div>
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
    }).join("");
}`;

appJs = appJs.replace(renderDetailRegex, newRenderDetail);

// Also we need to fix toggleFlatViewAll so it calls renderFlatDetailTimeline
appJs = appJs.replace(/window\.toggleFlatViewAll = function\(\) \{[\s\S]*?renderFlatModalTimeline\(flatNum\);\s*\};/, `window.toggleFlatViewAll = function() {
    state.flatViewAll = !state.flatViewAll;
    renderFlatDetailTimeline();
};`);

// And fix openFlatDetailModal
const openModalRegex = /state\.currentFlatDetailTab = "Közös Költség";\s*\/\/ Reset tab button states[\s\S]*?renderFlatDetailTimeline\(\);/g;
appJs = appJs.replace(openModalRegex, `state.flatViewAll = false;
    renderFlatDetailTimeline();`);

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Successfully fixed everything!");
