const https = require('https');

https.get('https://tarsashaz-cfe5d-default-rtdb.europe-west1.firebasedatabase.app/condo_state.json', (res) => {
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      if (!data) {
        console.log("No data found in Firebase (null)");
        return;
      }
      console.log("lastUpdated in Cloud:", data.lastUpdated);
      console.log("Buildings count:", data.buildings ? data.buildings.length : 0);
      if (data.buildings && data.buildings[0]) {
        console.log("Building Name:", data.buildings[0].name);
        console.log("Transactions count:", data.buildings[0].transactions ? data.buildings[0].transactions.length : 0);
        console.log("Expenses count:", data.buildings[0].expenses ? data.buildings[0].expenses.length : 0);
        console.log("Documents count:", data.buildings[0].documents ? data.buildings[0].documents.length : 0);
      }
      console.log("Users count:", data.users ? data.users.length : 0);
      if (data.users) {
        console.log("Admin Users:");
        data.users.filter(u => u.role === 'admin').forEach(u => console.log(`  - ${u.name} (${u.email}) pass: ${u.pass || u.password}`));
      }
    } catch (e) {
      console.error("Parse error:", e);
      console.log("Raw body size:", body.length);
    }
  });
}).on('error', (e) => {
  console.error("HTTP Error:", e);
});
