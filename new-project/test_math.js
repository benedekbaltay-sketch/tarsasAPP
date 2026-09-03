    const flat = {
        monthlyFee: 30000,
        feeChangesKK: [ { date: '2026-06-01', amount: 20000 } ]
    };
    const months = [];
    const startDate = new Date(2025, 5, 1);
    const endDate = new Date();
    endDate.setDate(1);
    endDate.setHours(0, 0, 0, 0);

    let currentD = new Date(startDate);
    while (currentD <= endDate) {
        const y = currentD.getFullYear();
        const m = currentD.getMonth();
        const padM = (m + 1).toString().padStart(2, '0');
        months.push({ date: `${y}-${padM}-01` });
        currentD.setMonth(currentD.getMonth() + 1);
    }
    
    let totalDebit = 0;
    months.forEach(m => {
        let debitAmount = flat.monthlyFee;
        const currentMonthDate = new Date(m.date);
        
        if (flat.feeChangesKK && flat.feeChangesKK.length > 0) {
            const activeChanges = flat.feeChangesKK.filter(c => new Date(c.date) <= currentMonthDate);
            if (activeChanges.length > 0) {
                activeChanges.sort((a, b) => new Date(b.date) - new Date(a.date));
                debitAmount = activeChanges[0].amount;
            }
        }
        if (m.date >= '2026-06-01') {
            console.log(m.date, '->', debitAmount);
        }
        totalDebit += debitAmount;
    });
