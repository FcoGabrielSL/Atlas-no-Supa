import fs from "fs";

try {
  const content = fs.readFileSync("data/database.json", "utf8");
  const db = JSON.parse(content);
  const incidents = db["CONTROLE DE INCIDENTES"] || [];
  console.log("Total incidents in CONTROLE DE INCIDENTES:", incidents.length);
  
  if (incidents.length > 0) {
    console.log("Sample incident keys:", Object.keys(incidents[0]));
    console.log("Sample incident details:", JSON.stringify(incidents.slice(0, 3), null, 2));
    
    // Check if any incident is in July 2026
    const july2026 = incidents.filter((i: any) => {
      const date = i["Data de Abertura"] || i["Data de abertura"] || "";
      return date.includes("2026-07");
    });
    console.log("Incidents in July 2026:", july2026.length);
    if (july2026.length > 0) {
      console.log("July 2026 samples:", JSON.stringify(july2026.slice(0, 5), null, 2));
    }
  }
} catch (err) {
  console.error("Error:", err);
}
