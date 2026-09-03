const fs = require('fs');

const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

const startForm = '<!-- Fee edit form -->';
const endForm = '</form>';

const startIndex = indexHtml.indexOf(startForm);
const endIndex = indexHtml.indexOf(endForm, startIndex) + endForm.length;

const newFormHtml = `<!-- Fee edit form -->
            <form id="flat-fee-edit-form" style="display:none;flex-direction:column;gap:12px;margin-bottom:24px;background:var(--bg-card);padding:16px;border:1px solid var(--border-color);border-radius:var(--radius-md);">
                <input type="hidden" id="flat-detail-flatnum-hidden" />
                
                <h5 style="margin:0 0 8px 0;font-size:14px;color:var(--text-main);">Alapadatok</h5>
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
                
                <h5 style="margin:16px 0 8px 0;font-size:14px;color:var(--text-main);">Pénzügyi beállítások</h5>
                
                <!-- KK -->
                <div style="display:flex;gap:12px;flex-wrap:wrap;background:var(--bg-body);padding:12px;border-radius:var(--radius-sm);border:1px solid var(--border-color);">
                    <div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-fee-input">Közös Költség (Ft/hó)</label>
                        <input id="flat-fee-input" type="number" min="0" class="form-input" />
                    </div>
                    <div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-fee-date-input">Új díj érvényes ettől</label>
                        <input id="flat-fee-date-input" type="month" class="form-input" title="Hagyja üresen, ha nincs jövőbeli/múltbeli változás" />
                    </div>
                    <div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-current-balance-a">Jelenlegi KK Egyenleg (Ft)</label>
                        <input id="flat-current-balance-a" type="number" class="form-input" title="Átírással automatikus korrekció készül!" />
                    </div>
                </div>

                <!-- FA -->
                <div style="display:flex;gap:12px;flex-wrap:wrap;background:var(--bg-body);padding:12px;border-radius:var(--radius-sm);border:1px solid var(--border-color);">
                    <div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-renovation-fee-input">Felújítási Alap (Ft/hó)</label>
                        <input id="flat-renovation-fee-input" type="number" min="0" class="form-input" />
                    </div>
                    <div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-renovation-fee-date-input">Új díj érvényes ettől</label>
                        <input id="flat-renovation-fee-date-input" type="month" class="form-input" title="Hagyja üresen, ha nincs jövőbeli/múltbeli változás" />
                    </div>
                    <div class="form-group" style="margin:0;flex:1;min-width:140px;">
                        <label for="flat-current-balance-b">Jelenlegi FA Egyenleg (Ft)</label>
                        <input id="flat-current-balance-b" type="number" class="form-input" title="Átírással automatikus korrekció készül!" />
                    </div>
                </div>
                
                <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="toggleFlatEditMode(false)">
                        Mégse
                    </button>
                    <button type="submit" class="btn btn-primary btn-sm">
                        Mentés
                    </button>
                </div>
            </form>`;

indexHtml = indexHtml.substring(0, startIndex) + newFormHtml + indexHtml.substring(endIndex);
indexHtml = indexHtml.replace('v=41', 'v=42');

fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log("Replaced form in index.html!");
