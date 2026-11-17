export function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === "\"" && inQuotes && nextCharacter === "\"") {
      current += "\"";
      index += 1;
    } else if (character === "\"") {
      inQuotes = !inQuotes;
    } else if (character === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  cells.push(current.trim());
  return cells;
}

function normaliseHeader(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function normaliseListDate(value, fallbackDate) {
  if (!value) return fallbackDate;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  const isoDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (isoDate) {
    const [, year, month, day] = isoDate;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const ukDate = text.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{2,4})$/);

  if (ukDate) {
    const [, day, month, rawYear] = ukDate;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return fallbackDate;
}

export function parsePatientRows(rawRows, fallbackDate) {
  const rows = rawRows
    .map((row) => row.map((cell) => String(cell || "").trim()))
    .filter((row) => row.some(Boolean));

  if (rows.length === 0) return [];

  const headerRowIndex = rows.findIndex((row) => {
    const headerText = row.map(normaliseHeader).join(" ");
    return (
      headerText.includes("patient") ||
      headerText.includes("mrn") ||
      headerText.includes("nhs") ||
      headerText.includes("hospitalnumber") ||
      headerText.includes("hospno") ||
      headerText.includes("casenumber")
    );
  });
  const hasHeader = headerRowIndex >= 0;
  const headers = hasHeader
    ? rows[headerRowIndex].map(normaliseHeader)
    : [];
  const dataRows = hasHeader ? rows.slice(headerRowIndex + 1) : rows;

  function valueByHeader(row, names, fallbackIndex) {
    const index = headers.findIndex((header) =>
      names.some((name) => header.includes(name))
    );

    if (index >= 0) return row[index] || "";
    return row[fallbackIndex] || "";
  }

  return dataRows
    .map((row) => {
      const theatre = hasHeader
        ? valueByHeader(row, ["theatre", "location", "room", "operatingroom"], 0)
        : "";
      const patientName = hasHeader
        ? valueByHeader(row, ["patientname", "patient", "name"], theatre ? 1 : 0)
        : row[0];
      const hospitalNumber = hasHeader
        ? valueByHeader(row, ["mrn", "nhs", "hospitalnumber", "hospno", "casenumber", "number"], theatre ? 2 : 1)
        : row[1];
      const speciality = hasHeader
        ? valueByHeader(row, ["speciality", "specialty", "service", "consultant"], theatre ? 3 : 2)
        : row[2];
      const procedure = hasHeader
        ? valueByHeader(row, ["procedure", "operation", "plannedprocedure", "description"], theatre ? 4 : 3)
        : row[3];
      const listDate = hasHeader
        ? valueByHeader(row, ["listdate", "date", "operationdate", "sessiondate"], theatre ? 5 : 4)
        : row[4];

      return {
        patientName,
        hospitalNumber,
        speciality: speciality || "",
        procedure: procedure || "",
        listDate: normaliseListDate(listDate, fallbackDate),
      };
    })
    .filter((patient) => patient.patientName && patient.hospitalNumber);
}

export function parsePatientDelimitedText(text, fallbackDate) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line.includes("\t")
        ? line.split("\t").map((cell) => cell.trim())
        : parseCsvLine(line)
    );

  return parsePatientRows(rows, fallbackDate);
}

export async function parsePatientFile(file, fallbackDate) {
  const fileName = String(file.name || "").toLowerCase();

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    const rows = await readXlsxFile(file);
    return parsePatientRows(rows, fallbackDate);
  }

  const text = await file.text();
  return parsePatientDelimitedText(text, fallbackDate);
}
