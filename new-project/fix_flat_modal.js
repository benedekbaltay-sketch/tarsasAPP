const fs = require('fs');

const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

const regex = /<!-- Read-only details \(Hid in edit mode\) -->[\s\S]*?<!-- Fee edit form -->/;

const replacement = `<!-- Read-only details (Hid in edit mode) -->
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
                
                <h4 style="margin: 24px 0 12px 0; font-size: 14px; color: var(--text-main); border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">Tranzakciók és Előírások</h4>
                
                <div style="display:flex; gap:8px; margin-bottom: 12px;">
                    <button class="btn btn-primary btn-sm" id="flat-tab-kk" onclick="setFlatModalTab('Közös Költség')">Közös Költség</button>
                    <button class="btn btn-outline btn-sm" id="flat-tab-fa" onclick="setFlatModalTab('Felújítási Alap')">Felújítási Alap</button>
                </div>
                
                <div class="table-responsive" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                    <table class="data-table">
                        <thead style="position: sticky; top: 0; z-index: 10;">
                            <tr>
                                <th>Dátum</th>
                                <th>Megjegyzés</th>
                                <th>Összeg</th>
                                <th>Egyenleg</th>
                            </tr>
                        </thead>
                        <tbody id="flat-modal-tbody">
                            <!-- populated by JS -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Fee edit form -->`;

if (regex.test(indexHtml)) {
    indexHtml = indexHtml.replace(regex, replacement);
    indexHtml = indexHtml.replace('<script src="app.js?v=34"></script>', '<script src="app.js?v=35"></script>');
    fs.writeFileSync(indexPath, indexHtml, 'utf8');
    console.log("Successfully replaced modal layout!");
} else {
    console.log("Regex did not match index.html!");
}
