const https = require('https');

const cleanPayload = {
  lastUpdated: new Date().toISOString(),
  buildings: [
    {
      id: "batyu21",
      name: "Batyu utca 21. Társasház",
      address: "Batyu utca 21.",
      bankKK: { name: "Batyu utca 21 Társasház", account: "11702005 21461266", bank: "OTP" },
      bankFA: { name: "Batyu utca 21 Társasház", account: "11702005 21461273", bank: "OTP" },
      buildingInitialReserveCommon: 650000,
      buildingInitialReserveRenovation: 1100000,
      documents: [],
      flats: [
        { flatNum: "Fsz 1", ownerName: "Ivánné Mód Ágnes", email: "mod.agnes@gmail.com", monthlyFee: 30377, renovationFee: 5981, balance: 0, renovationBalance: 0, ownershipShare: 12.46, tenantCount: 2 },
        { flatNum: "Fsz 2", ownerName: "Baltay Benedek", email: "benedek.baltay@gmail.com", monthlyFee: 20630, renovationFee: 4214, balance: 0, renovationBalance: 0, ownershipShare: 8.78, tenantCount: 2 },
        { flatNum: "Fsz 3", ownerName: "Bódi Anikó", email: "bodi.aniko@gmail.com", monthlyFee: 14992, renovationFee: 4912, balance: 0, renovationBalance: 0, ownershipShare: 10.23, tenantCount: 1 },
        { flatNum: "I 4", ownerName: "Hóman Józsefné", email: "homan.jozsefne@gmail.com", monthlyFee: 30721, renovationFee: 6187, balance: 0, renovationBalance: 0, ownershipShare: 12.89, tenantCount: 3 },
        { flatNum: "I 5", ownerName: "Iván Noémi", email: "ivan.noemi@gmail.com", monthlyFee: 13751, renovationFee: 5773, balance: 0, renovationBalance: 0, ownershipShare: 8.68, tenantCount: 1 },
        { flatNum: "I 6", ownerName: "Citi Apartman", email: "citi.apartman@gmail.com", monthlyFee: 22896, renovationFee: 5773, balance: 0, renovationBalance: 0, ownershipShare: 11.61, tenantCount: 1 },
        { flatNum: "II 7-8", ownerName: "Dr. Cser László Gusztáv", email: "cser.laszlo@gmail.com", monthlyFee: 25472, renovationFee: 11194, balance: 0, renovationBalance: 0, ownershipShare: 23.32, tenantCount: 1 },
        { flatNum: "II 9", ownerName: "Dr. Forrai Anna", email: "forrai.anna@gmail.com", monthlyFee: 23240, renovationFee: 5779, balance: 0, renovationBalance: 0, ownershipShare: 12.04, tenantCount: 2 }
      ],
      transactions: [],
      expenses: [],
      manualDebits: []
    }
  ],
  users: [
    { id: "admin", name: "Baltay Benedek", email: "benedek.baltay@gmail.com", pass: "admin123", role: "admin", flatNum: "0" },
    { id: "Fsz 1", name: "Ivánné Mód Ágnes", email: "mod.agnes@gmail.com", pass: "lakas123", role: "Owner", flatNum: "Fsz 1", buildingId: "batyu21" },
    { id: "Fsz 2", name: "Baltay Benedek", email: "benedek.baltay@gmail.com", pass: "lakas123", role: "Owner", flatNum: "Fsz 2", buildingId: "batyu21" },
    { id: "Fsz 3", name: "Bódi Anikó", email: "bodi.aniko@gmail.com", pass: "lakas123", role: "Owner", flatNum: "Fsz 3", buildingId: "batyu21" },
    { id: "I 4", name: "Hóman Józsefné", email: "homan.jozsefne@gmail.com", pass: "lakas123", role: "Owner", flatNum: "I 4", buildingId: "batyu21" },
    { id: "I 5", name: "Iván Noémi", email: "ivan.noemi@gmail.com", pass: "lakas123", role: "Owner", flatNum: "I 5", buildingId: "batyu21" },
    { id: "I 6", name: "Citi Apartman", email: "citi.apartman@gmail.com", pass: "lakas123", role: "Owner", flatNum: "I 6", buildingId: "batyu21" },
    { id: "II 7-8", name: "Dr. Cser László Gusztáv", email: "cser.laszlo@gmail.com", pass: "lakas123", role: "Owner", flatNum: "II 7-8", buildingId: "batyu21" },
    { id: "II 9", name: "Dr. Forrai Anna", email: "forrai.anna@gmail.com", pass: "lakas123", role: "Owner", flatNum: "II 9", buildingId: "batyu21" }
  ],
  vault: {
    deletedIds: [],
    deletedFlatNums: [],
    flatOverrides: {},
    buildingInitialReserveCommon: {},
    buildingInitialReserveRenovation: {}
  }
};

const dataString = JSON.stringify(cleanPayload);
const byteLength = Buffer.byteLength(dataString, 'utf8');

const options = {
  hostname: 'tarsashaz-cfe5d-default-rtdb.europe-west1.firebasedatabase.app',
  port: 443,
  path: '/condo_state.json',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': byteLength
  }
};

console.log("Sending clean database payload to Firebase RTDB...");
const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
  res.on('end', () => {
    console.log("\nDone! RTDB database wiped successfully.");
    process.exit(0);
  });
});

req.on('error', (error) => {
  console.error("Error updating RTDB:", error);
  process.exit(1);
});

req.write(dataString);
req.end();
