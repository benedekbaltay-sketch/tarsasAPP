import * as XLSX from 'xlsx';

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
