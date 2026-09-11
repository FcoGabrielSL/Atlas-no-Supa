/**
 * Helper to parse a CSV string into an array of objects.
 * Automatically handles comma (,) and semicolon (;) delimiters,
 * handles double-quoted values containing delimiters, and
 * correctly handles cell values containing newlines (multi-line cells).
 */
export function parseCSV(csvString: string): any[] {
  if (!csvString || typeof csvString !== "string") return [];
  
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = "";
  let inQuotes = false;
  
  // Detect delimiter
  let delimiter = ',';
  let firstLineScan = "";
  let scanInQuotes = false;
  for (let i = 0; i < Math.min(csvString.length, 1000); i++) {
    const c = csvString[i];
    if (c === '"') {
      scanInQuotes = !scanInQuotes;
    } else if (!scanInQuotes && (c === '\n' || c === '\r')) {
      break;
    }
    firstLineScan += c;
  }
  const semicolonCount = (firstLineScan.match(/;/g) || []).length;
  const commaCount = (firstLineScan.match(/,/g) || []).length;
  delimiter = semicolonCount > commaCount ? ';' : ',';

  // State machine parsing
  for (let i = 0; i < csvString.length; i++) {
    const char = csvString[i];
    const nextChar = csvString[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentVal += '"';
          i++; // skip next quote
        } else {
          // Closing quote
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentVal.trim());
        currentVal = "";
      } else if (char === '\r' || char === '\n') {
        // Handle CRLF
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentVal.trim());
        rows.push(currentRow);
        currentRow = [];
        currentVal = "";
      } else {
        currentVal += char;
      }
    }
  }
  
  // Push the last cell/row if anything is remaining
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    rows.push(currentRow);
  }

  if (rows.length === 0) return [];
  
  // Extract and clean headers
  const rawHeaders = rows[0];
  const headers = rawHeaders.map(h => 
    h.replace(/^\uFEFF/g, "").replace(/^["']|["']$/g, "").trim()
  );
  
  if (headers.length === 0 || !headers[0]) return [];
  
  const data: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const rowValues = rows[i];
    // Skip empty lines
    if (rowValues.length === 1 && rowValues[0] === "") continue;
    
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = rowValues[index] !== undefined ? rowValues[index] : "";
    });
    data.push(obj);
  }
  
  return data;
}
