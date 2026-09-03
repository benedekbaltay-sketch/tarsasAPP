const monthNames = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];

function getMonths() {
    const months = [];
    const startDate = new Date(2025, 5, 1); // 2025 June 1
    const endDate = new Date();
    endDate.setDate(1);
    endDate.setHours(0, 0, 0, 0);

    let currentD = new Date(startDate);
    while (currentD <= endDate) {
        const y = currentD.getFullYear();
        const m = currentD.getMonth();
        const padM = (m + 1).toString().padStart(2, '0');
        months.push({
            date: `${y}-${padM}-01`,
            name: `${y} ${monthNames[m]}`
        });
        currentD.setMonth(currentD.getMonth() + 1);
    }
    return months;
}

function getDebitAmount(flat, targetAccount, monthDateStr) {
    let debitAmount = 0;
    const currentMonthDate = new Date(monthDateStr);
    
    if (targetAccount === "Közös Költség") {
        debitAmount = flat.monthlyFee;
        if (flat.feeChangesKK && flat.feeChangesKK.length > 0) {
            const activeChanges = flat.feeChangesKK.filter(c => new Date(c.date) <= currentMonthDate);
            if (activeChanges.length > 0) {
                activeChanges.sort((a, b) => new Date(b.date) - new Date(a.date));
                debitAmount = activeChanges[0].amount;
            }
        }
    }
    return debitAmount;
}

function calcTotalDebit(flat) {
    const months = getMonths();
    let total = 0;
    months.forEach(m => {
        total += getDebitAmount(flat, "Közös Költség", m.date);
    });
    return total;
}

let testFlat = { flatNum: '1', monthlyFee: 30000, feeChangesKK: [] };
let origDebit = calcTotalDebit(testFlat);
console.log("Original Total Debit (June 2025 - Aug 2026):", origDebit);

// Add fee change
testFlat.feeChangesKK.push({ date: '2026-06-01', amount: 20000 });
let newDebit = calcTotalDebit(testFlat);
console.log("New Total Debit (June 2025 - Aug 2026):", newDebit);
console.log("Difference:", origDebit - newDebit);
