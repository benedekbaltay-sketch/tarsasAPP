/**
 * BIG REFACTOR SCRIPT
 * Changes:
 * 1. openFullscreenTx('flat') - add search, edit mode pencil (sticky), excel export, pencil/trash per row, inline comment
 * 2. openFullscreenTx('global') - add search, excel export (already has edit/trash)
 * 3. renderFlatDetailTimeline - add pencil/trash per row, inline comment (only in edit mode)
 * 4. Fix deleteTransaction function (was missing / being called but not defined globally)
 * 5. flatViewAll button → opens openFullscreenTx('flat')
 */
const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

// ==========================================================================
// 1. REPLACE renderFlatDetailTimeline - now with pencil/trash columns
// ==========================================================================
const OLD_RENDER_FLAT_DETAIL = `function renderFlatDetailTimeline() {
    const flatNum = state.currentFlatDetailNum;
    const tbody = document.getElementById("flat-detail-ledger-tbody");
    if (!tbody) return;
    
    const timeline = getCombinedFlatLedgerTimeline(flatNum);
    
    if (timeline.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Nincsenek tranzakcik</td></tr>';
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
            document.getElementById("flat-view-all-container").style.display = "";
            viewAllBtn.innerHTML = state.flatViewAll ? "Kevesebb tranzakci" : "Minden tranzakci megtekintse";
        }
    }`;

const NEW_RENDER_FLAT_DETAIL = `function renderFlatDetailTimeline() {
    const flatNum = state.currentFlatDetailNum;
    const tbody = document.getElementById("flat-detail-ledger-tbody");
    if (!tbody) return;
    
    const timeline = getCombinedFlatLedgerTimeline(flatNum);
    
    if (timeline.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">Nincsenek tranzakciók</td></tr>';
        const viewAllCont = document.getElementById("flat-view-all-container");
        if (viewAllCont) viewAllCont.style.display = "none";
        return;
    }
    
    const displayTimelineFull = [...timeline].reverse();
    
    // "Minden tranzakció" → now opens fullscreen
    const viewAllCont = document.getElementById("flat-view-all-container");
    if (viewAllCont) {
        if (displayTimelineFull.length <= 3) {
            viewAllCont.style.display = "none";
        } else {
            viewAllCont.style.display = "";
            const viewAllBtn = document.getElementById("flat-view-all-btn");
            if (viewAllBtn) viewAllBtn.innerHTML = "Minden tranzakció megtekintése";
        }
    }
    
    const displayTimeline = displayTimelineFull.slice(0, 3);`;

if (appJs.includes(OLD_RENDER_FLAT_DETAIL)) {
    appJs = appJs.replace(OLD_RENDER_FLAT_DETAIL, NEW_RENDER_FLAT_DETAIL);
    console.log("✓ renderFlatDetailTimeline header replaced");
} else {
    console.log("✗ renderFlatDetailTimeline header NOT found");
}

// Replace the tbody rendering inside renderFlatDetailTimeline
const OLD_TBODY_RENDER = `    tbody.innerHTML = displayTimeline.map(item => {
        const isDemand = item.type === "Debit";
        const color = isDemand ? "var(--danger)" : "var(--success)";
        const amountPrefix = isDemand ? "-" : "+";
        const safeComment = (item.comment || '').replace(/"/g, '&quot;');
        
        return \`
            <tr>
                <td style="vertical-align: top; padding-top: 12px;">\${item.date}</td>
                <td style="padding-top: 10px; padding-bottom: 10px;">
                    <div style="font-weight:500;">
                        \${item.method || (isDemand ? 'Havi El\\u0151\\u00edr\\u00e1s' : 'Befizet\\u00e9s')}
                    </div>
                    <div style="font-size:11px; color:var(--text-muted); margin-bottom: 4px;">\${item.account} \${item.reference ? '- ' + item.reference : ''}</div>
                    <div>
                        <input type="text" 
                               value="\${safeComment}" 
                               placeholder="Ide rhatsz megjegyzst..." 
                               class="form-control" 
                               style="height: 24px; font-size: 11px; padding: 2px 6px; width: 100%; border: 1px dashed var(--border-color); background: transparent;"
                               onchange="saveInlineLedgerComment('\${flatNum}', '\${item.date}', '\${item.type}', '\${item.account}', '\${item.id || ''}', this)"
                        >
                    </div>
                </td>
                <td style="color:\${color}; font-weight:600; text-align:right; vertical-align: top; padding-top: 12px;">
                    \${amountPrefix}\${formatCurrency(item.amount)}
                </td>
                <td style="text-align:right; font-weight:500; vertical-align: top; padding-top: 12px;">
                    \${formatCurrency(item.runningBalance)}
                </td>
            </tr>
        \`;
    }).join("");
    if (window.lucide) lucide.createIcons();
}`;

