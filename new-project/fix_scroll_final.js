const fs = require('fs');
const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let data = fs.readFileSync(indexPath, 'utf8');

const regex = /<div id="fullscreen-tx-modal"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

const replacement = `<div id="fullscreen-tx-modal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:9999; background:var(--bg-main); flex-direction:column;">
    <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 24px; background:var(--bg-card); border-bottom:1px solid var(--border-color); flex-shrink:0;">
        <div style="display:flex; align-items:center; gap:16px;">
            <button class="btn btn-outline btn-sm btn-icon-only" onclick="closeFullscreenTx()" title="Vissza">
                <i data-lucide="arrow-left" style="width:16px;height:16px;"></i>
            </button>
            <h3 id="fullscreen-tx-title" style="margin:0; font-size:18px;">Összes tranzakció</h3>
        </div>
    </div>
    <div style="flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:24px;">
        <div id="fullscreen-tx-tbody" class="modern-list" style="max-width:860px; margin:0 auto; width:100%; display:flex; flex-direction:column; gap:0; background:var(--bg-card); border-radius:16px; border:1px solid var(--border-color);">
            <!-- Populated by JS -->
        </div>
    </div>
</div>`;

data = data.replace(regex, replacement);

data = data.replace('<script src="app.js?v=18"></script>', '<script src="app.js?v=19"></script>');

fs.writeFileSync(indexPath, data);
console.log("Completely rewrote fullscreen modal HTML for scrolling");
