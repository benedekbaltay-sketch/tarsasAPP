    const months = [];
    const startDate = new Date(2025, 5, 1); // 2025 June 1
    const endDate = new Date();
    endDate.setDate(1);
    endDate.setHours(0, 0, 0, 0);

    const monthNames = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];
    
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
    console.log(months);
