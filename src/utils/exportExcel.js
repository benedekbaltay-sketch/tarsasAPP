import XLSX from 'xlsx-js-style';

export function exportTransactionsToExcel(transactions, expenses, isEn = false) {
  const combined = [
    ...(transactions || []).map(t => ({
      [isEn ? "Date" : "Dátum"]: t.date,
      [isEn ? "Flat" : "Lakás"]: t.flatNum || "-",
      [isEn ? "Account" : "Számla"]: t.targetAccount,
      [isEn ? "Type" : "Típus"]: isEn ? "Payment" : "Befizetés",
      [isEn ? "Amount (HUF)" : "Összeg (Ft)"]: t.amount,
      [isEn ? "Method" : "Módszer"]: t.method || "-",
      [isEn ? "Comment" : "Megjegyzés"]: t.comment || ""
    })),
    ...(expenses || []).map(e => ({
      [isEn ? "Date" : "Dátum"]: e.date,
      [isEn ? "Flat" : "Lakás"]: "-",
      [isEn ? "Account" : "Számla"]: e.targetAccount,
      [isEn ? "Type" : "Típus"]: isEn ? "Expense" : "Kiadás",
      [isEn ? "Amount (HUF)" : "Összeg (Ft)"]: -Math.abs(e.amount),
      [isEn ? "Method" : "Módszer"]: e.category || "-",
      [isEn ? "Comment" : "Megjegyzés"]: e.comment || ""
    }))
  ];

  combined.sort((a, b) => {
    const dateKey = isEn ? "Date" : "Dátum";
    return new Date(b[dateKey]) - new Date(a[dateKey]);
  });

  const ws = XLSX.utils.json_to_sheet(combined);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isEn ? "Transactions" : "Tranzakciók");
  XLSX.writeFile(wb, `tranzakciok_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportTimelineToExcel(timeline, flatNum, isEn = false) {
  const data = (timeline || []).map(item => ({
    [isEn ? "Date" : "Dátum"]: item.date,
    [isEn ? "Account" : "Számla"]: item.account || item.targetAccount,
    [isEn ? "Type" : "Típus"]: item.type === "Debit" ? (isEn ? "Debit" : "Előírás") : (isEn ? "Payment" : "Befizetés"),
    [isEn ? "Amount (HUF)" : "Összeg (Ft)"]: item.amount,
    [isEn ? "Balance (HUF)" : "Egyenleg (Ft)"]: item.runningBalance !== undefined ? item.runningBalance : "",
    [isEn ? "Comment" : "Megjegyzés"]: item.comment || ""
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isEn ? `Flat_${flatNum}` : `Lakas_${flatNum}`);
  XLSX.writeFile(wb, `folyoszamla_${flatNum.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Exports the General Assembly Owner Balances Statement (Tulajdonosi egyenlegek elszámolása)
 * to a beautifully styled Excel (.xlsx) file with cell borders, typography, live formulas,
 * and exact headers.
 * 
 * Filename format: Tulajdonosi_egyenlegek_[KezdőDátum]_[ZáróDátum].xlsx
 */
export function exportOwnerBalancesToExcel(reportData, isEn = false) {
  if (!reportData || !reportData.rows) return;

  const startFormatted = reportData.startDateStr.replace(/-/g, '.');
  const endFormatted = reportData.endDateStr.replace(/-/g, '.');
  const filename = `Tulajdonosi_egyenlegek_${startFormatted}_${endFormatted}.xlsx`;

  const numFmt = '#,##0';
  const ws = {};

  // Row heights tracker
  const rowHeights = [];

  // 1. Header Title & Metadata
  // Row 1: Title
  ws['A1'] = {
    t: 's',
    v: isEn ? "CONDOMINIUM OWNER BALANCES STATEMENT" : "TULAJDONOSI EGYENLEGEK ELSZÁMOLÁSA",
    s: {
      font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: '1E3A8A' } },
      alignment: { vertical: 'center' }
    }
  };
  rowHeights.push({ hpt: 26 });

  // Row 2: Building name & address
  ws['A2'] = {
    t: 's',
    v: isEn ? "Condominium:" : "Társasház:",
    s: {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '4B5563' } },
      alignment: { vertical: 'center' }
    }
  };
  const bldgText = `${reportData.building?.name || "Társasház"}${reportData.building?.address ? ` (${reportData.building.address})` : ''}${reportData.building?.taxNumber ? ` • Adószám: ${reportData.building.taxNumber}` : ''}`;
  ws['B2'] = {
    t: 's',
    v: bldgText,
    s: {
      font: { name: 'Calibri', sz: 10, color: { rgb: '111827' } },
      alignment: { vertical: 'center' }
    }
  };
  rowHeights.push({ hpt: 18 });

  // Row 3: Period
  ws['A3'] = {
    t: 's',
    v: isEn ? "Period:" : "Elszámolási időszak:",
    s: {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '4B5563' } },
      alignment: { vertical: 'center' }
    }
  };
  ws['B3'] = {
    t: 's',
    v: `${startFormatted} – ${endFormatted} (${reportData.monthsCount} ${isEn ? "months" : "hónap"})`,
    s: {
      font: { name: 'Calibri', sz: 10, color: { rgb: '111827' } },
      alignment: { vertical: 'center' }
    }
  };
  rowHeights.push({ hpt: 18 });

  // Row 4: Formula / Principle
  ws['A4'] = {
    t: 's',
    v: isEn ? "Accounting rule:" : "Számviteli szabály:",
    s: {
      font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: '6B7280' } },
      alignment: { vertical: 'center' }
    }
  };
  ws['B4'] = {
    t: 's',
    v: isEn ? "Closing Balance = Opening Balance - Period Prescriptions + Period Payments" : "Záró egyenleg = Nyitó egyenleg - Időszaki előírás + Időszaki befizetés",
    s: {
      font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: '6B7280' } },
      alignment: { vertical: 'center' }
    }
  };
  rowHeights.push({ hpt: 18 });

  // Row 5: Blank separator
  rowHeights.push({ hpt: 10 });

  // Row 6: Exact 7 Table Headers requested by user:
  // Albetét | Tulajdonos(ok) | Alap | Nyitó | Előírás | Befizetés | Záró
  const headers = [
    isEn ? "Unit" : "Albetét",
    isEn ? "Owner(s)" : "Tulajdonos(ok)",
    isEn ? "Fund" : "Alap",
    isEn ? "Opening" : "Nyitó",
    isEn ? "Debit" : "Előírás",
    isEn ? "Payment" : "Befizetés",
    isEn ? "Closing" : "Záró"
  ];

  const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  headers.forEach((h, idx) => {
    const isNumCol = idx >= 3;
    ws[`${colLetters[idx]}6`] = {
      t: 's',
      v: h,
      s: {
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1E3A8A' } },
        alignment: {
          horizontal: isNumCol ? 'right' : 'left',
          vertical: 'center'
        },
        border: {
          top: { style: 'medium', color: { rgb: '1E3A8A' } },
          bottom: { style: 'medium', color: { rgb: '1E3A8A' } },
          left: { style: 'thin', color: { rgb: '2563EB' } },
          right: { style: 'thin', color: { rgb: '2563EB' } }
        }
      }
    };
  });
  rowHeights.push({ hpt: 26 });

  let r = 7;
  const kkLabel = isEn ? "Common Fee (KK)" : "Közös Költség (KK)";
  const faLabel = isEn ? "Renovation Fund (FA)" : "Felújítási Alap (FA)";

  // Data rows: exactly 2 rows per property unit (1st row KK, 2nd row FA)
  // No summary rows at bottom ("Az összesítő részek sem kellenek.")
  reportData.rows.forEach(flat => {
    // 1. Közös Költség (KK) Row
    const rKK = r;
    // Albetét
    ws[`A${rKK}`] = {
      t: 's',
      v: flat.flatLabel,
      s: {
        font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '111827' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'E5E7EB' } },
          bottom: { style: 'thin', color: { rgb: 'F3F4F6' } },
          left: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right: { style: 'thin', color: { rgb: 'E5E7EB' } }
        }
      }
    };
    // Tulajdonos(ok)
    ws[`B${rKK}`] = {
      t: 's',
      v: flat.ownerName,
      s: {
        font: { name: 'Calibri', sz: 10, color: { rgb: '374151' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'E5E7EB' } },
          bottom: { style: 'thin', color: { rgb: 'F3F4F6' } },
          left: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right: { style: 'thin', color: { rgb: 'E5E7EB' } }
        }
      }
    };
    // Alap
    ws[`C${rKK}`] = {
      t: 's',
      v: kkLabel,
      s: {
        font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '1E40AF' } },
        fill: { fgColor: { rgb: 'EFF6FF' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'E5E7EB' } },
          bottom: { style: 'thin', color: { rgb: 'F3F4F6' } },
          left: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right: { style: 'thin', color: { rgb: 'E5E7EB' } }
        }
      }
    };
    // Nyitó
    ws[`D${rKK}`] = {
      t: 'n',
      v: flat.nyitoKK,
      z: numFmt,
      s: {
        font: { name: 'Calibri', sz: 10, color: flat.nyitoKK < 0 ? { rgb: 'DC2626' } : { rgb: '111827' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'E5E7EB' } },
          bottom: { style: 'thin', color: { rgb: 'F3F4F6' } },
          left: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right: { style: 'thin', color: { rgb: 'E5E7EB' } }
        }
      }
    };
    // Előírás
    ws[`E${rKK}`] = {
      t: 'n',
      v: flat.eloirasKK,
      z: numFmt,
      s: {
        font: { name: 'Calibri', sz: 10, color: { rgb: '111827' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'E5E7EB' } },
          bottom: { style: 'thin', color: { rgb: 'F3F4F6' } },
          left: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right: { style: 'thin', color: { rgb: 'E5E7EB' } }
        }
      }
    };
    // Befizetés
    ws[`F${rKK}`] = {
      t: 'n',
      v: flat.befizetesKK,
      z: numFmt,
      s: {
        font: { name: 'Calibri', sz: 10, color: { rgb: '047857' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'E5E7EB' } },
          bottom: { style: 'thin', color: { rgb: 'F3F4F6' } },
          left: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right: { style: 'thin', color: { rgb: 'E5E7EB' } }
        }
      }
    };
    // Záró (Live formula)
    ws[`G${rKK}`] = {
      t: 'n',
      f: `D${rKK}-E${rKK}+F${rKK}`,
      v: flat.zaroKK,
      z: numFmt,
      s: {
        font: { name: 'Calibri', sz: 10, bold: true, color: flat.zaroKK < 0 ? { rgb: 'DC2626' } : { rgb: '1E3A8A' } },
        fill: { fgColor: { rgb: 'F0F7FF' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'E5E7EB' } },
          bottom: { style: 'thin', color: { rgb: 'F3F4F6' } },
          left: { style: 'thin', color: { rgb: 'DBEAFE' } },
          right: { style: 'thin', color: { rgb: 'DBEAFE' } }
        }
      }
    };
    rowHeights.push({ hpt: 20 });
    r++;

    // 2. Felújítási Alap (FA) Row
    const rFA = r;
    // Albetét
    ws[`A${rFA}`] = {
      t: 's',
      v: flat.flatLabel,
      s: {
        font: { name: 'Calibri', sz: 10, color: { rgb: '6B7280' } },
        fill: { fgColor: { rgb: 'F9FAFB' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'F3F4F6' } },
          bottom: { style: 'medium', color: { rgb: '94A3B8' } },
          left: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right: { style: 'thin', color: { rgb: 'E5E7EB' } }
        }
      }
    };
    // Tulajdonos(ok)
    ws[`B${rFA}`] = {
      t: 's',
      v: flat.ownerName,
      s: {
        font: { name: 'Calibri', sz: 10, color: { rgb: '6B7280' } },
        fill: { fgColor: { rgb: 'F9FAFB' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'F3F4F6' } },
          bottom: { style: 'medium', color: { rgb: '94A3B8' } },
          left: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right: { style: 'thin', color: { rgb: 'E5E7EB' } }
        }
      }
    };
    // Alap
    ws[`C${rFA}`] = {
      t: 's',
      v: faLabel,
      s: {
        font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'B45309' } },
        fill: { fgColor: { rgb: 'FFFBEB' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'F3F4F6' } },
          bottom: { style: 'medium', color: { rgb: '94A3B8' } },
          left: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right: { style: 'thin', color: { rgb: 'E5E7EB' } }
        }
      }
    };
    // Nyitó
    ws[`D${rFA}`] = {
      t: 'n',
      v: flat.nyitoFA,
      z: numFmt,
      s: {
        font: { name: 'Calibri', sz: 10, color: flat.nyitoFA < 0 ? { rgb: 'DC2626' } : { rgb: '374151' } },
        fill: { fgColor: { rgb: 'F9FAFB' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'F3F4F6' } },
          bottom: { style: 'medium', color: { rgb: '94A3B8' } },
          left: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right: { style: 'thin', color: { rgb: 'E5E7EB' } }
        }
      }
    };
    // Előírás
    ws[`E${rFA}`] = {
      t: 'n',
      v: flat.eloirasFA,
      z: numFmt,
      s: {
        font: { name: 'Calibri', sz: 10, color: { rgb: '374151' } },
        fill: { fgColor: { rgb: 'F9FAFB' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'F3F4F6' } },
          bottom: { style: 'medium', color: { rgb: '94A3B8' } },
          left: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right: { style: 'thin', color: { rgb: 'E5E7EB' } }
        }
      }
    };
    // Befizetés
    ws[`F${rFA}`] = {
      t: 'n',
      v: flat.befizetesFA,
      z: numFmt,
      s: {
        font: { name: 'Calibri', sz: 10, color: { rgb: '047857' } },
        fill: { fgColor: { rgb: 'F9FAFB' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'F3F4F6' } },
          bottom: { style: 'medium', color: { rgb: '94A3B8' } },
          left: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right: { style: 'thin', color: { rgb: 'E5E7EB' } }
        }
      }
    };
    // Záró (Live formula)
    ws[`G${rFA}`] = {
      t: 'n',
      f: `D${rFA}-E${rFA}+F${rFA}`,
      v: flat.zaroFA,
      z: numFmt,
      s: {
        font: { name: 'Calibri', sz: 10, bold: true, color: flat.zaroFA < 0 ? { rgb: 'DC2626' } : { rgb: 'B45309' } },
        fill: { fgColor: { rgb: 'FEF3C7' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'F3F4F6' } },
          bottom: { style: 'medium', color: { rgb: '94A3B8' } },
          left: { style: 'thin', color: { rgb: 'FDE68A' } },
          right: { style: 'thin', color: { rgb: 'FDE68A' } }
        }
      }
    };
    rowHeights.push({ hpt: 20 });
    r++;
  });

  const lastRow = r - 1;
  ws['!ref'] = `A1:G${lastRow}`;

  // Column widths: clean, readable, professional
  ws['!cols'] = [
    { wch: 14 }, // Albetét (e.g. Fsz 1.)
    { wch: 28 }, // Tulajdonos(ok)
    { wch: 24 }, // Alap
    { wch: 16 }, // Nyitó
    { wch: 16 }, // Előírás
    { wch: 16 }, // Befizetés
    { wch: 18 }  // Záró
  ];

  // Row heights
  ws['!rows'] = rowHeights;

  const wb = XLSX.utils.book_new();
  const sheetName = isEn ? "Owner Balances" : "Tulajdonosi elszámolás";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