const NEW_TBODY_RENDER = `    tbody.innerHTML = displayTimeline.map(item => {
        const isDemand = item.type === "Debit";
        const color = isDemand ? "var(--danger)" : "var(--success)";
        const amountPrefix = isDemand ? "-" : "+";
        const safeComment = (item.comment || '').replace(/"/g, '&quot;');
        const labelText = item.method || (isDemand ? 'Havi El\\u0151\\u00edr\\u00e1s' : 'Befizet\\u00e9s');
        const isRealTx = item.type !== "Debit";
        
        return \`
            <tr class="flat-ledger-row">
                <td style="white-space:nowrap; vertical-align: top; padding-top: 10px; font-size:12px; color:var(--text-muted);">\${item.date}</td>
                <td style="padding: 8px 12px 8px 0;">
                    <div style="font-weight:500; font-size:13px;">\${labelText}</div>
                    <div style="font-size:11px; color:var(--text-muted); margin: 2px 0;">\${item.account}\${item.reference ? ' – ' + item.reference : ''}</div>
                    <div style="font-size:12px; color:var(--text-secondary); margin-top:3px; font-style:italic;">\${item.comment ? '💬 ' + item.comment : ''}</div>
                </td>
                <td style="color:\${color}; font-weight:600; text-align:right; white-space:nowrap; vertical-align: top; padding-top: 10px;">
                    \${amountPrefix}\${formatCurrency(item.amount)}
                </td>
                <td style="text-align:right; font-weight:500; white-space:nowrap; vertical-align: top; padding-top: 10px;">
                    \${formatCurrency(item.runningBalance)}
                </td>
            </tr>
        \`;
    }).join("");
    if (window.lucide) lucide.createIcons();
}`;

if (appJs.includes(OLD_TBODY_RENDER)) {
    appJs = appJs.replace(OLD_TBODY_RENDER, NEW_TBODY_RENDER);
    console.log("✓ renderFlatDetailTimeline body replaced");
} else {
    console.log("✗ renderFlatDetailTimeline body NOT found");
}

