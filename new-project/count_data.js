const fs = require('fs');
const appPath = 'C:/Users/bened/.gemini/antigravity/scratch/new-project/app.js';
const code = fs.readFileSync(appPath, 'utf8');

// evaluate the state object
const stateStr = code.match(/let state = ({[\s\S]*?});/)[1];
const state = eval('(' + stateStr + ')');
console.log('Transactions:', state.transactions.length);
console.log('Expenses:', state.expenses.length);
