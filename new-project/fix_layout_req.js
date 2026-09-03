const fs = require('fs');

// Update index.html
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let html = fs.readFileSync(indexPath, 'utf8');

// 1. Change grid to repeat(3, 1fr)
html = html.replace('grid-template-columns: repeat(2, 1fr);', 'grid-template-columns: repeat(3, 1fr);');

// 2. Move view-all button to the table footer
const oldWrapper = `<div id="flat-detail-ledger-wrapper">
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
                    <button class="btn btn-outline" id="flat-view-all-btn" onclick="openFullscreenTx('flat')">Minden tranzakció megjelenítése</button>
                </div>
            </div>`;

const newWrapper = `<div id="flat-detail-ledger-wrapper">
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
                        <tfoot id="flat-view-all-container">
                            <tr>
                                <td colspan="4" style="text-align:center; padding: 12px; background: var(--bg-body);">
                                    <button class="btn btn-outline btn-sm" id="flat-view-all-btn" onclick="openFullscreenTx('flat')">Minden tranzakció megjelenítése</button>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>`;

if (html.includes(oldWrapper)) {
    html = html.replace(oldWrapper, newWrapper);
} else {
    // Maybe whitespace is slightly different. Let's do a more robust replace.
    // We can just replace the bottom part of the wrapper
    const findOldTableEnd = `</tbody>
                    </table>
                </div>
                <div id="flat-view-all-container" style="text-align:center; padding-top:16px;">
                    <button class="btn btn-outline" id="flat-view-all-btn" onclick="openFullscreenTx('flat')">Minden tranzakció megjelenítése</button>
                </div>`;
                
    const replaceNewTableEnd = `</tbody>
                        <tfoot id="flat-view-all-container">
                            <tr>
                                <td colspan="4" style="text-align:center; padding: 12px; background: var(--bg-body);">
                                    <button class="btn btn-outline btn-sm" id="flat-view-all-btn" onclick="openFullscreenTx('flat')">Minden tranzakció megjelenítése</button>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>`;
    html = html.replace(findOldTableEnd, replaceNewTableEnd);
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log("Updated index.html");

// Update app.js
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// Change style.display = "block" to style.display = "" for flat-view-all-container
// so that tfoot restores to default table-footer-group
appJs = appJs.replace(/document\.getElementById\("flat-view-all-container"\)\.style\.display = "block";/g, 'document.getElementById("flat-view-all-container").style.display = "";');

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("Updated app.js");
