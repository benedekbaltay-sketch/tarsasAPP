const fs = require('fs');

// 1. Update index.html
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let html = fs.readFileSync(indexPath, 'utf8');

const targetStatsRow = `            <!-- Summary row (Always visible) -->
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
                    <span class="stat-label">Havi KK előírás</span>
                    <span class="stat-value" id="flat-detail-fee-a">–</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Havi FA előírás</span>
                    <span class="stat-value" id="flat-detail-fee-b">–</span>
                </div>
            </div>`;

const newStatsRow = `            <!-- Summary row (Always visible) -->
            <div class="financial-stat-row" style="margin-bottom:16px;">
                <div class="stat-item">
                    <span class="stat-label">Jelenlegi KK egyenleg</span>
                    <span class="stat-value ro-stat-item" id="flat-detail-balance-a">–</span>
                    <input type="number" class="form-input edit-stat-item" id="flat-edit-balance-a" style="display:none; margin-top:4px;" />
                </div>
                <div class="stat-item">
                    <span class="stat-label">Jelenlegi FA egyenleg</span>
                    <span class="stat-value ro-stat-item" id="flat-detail-balance-b">–</span>
                    <input type="number" class="form-input edit-stat-item" id="flat-edit-balance-b" style="display:none; margin-top:4px;" />
                </div>
                <div class="stat-item">
                    <span class="stat-label">Havi KK előírás</span>
                    <span class="stat-value ro-stat-item" id="flat-detail-fee-a">–</span>
                    <div class="edit-stat-item" style="display:none; margin-top:4px; flex-direction:column; gap:4px;">
                        <input type="number" min="0" class="form-input" id="flat-edit-fee-a" oninput="checkFeeChange('KK')" />
                        <div id="flat-edit-fee-date-container-a" style="display:none; background:var(--bg-body); padding:8px; border-radius:var(--radius-sm); border:1px solid var(--border-color); margin-top:4px;">
                            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">Érvényes ettől (ÉÉÉÉ-HH):</label>
                            <input type="month" id="flat-edit-fee-date-a" class="form-input" style="padding:4px;" />
                        </div>
                    </div>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Havi FA előírás</span>
                    <span class="stat-value ro-stat-item" id="flat-detail-fee-b">–</span>
                    <div class="edit-stat-item" style="display:none; margin-top:4px; flex-direction:column; gap:4px;">
                        <input type="number" min="0" class="form-input" id="flat-edit-fee-b" oninput="checkFeeChange('FA')" />
                        <div id="flat-edit-fee-date-container-b" style="display:none; background:var(--bg-body); padding:8px; border-radius:var(--radius-sm); border:1px solid var(--border-color); margin-top:4px;">
                            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">Érvényes ettől (ÉÉÉÉ-HH):</label>
                            <input type="month" id="flat-edit-fee-date-b" class="form-input" style="padding:4px;" />
                        </div>
                    </div>
                </div>
            </div>`;

html = html.replace(targetStatsRow, newStatsRow);

const targetBottomForm = `                <h5 style="margin:16px 0 8px 0;font-size:14px;color:var(--text-main);">Pénzügyi beállítások</h5>
                
                <!-- KK -->
                <div style="display:flex;gap:12px;flex-wrap:wrap;background:var(--bg-body);padding:12px;border-radius:var(--radius-sm);border:1px solid var(--border-color);">
                    <div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-fee-input">Közös Költség (Ft/hó)</label>
                        <input id="flat-fee-input" type="number" min="0" class="form-input" />
                    </div>
                    <div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-fee-date-input">Melyik hónaptól érvényes?</label>
                        <input id="flat-fee-date-input" type="month" class="form-input" title="Válassza ki a kezdő hónapot (visszamenőleg is)" />
                    </div>
                </div>

                <!-- FA -->
                <div style="display:flex;gap:12px;flex-wrap:wrap;background:var(--bg-body);padding:12px;border-radius:var(--radius-sm);border:1px solid var(--border-color);">
                    <div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-renovation-fee-input">Felújítási Alap (Ft/hó)</label>
                        <input id="flat-renovation-fee-input" type="number" min="0" class="form-input" />
                    </div>
                    <div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-renovation-fee-date-input">Melyik hónaptól érvényes?</label>
                        <input id="flat-renovation-fee-date-input" type="month" class="form-input" title="Válassza ki a kezdő hónapot (visszamenőleg is)" />
                    </div>
                </div>`;

html = html.replace(targetBottomForm, '');

fs.writeFileSync(indexPath, html, 'utf8');
console.log("Updated index.html");