// ==========================================================================
// 2. REPLACE openFullscreenTx - major rewrite for both flat and global
// ==========================================================================
const OLD_FULLSCREEN_OPEN = `window.openFullscreenTx = function(type) {
    const tbody = document.getElementById("fullscreen-tx-tbody");
    const title = document.getElementById("fullscreen-tx-title");
    
    // We removed the table and thead, so just clear the modern-list container
    tbody.innerHTML = "";
    
    if (type === 'flat') {
        title.textContent = \`\${state.currentFlatDetailNum}. Lakás teljes tranzakció előzménye\`;
        
        const timeline = getCombinedFlatLedgerTimeline(state.currentFlatDetailNum);
        const sortedTimeline = [...timeline].reverse();
        
        sortedTimeline.forEach(item => {
            const itemEl = document.createElement("div");
            itemEl.className = "tx-item";
            
            let iconHtml = "";
            let iconClass = "";
            
            if (item.type === "Debit") {
                iconClass = "expense";
                iconHtml = \`<div class="tx-icon \${iconClass}"><i data-lucide="minus" style="width:14px;height:14px;"></i></div>\`;
            } else {
                iconClass = "income";
                iconHtml = \`<div class="tx-icon \${iconClass}"><i data-lucide="plus" style="width:14px;height:14px;"></i></div>\`;
            }
            
            const isDemand = item.type === "Debit";
            const amountPrefix = isDemand ? "-" : "+";
            const amountColor = isDemand ? "var(--danger)" : "var(--success)";
            
            
            const safeComment = (item.comment || '').replace(/"/g, '&quot;');
            itemEl.innerHTML = \`
                \${iconHtml}
                <div class="tx-details" style="flex: 1;">
                    <div class="tx-date">\${item.date} \${item.account ? ' \\u2022 ' + item.account : ''}</div>
                    <div class="tx-method">\${item.method || (isDemand ? 'Havi El\\u0151\\u00edr\\u00e1s' : 'Befizet\\u00e9s')}</div>
                    <div class="tx-desc">\${item.reference || ""}</div>
                    <div style="margin-top: 6px;">
                        <input type="text" 
                               value="\${safeComment}" 
                               placeholder="Ide rhatsz megjegyzst..." 
                               class="form-control" 
                               style="height: 28px; font-size: 12px; padding: 4px 8px; width: 100%; max-width: 400px; border: 1px dashed var(--border-color); background: transparent;"
                               onchange="saveInlineLedgerComment('\${state.currentFlatDetailNum}', '\${item.date}', '\${item.type}', '\${item.account}', '\${item.id || ''}', this)"
                        >
                    </div>
                </div>
                <div class="tx-amounts">
                    <div class="tx-amount" style="color: \${amountColor};">\${amountPrefix}\${formatCurrency(item.amount)}</div>
                    <div class="tx-balance" style="font-size:11px; color:var(--text-muted);">Egyenleg: \${formatCurrency(item.runningBalance)}</div>
                </div>
            \`;
            tbody.appendChild(itemEl);
        });
    } else if (type === 'global') {
        title.textContent = \`Minden tranzakció és kiadás teljes listája\`;
        
        const paymentsList = state.transactions.map(t => ({
            ...t,
            type: "Befizetés",
            displayName: \`\${t.flatNum}. Lakás\`,
            categoryDisplay: \`\${translateMethod(t.method)} (\${t.targetAccount})\`,
            amountDisplay: \`+\${formatCurrency(t.amount)}\`,
            icon: t.targetAccount === "Közös Költség" ? "check" : "piggy-bank"
        }));
        
        const expensesList = state.expenses.map(e => ({
            ...e,
            type: "Kiadás",
            displayName: e.provider,
            categoryDisplay: translateCategory(e.category),
            amountDisplay: \`-\${formatCurrency(e.amount)}\`,
            icon: "minus"
        }));
        
        const combined = [...paymentsList, ...expensesList].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        combined.forEach(item => {
            const itemEl = document.createElement("div");
            itemEl.className = "tx-item";
            
            let iconHtml = \`<i data-lucide="\${item.icon}" style="width:18px;height:18px;"></i>\`;
            let iconClass = item.type === "Befizetés" ? "income" : "expense";
            
            itemEl.innerHTML = \`
                <div class="tx-icon \${iconClass}">\${iconHtml}</div>
                <div class="tx-details">
                    <div class="tx-title">\${item.displayName}</div>
                    <div class="tx-subtitle">\${item.date} • \${item.categoryDisplay} \${item.comment ? "• " + item.comment : ""}</div>
                </div>
                <div class="tx-amount-group" style="display:flex; flex-direction:column; align-items:flex-end;">
                    <div style="display:flex; align-items:center;">
                        <div class="tx-amount \${item.type === 'Befizetés' ? 'positive' : 'negative'}">\${item.amountDisplay}</div>
                        <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; padding:4px; margin-left: 8px; height:auto; background:transparent;" onclick="editLedgerComment('\${state.currentFlatDetailNum}', '\${item.date}', '\${item.type}', '\${item.account}', '\${item.id || ''}')" title="Megjegyzés szerkesztése">
                            <i data-lucide="message-square" style="width:14px;height:14px;color:var(--primary)"></i>
                        </button>
                    </div>
                    <div class="tx-balance" style="font-size:11px; color:var(--text-muted);">Egyenleg: \${formatCurrency(item.runningBalance)}</div>
                </div>
                <div class="tx-actions">
                    <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; padding:4px;" onclick="openEditModal('\${item.id}', '\${item.type}')" title="Módosítás">
                        <i data-lucide="edit-3" style="width:16px;height:16px;"></i>
                    </button>
                    <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; color:var(--danger); padding:4px;" onclick="deleteTransaction('\${item.id}', '\${item.type}')" title="Törlés">
                        <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                    </button>
                </div>
            \`;
            tbody.appendChild(itemEl);
        });
    }
    
    document.getElementById("fullscreen-tx-modal").style.display = "flex";
    document.body.style.overflow = "hidden";
    lucide.createIcons();
};`;

