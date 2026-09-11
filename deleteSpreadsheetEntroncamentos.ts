async function run() {
  const url = "https://script.google.com/macros/s/AKfycbxG9mOMXiO2mrtBZWh6Nk9skS8wFiLSIueXa5ldCweZxhgT2C1fDMR3qATs7DQxsIWr/exec";
  try {
    console.log("1. Fetching current ENTRONCAMENTOS from Google Sheets...");
    const fetchRes = await fetch(url);
    const data = await fetchRes.json();
    const rows = data.ENTRONCAMENTOS || [];
    
    // Filter non-empty items
    const nonEmptyRows = rows.filter((item: any) => {
      const hasId = !!(item.id || item.ID);
      const hasContent = Object.values(item).some(val => val !== "" && val !== null && val !== undefined);
      return hasId && hasContent;
    });

    console.log(`Found ${nonEmptyRows.length} non-empty ENTRONCAMENTOS rows to delete.`);

    for (const item of nonEmptyRows) {
      const idToDelete = item.id || item.ID;
      console.log(`Deleting ID: ${idToDelete}...`);
      
      const deleteRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          sheetName: "ENTRONCAMENTOS",
          rowData: { id: idToDelete, ID: idToDelete }
        })
      });

      const resText = await deleteRes.text();
      console.log(`Delete response for ${idToDelete}:`, resText);
    }

    console.log("All deletion requests sent! Now let's fetch again to verify...");
    const verifyRes = await fetch(url);
    const verifyData = await verifyRes.json();
    const verifyRows = verifyData.ENTRONCAMENTOS || [];
    const verifyNonEmpty = verifyRows.filter((item: any) => {
      return Object.values(item).some(val => val !== "" && val !== null && val !== undefined);
    });
    console.log(`Verification: Remaining non-empty rows: ${verifyNonEmpty.length}`);
  } catch (err) {
    console.error("Critical error during spreadsheet deletion process:", err);
  }
}
run();
