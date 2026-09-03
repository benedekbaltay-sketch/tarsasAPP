import re

with open('C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find('function renderAdminTransactions(showAll = false) {')
end_idx = content.find('// --- Action Handlers ---')

if start_idx == -1 or end_idx == -1:
    print('Could not find boundaries')
    exit(1)

new_func = '''function renderAdminTransactions(showAll = false) {
    const query = document.getElementById("admin-search").value.toLowerCase();
    const tbody = document.getElementById("admin-transactions-tbody");
    tbody.innerHTML = "";
    
    const paymentsList = state.transactions.map(t => ({
        ...t,
        type: "Befizetés",
        displayName: ${t.flatNum}. Lakás,
        categoryDisplay: ${translateMethod(t.method)} (),
        amountDisplay: +,
        amountClass: "text-success",
        badgeClass: t.targetAccount === "Közös Költség" ? "status-verified" : "status-pending",
        badgeText: t.targetAccount === "Közös Költség" ? "Közös Költség" : "Felújítási Alap",
        icon: t.targetAccount === "Közös Költség" ? "check" : "piggy-bank"
    }));
    
    const expensesList = state.expenses.map(e => ({
        ...e,
        type: "Kiadás",
        displayName: e.provider,
        categoryDisplay: translateCategory(e.category),
        amountDisplay: -,
        amountClass: "text-danger",
        badgeClass: "status-expense",
        badgeText: "Kiadás",
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
        tbody.innerHTML = <div style="padding: 24px; text-align: center; color: var(--text-muted);">Nem található tranzakció.</div>;
        return;
    }
    
    const displayList = (showAll || query) ? combined : combined.slice(0, 5);
    
    displayList.forEach(item => {
        const itemEl = document.createElement("div");
        itemEl.className = "tx-item";
        
        let iconHtml = <i data-lucide="" style="width:18px;height:18px;"></i>;
        let iconClass = item.type === "Befizetés" ? "income" : "expense";
        
        itemEl.innerHTML = 
            <div class="tx-icon "></div>
            <div class="tx-details">
                <div class="tx-title"></div>
                <div class="tx-subtitle"> •  </div>
            </div>
            <div class="tx-amount-group">
                <div class="tx-amount "></div>
            </div>
            <div class="tx-actions">
                <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; padding:4px;" onclick="openEditModal('', '')" title="Módosítás">
                    <i data-lucide="edit-3" style="width:16px;height:16px;"></i>
                </button>
                <button class="btn btn-outline btn-sm btn-icon-only" style="border:none; color:var(--danger); padding:4px;" onclick="deleteTransaction('', '')" title="Törlés">
                    <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                </button>
            </div>
        ;
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
        itemEl.innerHTML = <i data-lucide="expand" style="width:16px;height:16px;margin-right:8px;vertical-align:middle;"></i> Mutasd az összeset;
        tbody.appendChild(itemEl);
    }
    
    lucide.createIcons();
}

'''

content = content[:start_idx] + new_func + content[end_idx:]

with open('C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
