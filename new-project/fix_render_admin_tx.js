const fs = require('fs');

const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
let appJs = fs.readFileSync(appPath, 'utf8');

const cleanFunc = `function renderAdminTransactions(showAll = false) {
    const queryInput = document.getElementById("admin-search");
    const query = queryInput ? queryInput.value.toLowerCase() : "";
    const tbody = document.getElementById("admin-transactions-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    const isEditMode = state.adminTxEditMode === true;
    const isEn = (state.currentLang === 'en');
    
    const paymentsList = state.transactions.map(t => ({
        ...t,
        type: isEn ? "Payment" : "Befizetés",
        displayName: isEn ? \`Flat \${t.flatNum}\` : \`\${t.flatNum}. Lakás\`,
        categoryDisplay: \`\${translateMethod(t.method)} (\${t.targetAccount === "Közös Költség" ? (isEn ? "Common Cost" : "Közös Költség") : (isEn ? "Renovation Fund" : "Felújítási Alap")})\`,
        amountDisplay: \`+\${formatCurrency(t.amount)}\`,
        amountClass: "text-success",
        badgeClass: t.targetAccount === "Közös Költség" ? "status-verified" : "status-pending",
        badgeText: t.targetAccount === "Közös Költség" ? (isEn ? "Common Cost" : "Közös Költség") : (isEn ? "Renovation Fund" : "Felújítási Alap"),
        icon: t.targetAccount === "Közös Költség" ? "check" : "piggy-bank"
    }));
    
    const expensesList = state.expenses.map(e => ({
        ...e,
        type: isEn ? "Expense" : "Kiadás",
        displayName: e.provider,
        categoryDisplay: translateCategory(e.category),
        amountDisplay: \`-\${formatCurrency(e.amount)}\`,
        amountClass: "text-danger",
        badgeClass: "status-expense",
        badgeText: isEn ? "Expense" : "Kiadás",
        icon: "minus"
    }));
    
    const combined = [...paymentsList, ...expensesList]
        .filter(item => {
            return item.date.includes(query) || 
                   item.displayName.toLowerCase().includes(query) ||
                   item.categoryDisplay.toLowerCase().includes(query) ||
                   item.amountDisplay.includes(query) ||
                   item.type.toLowerCase().includes(query) ||
                   (item.comment && item.comment.toLowerCase().includes(query));
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));
        
    if (combined.length === 0) {
        tbody.innerHTML = \`<div style="padding:80px 24px; text-align:center; color:var(--text-muted); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; min-height:520px;">
        <i data-lucide="search-x" style="width:40px;height:40px;opacity:0.4;"></i>
        <div style="font-size:15px; font-weight:500;">\${isEn ? "No transactions found" : "Nem található tranzakció"}</div>
        <div style="font-size:13px; opacity:0.8;">\${isEn ? "Try searching with a different term!" : "Próbálj meg más keresési kifejezést beírni!"}</div>
    </div>\`;
        if (window.lucide) lucide.createIcons();
        return;
    }
    
    const displayList = (showAll || query) ? combined : combined.slice(0, 5);
    
    displayList.forEach(item => {
        const itemEl = document.createElement("div");
        itemEl.className = "tx-item";
        
        let iconHtml = \`<i data-lucide="\${item.icon}" style="width:18px;height:18px;"></i>\`;
        let iconClass = (item.type === "Befizetés" || item.type === "Payment") ? "income" : "expense";
        
        itemEl.innerHTML = \`
            <div class="tx-icon \${iconClass}">\${iconHtml}</div>
            <div class="tx-details">
                <div class="tx-title">\${item.displayName}</div>
                <div class="tx-subtitle">\${item.date} • \${item.categoryDisplay} \${item.comment ? "• " + item.comment : ""}</div>
            </div>
            <div class="tx-amount-group">
                <div class="tx-amount \${iconClass === 'income' ? 'positive' : 'negative'}">\${item.amountDisplay}</div>
            </div>
            \${isEditMode ? \`<div class="tx-actions">
                <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; padding:4px;" onclick="openEditModal('\${item.id}', '\${item.type}')" title="\${isEn ? 'Edit' : 'Módosítás'}">
                    <i data-lucide="edit-3" style="width:16px;height:16px;"></i>
                </button>
                <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; color:var(--danger); padding:4px;" onclick="deleteTransaction('\${item.id}', '\${item.type}')" title="\${isEn ? 'Delete' : 'Törlés'}">
                    <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                </button>
            </div>\` : ''}
        \`;
        tbody.appendChild(itemEl);
    });
    
    if (!query && combined.length > 5) {
        const itemEl = document.createElement("div");
        itemEl.className = "tx-item";
        itemEl.style.justifyContent = "center";
        itemEl.style.color = "var(--primary)";
        itemEl.style.fontWeight = "500";
        itemEl.style.cursor = "pointer";
        itemEl.onclick = () => openFullscreenTx('global');
        itemEl.innerHTML = \`<i data-lucide="expand" style="width:16px;height:16px;margin-right:8px;vertical-align:middle;"></i> \${isEn ? "Show all" : "Mutasd az összeset"}\`;
        tbody.appendChild(itemEl);
    }
    
    if (window.lucide) lucide.createIcons();
}`;

const startIdx = appJs.indexOf("function renderAdminTransactions(");
const endIdx = appJs.indexOf("window.toggleAdminTxEditMode = function()");

if (startIdx !== -1 && endIdx !== -1) {
    appJs = appJs.substring(0, startIdx) + cleanFunc + "\n\n" + appJs.substring(endIdx);
    fs.writeFileSync(appPath, appJs, 'utf8');
    console.log("Successfully replaced renderAdminTransactions with clean version");
} else {
    console.error("Could not find start/end indices for renderAdminTransactions");
}