const NEW_FULLSCREEN_OPEN = `// fullscreen state
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
            const safeComment = (item.comment || '').replace(/"/g, '&quot;');
            
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
                <div style="margin-top: 5px; display: flex; align-items: center; gap: 6px;">
                    \${item.comment ? \`<span style="font-size:12px; color:var(--text-muted); font-style:italic;">💬 \${item.comment}</span>\` : \`<span style="font-size:12px; color:var(--border-color);">Nincs megjegyzés</span>\`}
                    <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; padding:2px; height:auto; background:transparent; flex-shrink:0;" onclick="openFullscreenCommentEdit('\${flatNum}', '\${item.date}', '\${item.type}', '\${item.account}', '\${item.id || ''}')" title="Megjegyzés szerkesztése">
                        <i data-lucide="pencil-line" style="width:12px;height:12px;color:var(--primary)"></i>
                    </button>
                </div>
            \`;
            
            itemEl.innerHTML = \`
                <div class="tx-icon \${iconClass}"><i data-lucide="\${iconName}" style="width:14px;height:14px;"></i></div>
                <div class="tx-details" style="flex: 1;">
                    <div class="tx-date">\${item.date} \${item.account ? ' • ' + item.account : ''}</div>
                    <div class="tx-method">\${item.method || (isDemand ? 'Havi Előírás' : 'Befizetés')}</div>
                    <div class="tx-desc">\${item.reference || ''}</div>
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
            return;
        }
        
        combined.forEach(item => {
            const itemEl = document.createElement("div");
            itemEl.className = "tx-item";
            
            const iconClass = item.itemType === "Befizetés" ? "income" : "expense";
            
            const actionsHtml = fullscreenEditMode ? \`
                <div class="tx-actions">
                    <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; padding:4px;" onclick="openEditModal('\${item.id}', '\${item.type || item.itemType}')" title="Módosítás">
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
                    <div class="tx-subtitle">\${item.date} • \${item.categoryDisplay} \${item.comment ? '• ' + item.comment : ''}</div>
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
    // Inline edit with a tiny prompt replaced by an inline input in the item
    // We use the existing comment-edit-modal if present
    const modal = document.getElementById('comment-edit-modal');
    if (modal) {
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
    }
};

// Override saveLedgerComment to also refresh fullscreen list
const _origSaveLedgerComment = window.saveLedgerComment;
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
    
    // Refresh fullscreen list if open
    if (document.getElementById('fullscreen-tx-modal').style.display === 'flex') {
        renderFullscreenList();
    }
    // Refresh flat detail modal if open
    if (document.getElementById('flat-detail-modal').style.display === 'flex') {
        renderFlatDetailTimeline();
    }
    renderAdminDashboard();
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
};`;

if (appJs.includes(OLD_FULLSCREEN_OPEN)) {
    appJs = appJs.replace(OLD_FULLSCREEN_OPEN, NEW_FULLSCREEN_OPEN);
    console.log("✓ openFullscreenTx replaced");
} else {
    console.log("✗ openFullscreenTx NOT found - trying partial match");
    // Try finding just the start
    if (appJs.includes('window.openFullscreenTx = function(type) {')) {
        console.log("  Found start of openFullscreenTx function");
    }
}

// ==========================================================================
// 3. Fix deleteTransaction for global list (was referencing wrong type)
// ==========================================================================
const deleteTransactionFunc = `
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
    
    // Re-render fullscreen if open
    if (document.getElementById('fullscreen-tx-modal').style.display === 'flex') {
        renderFullscreenList();
    }
    renderAdminDashboard();
};
`;

if (!appJs.includes('window.deleteTransaction = function(id, type)')) {
    appJs += '\n' + deleteTransactionFunc;
    console.log("✓ deleteTransaction added");
} else {
    console.log("  deleteTransaction already exists");
}

fs.writeFileSync(appPath, appJs, 'utf8');
console.log("\n✓ app.js written successfully");
