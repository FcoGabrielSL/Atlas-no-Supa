import fs from "fs";

try {
  const content = fs.readFileSync("data/database.json", "utf8");
  const db = JSON.parse(content);
  console.log("ENTRONCAMENTOS in database.json:", db.ENTRONCAMENTOS?.length || 0);
  console.log("pendingChanges in database.json:", db.pendingChanges?.length || 0);
  if (db.pendingChanges?.length > 0) {
    console.log("Pending changes summary:", JSON.stringify(db.pendingChanges.map((c: any) => ({ action: c.action, sheet: c.sheetName })), null, 2));
  }
} catch (err) {
  console.error(err);
}
