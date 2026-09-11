async function checkKeys() {
  const url = 'https://script.google.com/macros/s/AKfycbxG9mOMXiO2mrtBZWh6Nk9skS8wFiLSIueXa5ldCweZxhgT2C1fDMR3qATs7DQxsIWr/exec';
  try {
    const res = await fetch(url);
    const json = await res.json();
    console.log("SHEETS IN SPREADSHEET:", Object.keys(json));
    for (const sheetName of Object.keys(json)) {
      const rows = json[sheetName];
      console.log(`Sheet [${sheetName}]: ${Array.isArray(rows) ? rows.length : 'not an array'} rows`);
    }
  } catch (err) {
    console.error("ERROR FETCHING KEYS:", err);
  }
}
checkKeys();

