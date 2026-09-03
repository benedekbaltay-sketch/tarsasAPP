const fs = require('fs');

const indexPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/index.html';
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// The block to replace:
// <div class="stat-item">
//     <span class="stat-label">Havi el...r...s (KK+FA)</span>
//     <span class="stat-value" id="flat-detail-fees-summary">–</span>
// </div>

const summaryId = 'id="flat-detail-fees-summary"';
const summaryPos = indexHtml.indexOf(summaryId);

if (summaryPos !== -1) {
    // find the start of the <div class="stat-item"> before this
    const divStart = indexHtml.lastIndexOf('<div class="stat-item">', summaryPos);
    // find the end of this div </div>
    const divEnd = indexHtml.indexOf('</div>', summaryPos) + 6;
    
    const newFeesHTML = `<div class="stat-item">
                    <span class="stat-label">Havi KK előírás</span>
                    <span class="stat-value" id="flat-detail-fee-a">–</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Havi FA előírás</span>
                    <span class="stat-value" id="flat-detail-fee-b">–</span>
                </div>`;
                
    indexHtml = indexHtml.substring(0, divStart) + newFeesHTML + indexHtml.substring(divEnd);
    indexHtml = indexHtml.replace('v=40', 'v=41');
    fs.writeFileSync(indexPath, indexHtml, 'utf8');
    console.log("Fixed index.html structure!");
} else {
    console.log("Could not find flat-detail-fees-summary");
}
