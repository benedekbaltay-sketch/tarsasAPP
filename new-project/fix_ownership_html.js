const fs = require('fs');

const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// 1. Add to Read-only grid
const roTenantHtml = `<div>
                        <span class="stat-label" style="margin-bottom:2px; display:block;">Lakók száma</span>
                        <strong style="font-size:14px;" id="ro-flat-tenant-count">–</strong>
                    </div>`;
const newRoTenantHtml = `<div>
                        <span class="stat-label" style="margin-bottom:2px; display:block;">Tulajdoni hányad</span>
                        <strong style="font-size:14px;" id="ro-flat-ownership">–</strong>
                    </div>
                    ` + roTenantHtml;
indexHtml = indexHtml.replace(roTenantHtml, newRoTenantHtml);

// 2. Add to Edit form
const editTenantHtml = `<div class="form-group" style="margin:0;flex:1;min-width:100px;">
                        <label for="flat-tenant-input">Lakók száma (fő)</label>
                        <input id="flat-tenant-input" type="number" min="0" class="form-input" />
                    </div>`;
const newEditTenantHtml = `<div class="form-group" style="margin:0;flex:1;min-width:100px;">
                        <label for="flat-ownership-input">Tulajdoni hányad (%)</label>
                        <input id="flat-ownership-input" type="number" step="0.01" min="0" class="form-input" />
                    </div>
                    ` + editTenantHtml;
indexHtml = indexHtml.replace(editTenantHtml, newEditTenantHtml);

// 3. Add to New Flat Form
const newFlatTenantHtml = `<div class="form-group">
                    <label for="new-flat-tenant">Lakók száma</label>
                    <input type="number" id="new-flat-tenant" class="form-input" min="1" value="1" required>
                </div>`;
const addedNewFlatOwnershipHtml = `<div class="form-group">
                    <label for="new-flat-ownership">Tulajdoni hányad (%)</label>
                    <input type="number" id="new-flat-ownership" class="form-input" step="0.01" min="0" required>
                </div>
                ` + newFlatTenantHtml;
indexHtml = indexHtml.replace(newFlatTenantHtml, addedNewFlatOwnershipHtml);

indexHtml = indexHtml.replace('v=46', 'v=47');
fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log("Updated index.html");
