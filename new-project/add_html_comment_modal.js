const fs = require('fs');

const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

const commentModalHtml = `
<!-- Comment Edit Modal (Inline) -->
<div id="comment-edit-modal" class="modal">
    <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
            <h3>Megjegyzés szerkesztése</h3>
            <button class="btn btn-outline btn-sm btn-icon-only" style="border:none;" onclick="document.getElementById('comment-edit-modal').style.display='none'">
                <i data-lucide="x" style="width:16px;height:16px;"></i>
            </button>
        </div>
        <div class="modal-body">
            <input type="hidden" id="comment-edit-flatnum">
            <input type="hidden" id="comment-edit-date">
            <input type="hidden" id="comment-edit-type">
            <input type="hidden" id="comment-edit-account">
            <input type="hidden" id="comment-edit-txid">
            
            <div class="form-group">
                <label>Megjegyzés szövege</label>
                <input type="text" id="comment-edit-input" class="form-control" placeholder="Ide írja a megjegyzést... (üresen hagyva törlődik)" autocomplete="off" onkeypress="if(event.key === 'Enter') saveLedgerComment();">
            </div>
            
            <div class="form-actions" style="margin-top: 20px;">
                <button type="button" class="btn btn-outline" onclick="document.getElementById('comment-edit-modal').style.display='none'">Mégse</button>
                <button type="button" class="btn btn-primary" onclick="saveLedgerComment()">Mentés</button>
            </div>
        </div>
    </div>
</div>
`;

if (!indexHtml.includes('id="comment-edit-modal"')) {
    indexHtml = indexHtml.replace('<!-- ================================================================', commentModalHtml + '\n<!-- ================================================================');
    fs.writeFileSync(indexPath, indexHtml, 'utf8');
    console.log("Added comment modal to index.html");
}

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const targetEditFunc = `window.editLedgerComment = function(flatNum, date, type, account, txId) {
    let currentComment = "";
    let txIndex = -1;
    let flatIndex = state.flats.findIndex(f => f.flatNum === flatNum);
    if (flatIndex === -1) return;
    
    if (type === "Debit") {
        if (state.flats[flatIndex].debitComments) {
            currentComment = state.flats[flatIndex].debitComments[\`\${date}_\${account}\`] || "";
        }
    } else {
        txIndex = state.transactions.findIndex(t => t.id === txId);
        if (txIndex !== -1) {
            currentComment = state.transactions[txIndex].comment || "";
        }
    }
    
    const newComment = prompt("Írja be a megjegyzést ehhez a tételhez (üresen hagyva törli):", currentComment);
    if (newComment === null) return;
    
    if (type === "Debit") {
        if (!state.flats[flatIndex].debitComments) state.flats[flatIndex].debitComments = {};
        state.flats[flatIndex].debitComments[\`\${date}_\${account}\`] = newComment.trim();
    } else if (txIndex !== -1) {
        state.transactions[txIndex].comment = newComment.trim();
    }
    
    saveStateToLocalStorage();
    
    // Refresh UI
    if (document.getElementById("flat-detail-modal").style.display === "flex") {
        // Just calling openFlatDetailModal again re-renders the detail view
        openFlatDetailModal(flatNum);
        
        // If the timeline fullscreen modal is also open, refresh it too
        if (document.getElementById("timeline-modal").style.display === "flex") {
            // Re-render the big list
            const timeline = getCombinedFlatLedgerTimeline(flatNum);
            const tbody = document.getElementById("timeline-tbody");
            // Find render logic... it's easier to just call renderFlatModalTimeline
            renderFlatModalTimeline(flatNum);
            lucide.createIcons();
        }
    }
    renderAdminDashboard();
};`;

const replacementEditFunc = `window.editLedgerComment = function(flatNum, date, type, account, txId) {
    let currentComment = "";
    let txIndex = -1;
    let flatIndex = state.flats.findIndex(f => f.flatNum === flatNum);
    if (flatIndex === -1) return;
    
    if (type === "Debit") {
        if (state.flats[flatIndex].debitComments) {
            currentComment = state.flats[flatIndex].debitComments[\`\${date}_\${account}\`] || "";
        }
    } else {
        txIndex = state.transactions.findIndex(t => t.id === txId);
        if (txIndex !== -1) {
            currentComment = state.transactions[txIndex].comment || "";
        }
    }
    
    document.getElementById("comment-edit-flatnum").value = flatNum;
    document.getElementById("comment-edit-date").value = date;
    document.getElementById("comment-edit-type").value = type;
    document.getElementById("comment-edit-account").value = account;
    document.getElementById("comment-edit-txid").value = txId || "";
    
    const inputEl = document.getElementById("comment-edit-input");
    inputEl.value = currentComment;
    
    document.getElementById("comment-edit-modal").style.display = "flex";
    setTimeout(() => { inputEl.focus(); inputEl.select(); }, 10);
};

window.saveLedgerComment = function() {
    const flatNum = document.getElementById("comment-edit-flatnum").value;
    const date = document.getElementById("comment-edit-date").value;
    const type = document.getElementById("comment-edit-type").value;
    const account = document.getElementById("comment-edit-account").value;
    const txId = document.getElementById("comment-edit-txid").value;
    const newComment = document.getElementById("comment-edit-input").value.trim();
    
    let flatIndex = state.flats.findIndex(f => f.flatNum === flatNum);
    if (flatIndex === -1) return;
    
    if (type === "Debit") {
        if (!state.flats[flatIndex].debitComments) state.flats[flatIndex].debitComments = {};
        state.flats[flatIndex].debitComments[\`\${date}_\${account}\`] = newComment;
    } else {
        let txIndex = state.transactions.findIndex(t => t.id === txId);
        if (txIndex !== -1) {
            state.transactions[txIndex].comment = newComment;
        }
    }
    
    saveStateToLocalStorage();
    document.getElementById("comment-edit-modal").style.display = "none";
    
    if (document.getElementById("flat-detail-modal").style.display === "flex") {
        openFlatDetailModal(flatNum);
        if (document.getElementById("timeline-modal").style.display === "flex") {
            renderFlatModalTimeline(flatNum);
            lucide.createIcons();
        }
    }
    renderAdminDashboard();
};`;

// We use split/join in case of exact match
if (appJs.includes(targetEditFunc)) {
    appJs = appJs.split(targetEditFunc).join(replacementEditFunc);
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Updated app.js with HTML modal logic");
} else {
    console.log("Could not find the target editLedgerComment function in app.js");
}
