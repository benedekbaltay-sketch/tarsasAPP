/**
 * Replace the openFullscreenTx function directly using file position
 */
const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const startMarker = 'window.openFullscreenTx = function(type) {';
const endMarker = 'window.closeFullscreenTx = function() {';

const startIdx = appJs.indexOf(startMarker);
const endIdx = appJs.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
    console.log("Markers not found!");
    process.exit(1);
}

const newFullscreenBlock = `// Fullscreen state vars
let fullscreenEditMode = false;
let fullscreenType = null;
let fullscreenSearchQuery = '';

function renderFullscreenList() {
    const tbody = document.getElementById("fullscreen-tx-tbody");
    tbody.innerHTML = "";
    
    if (fullscreenType === 'flat') {
        const flatNum = state.currentFlatDetailNum;
        const timeline = getCombinedFlatLedgerTimeline(flatNum);
        let items = [...timeline].reverse();
        
        if (fullscreenSearchQuery) {
            const q = fullscreenSearchQuery.toLowerCase();
            items = items.filter(item =>
                item.date.includes(q) ||
                (item.method && item.method.toLowerCase().includes(q)) ||
                (item.account && item.account.toLowerCase().includes(q)) ||
                (item.comment && item.comment.toLowerCase().includes(q)) ||
                formatCurrency(Math.abs(item.amount)).includes(q)
            );
        }
        
        if (items.length === 0) {
            tbody.innerHTML = \`<div style="padding:32px; text-align:center; color:var(--text-muted);">Nem található tranzakció.</div>\`;
            lucide.createIcons();
            return;
        }
        
        items.forEach(item => {
            const itemEl = document.createElement("div");
            itemEl.className = "tx-item";
            
            const isDemand = item.type === "Debit";
            const iconClass = isDemand ? "expense" : "income";
            const iconName = isDemand ? "minus" : "plus";
            const amountPrefix = isDemand ? "-" : "+";
            const amountColor = isDemand ? "var(--danger)" : "var(--success)";
            
            const actionsHtml = fullscreenEditMode && !isDemand ? \`
                <div class="tx-actions">
                    <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; padding:4px;" onclick="openEditModal('\${item.id}', 'Befizetés')" title="Módosítás">
                        <i data-lucide="edit-3" style="width:16px;height:16px;"></i>
                    </button>
                    <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; color:var(--danger); padding:4px;" onclick="deleteFlatLedgerTx('\${item.id}')" title="Törlés">
                        <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                    </button>
                </div>
            \` : '';
            
            const commentHtml = \`
                <div style="margin-top: 5px; display: flex; align-items: center; gap: 6px; flex-wrap:wrap;">
                    \${item.comment
                        ? \`<span style="font-size:12px; color:var(--text-muted); font-style:italic;">💬 \${item.comment}</span>\`
                        : \`<span style="font-size:11px; color:var(--border-color);">–</span>\`}
                    <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; padding:2px; height:auto; background:transparent; flex-shrink:0;" onclick="openFullscreenCommentEdit('\${flatNum}', '\${item.date}', '\${item.type}', '\${item.account}', '\${item.id || ''}')" title="Megjegyzés szerkesztése">
                        <i data-lucide="pencil-line" style="width:12px;height:12px;color:var(--primary)"></i>
                    </button>
                </div>
            \`;
            
            itemEl.innerHTML = \`
                <div class="tx-icon \${iconClass}"><i data-lucide="\${iconName}" style="width:14px;height:14px;"></i></div>
                <div class="tx-details" style="flex: 1;">
                    <div class="tx-date">\${item.date}\${item.account ? ' • ' + item.account : ''}</div>
                    <div class="tx-method">\${item.method || (isDemand ? 'Havi Előírás' : 'Befizetés')}</div>
                    \${item.reference ? \`<div class="tx-desc">\${item.reference}</div>\` : ''}
                    \${commentHtml}
                </div>
                <div class="tx-amounts">
                    <div class="tx-amount" style="color: \${amountColor};">\${amountPrefix}\${formatCurrency(item.amount)}</div>
                    <div class="tx-balance" style="font-size:11px; color:var(--text-muted);">Egyenleg: \${formatCurrency(item.runningBalance)}</div>
                </div>
                \${actionsHtml}
            \`;
            tbody.appendChild(itemEl);
        });
        
    } else if (fullscreenType === 'global') {
        const paymentsList = state.transactions.map(t => ({
            ...t,
            itemType: "Befizetés",
            displayName: \`\${t.flatNum}. Lakás\`,
            categoryDisplay: \`\${translateMethod(t.method)} (\${t.targetAccount})\`,
            amountDisplay: \`+\${formatCurrency(t.amount)}\`,
            icon: t.targetAccount === "Közös Költség" ? "check" : "piggy-bank"
        }));
        
        const expensesList = state.expenses.map(e => ({
            ...e,
            itemType: "Kiadás",
            displayName: e.provider,
            categoryDisplay: translateCategory(e.category),
            amountDisplay: \`-\${formatCurrency(e.amount)}\`,
            icon: "minus"
        }));
        
        let combined = [...paymentsList, ...expensesList].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (fullscreenSearchQuery) {
            const q = fullscreenSearchQuery.toLowerCase();
            combined = combined.filter(item =>
                item.date.includes(q) ||
                item.displayName.toLowerCase().includes(q) ||
                item.categoryDisplay.toLowerCase().includes(q) ||
                item.amountDisplay.includes(q) ||
                (item.comment && item.comment.toLowerCase().includes(q))
            );
        }
        
        if (combined.length === 0) {
            tbody.innerHTML = \`<div style="padding:32px; text-align:center; color:var(--text-muted);">Nem található tranzakció.</div>\`;
            lucide.createIcons();
            return;
        }
        
        combined.forEach(item => {
            const itemEl = document.createElement("div");
            itemEl.className = "tx-item";
            
            const iconClass = item.itemType === "Befizetés" ? "income" : "expense";
            
            const actionsHtml = fullscreenEditMode ? \`
                <div class="tx-actions">
                    <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; padding:4px;" onclick="openEditModal('\${item.id}', '\${item.itemType}')" title="Módosítás">
                        <i data-lucide="edit-3" style="width:16px;height:16px;"></i>
                    </button>
                    <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; color:var(--danger); padding:4px;" onclick="deleteTransaction('\${item.id}', '\${item.itemType}')" title="Törlés">
                        <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                    </button>
                </div>
            \` : '';
            
            itemEl.innerHTML = \`
                <div class="tx-icon \${iconClass}"><i data-lucide="\${item.icon}" style="width:18px;height:18px;"></i></div>
                <div class="tx-details">
                    <div class="tx-title">\${item.displayName}</div>
                    <div class="tx-subtitle">\${item.date} • \${item.categoryDisplay}\${item.comment ? ' • ' + item.comment : ''}</div>
                </div>
                <div class="tx-amount-group">
                    <div class="tx-amount \${item.itemType === 'Befizetés' ? 'positive' : 'negative'}">\${item.amountDisplay}</div>
                </div>
                \${actionsHtml}
            \`;
            tbody.appendChild(itemEl);
        });
    }
    
    lucide.createIcons();
}

window.openFullscreenCommentEdit = function(flatNum, date, type, account, txId) {
    const modal = document.getElementById('comment-edit-modal');
    if (!modal) return;
    document.getElementById('comment-edit-flatnum').value = flatNum;
    document.getElementById('comment-edit-date').value = date;
    document.getElementById('comment-edit-type').value = type;
    document.getElementById('comment-edit-account').value = account;
    document.getElementById('comment-edit-txid').value = txId;
    
    let currentComment = '';
    if (type === 'Debit') {
        const flat = state.flats.find(f => f.flatNum === flatNum);
        if (flat && flat.debitComments) currentComment = flat.debitComments[\`\${date}_\${account}\`] || '';
    } else {
        const tx = state.transactions.find(t => t.id === txId);
        if (tx) currentComment = tx.comment || '';
    }
    document.getElementById('comment-edit-input').value = currentComment;
    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('comment-edit-input').focus(), 10);
};

window.deleteFlatLedgerTx = function(txId) {
    if (!confirm("Biztosan törölni szeretnéd ezt a tranzakciót? Ez visszavonhatatlan.")) return;
    const index = state.transactions.findIndex(t => t.id === txId);
    if (index !== -1) {
        state.transactions.splice(index, 1);
        saveStateToLocalStorage();
        recalculateFlatBalances();
        renderFullscreenList();
        if (document.getElementById('flat-detail-modal').style.display === 'flex') {
            openFlatDetailModal(state.currentFlatDetailNum);
        }
        renderAdminDashboard();
    }
};

window.toggleFullscreenEditMode = function() {
    fullscreenEditMode = !fullscreenEditMode;
    const btn = document.getElementById('fullscreen-edit-btn');
    if (btn) {
        if (fullscreenEditMode) {
            btn.innerHTML = '<i data-lucide="check" style="width:16px;height:16px;"></i> <span>Kész</span>';
            btn.style.background = 'var(--success)';
            btn.style.color = '#fff';
            btn.style.border = 'none';
        } else {
            btn.innerHTML = '<i data-lucide="pencil" style="width:16px;height:16px;"></i> <span>Szerkesztés</span>';
            btn.style.background = '';
            btn.style.color = '';
            btn.style.border = '';
        }
        lucide.createIcons();
    }
    renderFullscreenList();
};

window.exportFullscreenToExcel = function() {
    if (!window.XLSX) { alert('Excel exportáló nem elérhető.'); return; }
    if (fullscreenType === 'flat') {
        exportFlatDetailToExcel();
    } else {
        exportTransactionsToExcel();
    }
};

window.openFullscreenTx = function(type) {
    fullscreenType = type;
    fullscreenEditMode = false;
    fullscreenSearchQuery = '';
    
    const title = document.getElementById("fullscreen-tx-title");
    if (type === 'flat') {
        title.textContent = \`\${state.currentFlatDetailNum}. Lakás – Teljes előzmény\`;
    } else {
        title.textContent = \`Minden tranzakció és kiadás\`;
    }
    
    // Reset edit button
    const editBtn = document.getElementById('fullscreen-edit-btn');
    if (editBtn) {
        editBtn.innerHTML = '<i data-lucide="pencil" style="width:16px;height:16px;"></i> <span>Szerkesztés</span>';
        editBtn.style.background = '';
        editBtn.style.color = '';
        editBtn.style.border = '';
    }
    
    // Reset search
    const searchInput = document.getElementById('fullscreen-search-input');
    if (searchInput) searchInput.value = '';
    
    renderFullscreenList();
    
    document.getElementById("fullscreen-tx-modal").style.display = "flex";
    document.body.style.overflow = "hidden";
    lucide.createIcons();
};

// Also rewrite saveLedgerComment to refresh fullscreen list
window.saveLedgerComment = function() {
    const flatNum = document.getElementById('comment-edit-flatnum').value;
    const date = document.getElementById('comment-edit-date').value;
    const type = document.getElementById('comment-edit-type').value;
    const account = document.getElementById('comment-edit-account').value;
    const txId = document.getElementById('comment-edit-txid').value;
    const newComment = document.getElementById('comment-edit-input').value.trim();
    
    let flatIndex = state.flats.findIndex(f => f.flatNum === flatNum);
    if (flatIndex === -1) return;
    
    if (type === "Debit") {
        if (!state.flats[flatIndex].debitComments) state.flats[flatIndex].debitComments = {};
        state.flats[flatIndex].debitComments[\`\${date}_\${account}\`] = newComment;
    } else {
        let txIndex = state.transactions.findIndex(t => t.id === txId);
        if (txIndex !== -1) state.transactions[txIndex].comment = newComment;
    }
    
    saveStateToLocalStorage();
    document.getElementById('comment-edit-modal').style.display = 'none';
    
    if (document.getElementById('fullscreen-tx-modal').style.display === 'flex') {
        renderFullscreenList();
    }
    if (document.getElementById('flat-detail-modal').style.display === 'flex') {
        renderFlatDetailTimeline();
    }
    renderAdminDashboard();
};

// Fix deleteTransaction for global list
window.deleteTransaction = function(id, type) {
    if (!confirm("Biztosan törölni szeretnéd ezt a tételt? Ez visszavonhatatlan.")) return;
    
    if (type === "Befizetés" || type === "Credit" || type === "Correction") {
        const idx = state.transactions.findIndex(t => t.id === id);
        if (idx !== -1) {
            state.transactions.splice(idx, 1);
            saveStateToLocalStorage();
            recalculateFlatBalances();
        }
    } else if (type === "Kiadás") {
        const idx = state.expenses.findIndex(e => e.id === id);
        if (idx !== -1) {
            state.expenses.splice(idx, 1);
            saveStateToLocalStorage();
        }
    }
    
    if (document.getElementById('fullscreen-tx-modal').style.display === 'flex') {
        renderFullscreenList();
    }
    renderAdminDashboard();
};

`;

appJs = appJs.substring(0, startIdx) + newFullscreenBlock + appJs.substring(endIdx);
fs.writeFileSync(appPath, appJs, 'utf8');
console.log("✓ openFullscreenTx and helpers replaced via position");
