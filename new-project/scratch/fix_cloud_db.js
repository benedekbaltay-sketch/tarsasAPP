const https = require('https');

// Helper to make HTTPS requests
function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  const getOptions = {
    hostname: 'tarsashaz-cfe5d-default-rtdb.europe-west1.firebasedatabase.app',
    port: 443,
    path: '/condo_state.json',
    method: 'GET'
  };

  console.log("Fetching current cloud data...");
  const getRes = await request(getOptions);
  if (getRes.statusCode !== 200) {
    console.error("Failed to fetch cloud data, status:", getRes.statusCode);
    return;
  }

  const data = JSON.parse(getRes.body);
  if (!data) {
    console.error("No cloud data found!");
    return;
  }

  console.log("Current lastUpdated in cloud:", data.lastUpdated);
  console.log("Current revision in cloud:", data.revision);

  // Set to current real time and add revision: 1 (or increment if it exists)
  data.lastUpdated = new Date().toISOString();
  data.revision = (data.revision || 0) + 1;

  console.log("Setting new lastUpdated in cloud to:", data.lastUpdated);
  console.log("Setting new revision in cloud to:", data.revision);

  const putData = JSON.stringify(data);
  const putOptions = {
    hostname: 'tarsashaz-cfe5d-default-rtdb.europe-west1.firebasedatabase.app',
    port: 443,
    path: '/condo_state.json',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(putData, 'utf8')
    }
  };

  console.log("Updating cloud data...");
  const putRes = await request(putOptions, putData);
  console.log("Response status:", putRes.statusCode);
  if (putRes.statusCode === 200) {
    console.log("Cloud database successfully cleaned and corrected!");
  } else {
    console.error("Failed to update cloud database, response:", putRes.body);
  }
}

run().catch(console.error);