/**
 * Export loan payment history to Excel (.xlsx)
 */
export function exportLoanPaymentsToExcel(loan, isEn = false) {
  if (!loan) return;
  const payments = loan.payments || [];
  const rows = payments.map(p => ({
    [isEn ? "Payment Date" : "Dátum"]: p.paymentDate || "-",
    [isEn ? "Total Paid (HUF)" : "Teljes befizetés (Ft)"]: Number(p.totalPaid) || 0,
    [isEn ? "Principal (HUF)" : "Tőke (Ft)"]: Number(p.principalPaid) || 0,
    [isEn ? "Interest (HUF)" : "Kamat (Ft)"]: Number(p.interestPaid) || 0,
    [isEn ? "Bank Fee (HUF)" : "Banki díj (Ft)"]: Number(p.bankFee) || 0,
    [isEn ? "Remaining Principal (HUF)" : "Fennmaradó tőke (Ft)"]: Number(p.remainingBalanceAfter) || 0,
    [isEn ? "Status" : "Státusz"]: p.status === 'completed' ? (isEn ? "Completed" : "Teljesítve") : (isEn ? "Pending" : "Folyamatban"),
    [isEn ? "Note" : "Megjegyzés"]: p.note || ""
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isEn ? "Loan Payments" : "Törlesztések");
  const cleanTitle = (loan.title || "hitel").replace(/[^a-zA-Z0-9_\u00C0-\u017F]/g, '_').substring(0, 30);
  XLSX.writeFile(wb, `hitel_torlesztes_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Export loan participants breakdown to Excel (.xlsx)
 */
export function exportLoanParticipantsToExcel(loan, isEn = false) {
  if (!loan) return;
  const participants = loan.participants || [];
  const rows = participants.map(p => ({
    [isEn ? "Apartment" : "Lakás"]: p.apartmentId || "-",
    [isEn ? "Owner" : "Tulajdonos"]: p.ownerName || "-",
    [isEn ? "Payment Method" : "Fizetési mód"]: p.paymentMethod === 'lump_sum' 
      ? (isEn ? "Lump Sum (Exempt)" : "Egyösszegű (Zsebből)") 
      : (isEn ? "Financed" : "Hitelből törlesztő"),
    [isEn ? "Lump Sum Paid (HUF)" : "Befizetett önrész (Ft)"]: p.paymentMethod === 'lump_sum' ? (Number(p.lumpSumAmountPaid) || 0) : 0,
    [isEn ? "Monthly Contribution (HUF/mo)" : "Havi törlesztőrészlet (Ft/hó)"]: p.paymentMethod === 'financed' ? (Number(p.monthlyContribution) || 0) : 0
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isEn ? "Participants" : "Résztvevők");
  const cleanTitle = (loan.title || "hitel").replace(/[^a-zA-Z0-9_\u00C0-\u017F]/g, '_').substring(0, 30);
  XLSX.writeFile(wb, `hitel_resztvevok_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Helper to download raw CSV string
 */
function downloadCSV(csvContent, filename) {
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export loan payments to CSV
 */
export function exportLoanPaymentsToCSV(loan, isEn = false) {
  if (!loan) return;
  const headers = isEn 
    ? ["Payment Date", "Total Paid (HUF)", "Principal (HUF)", "Interest (HUF)", "Bank Fee (HUF)", "Remaining Principal (HUF)", "Status", "Note"]
    : ["Dátum", "Teljes befizetés (Ft)", "Tőke (Ft)", "Kamat (Ft)", "Banki díj (Ft)", "Fennmaradó tőke (Ft)", "Státusz", "Megjegyzés"];

  const rows = (loan.payments || []).map(p => [
    `"${p.paymentDate || ''}"`,
    Number(p.totalPaid) || 0,
    Number(p.principalPaid) || 0,
    Number(p.interestPaid) || 0,
    Number(p.bankFee) || 0,
    Number(p.remainingBalanceAfter) || 0,
    `"${p.status === 'completed' ? (isEn ? 'Completed' : 'Teljesítve') : (isEn ? 'Pending' : 'Folyamatban')}"`,
    `"${(p.note || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
  const cleanTitle = (loan.title || "hitel").replace(/[^a-zA-Z0-9_\u00C0-\u017F]/g, '_').substring(0, 30);
  downloadCSV(csvContent, `hitel_torlesztes_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.csv`);
}

/**
 * Export loan participants to CSV
 */
export function exportLoanParticipantsToCSV(loan, isEn = false) {
  if (!loan) return;
  const headers = isEn
    ? ["Apartment", "Owner", "Payment Method", "Lump Sum Paid (HUF)", "Monthly Contribution (HUF/mo)"]
    : ["Lakás", "Tulajdonos", "Fizetési mód", "Befizetett önrész (Ft)", "Havi törlesztőrészlet (Ft/hó)"];

  const rows = (loan.participants || []).map(p => [
    `"${p.apartmentId || ''}"`,
    `"${(p.ownerName || '').replace(/"/g, '""')}"`,
    `"${p.paymentMethod === 'lump_sum' ? (isEn ? 'Lump Sum (Exempt)' : 'Egyösszegű (Zsebből)') : (isEn ? 'Financed' : 'Hitelből törlesztő')}"`,
    p.paymentMethod === 'lump_sum' ? (Number(p.lumpSumAmountPaid) || 0) : 0,
    p.paymentMethod === 'financed' ? (Number(p.monthlyContribution) || 0) : 0
  ]);

  const csvContent = [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
  const cleanTitle = (loan.title || "hitel").replace(/[^a-zA-Z0-9_\u00C0-\u017F]/g, '_').substring(0, 30);
  downloadCSV(csvContent, `hitel_resztvevok_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.csv`);
}

