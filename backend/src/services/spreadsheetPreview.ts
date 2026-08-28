import { inflateRawSync } from "node:zlib";

function unescapeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripTags(value: string) {
  return unescapeXml(value.replace(/<[^>]*>/g, ""));
}

function zipEntries(buffer: Buffer): Map<string, Buffer> {
  const result = new Map<string, Buffer>();
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 0xffff - 22); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Invalid Excel workbook.");
  const count = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  let cursor = centralOffset;

  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(start, start + compressedSize);
    let data: Buffer;
    if (method === 0) data = Buffer.from(compressed);
    else if (method === 8) data = inflateRawSync(compressed);
    else throw new Error("Unsupported Excel compression method.");
    result.set(name, data);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return result;
}

function attr(tag: string, name: string) {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m?.[1] || "";
}

function textInside(xml: string, tag: string) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? stripTags(m[1]) : "";
}

function cellColumn(ref: string) {
  const letters = (ref.match(/^[A-Z]+/i)?.[0] || "A").toUpperCase();
  let n = 0;
  for (const c of letters) n = n * 26 + c.charCodeAt(0) - 64;
  return Math.max(0, n - 1);
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function firstWorksheet(entries: Map<string, Buffer>) {
  const workbook = entries.get("xl/workbook.xml")?.toString("utf8");
  if (!workbook) return "xl/worksheets/sheet1.xml";
  const rels = entries.get("xl/_rels/workbook.xml.rels")?.toString("utf8") || "";
  const sheet = workbook.match(/<sheet\b[^>]*r:id="([^"]+)"[^>]*>/)?.[1];
  if (!sheet) return "xl/worksheets/sheet1.xml";
  const rel = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${sheet}"[^>]*Target="([^"]+)"`))?.[1];
  if (!rel) return "xl/worksheets/sheet1.xml";
  return rel.startsWith("/") ? rel.slice(1) : `xl/${rel.replace(/^\.\//, "")}`;
}

export function isOpenXmlSpreadsheet(mimeType: string, name: string) {
  const lower = name.toLowerCase();
  return mimeType.includes("spreadsheetml") || /\.(xlsx|xlsm|xltx|xltm)$/i.test(lower);
}

export function renderOpenXmlSpreadsheet(buffer: Buffer, fileName: string) {
  const entries = zipEntries(buffer);
  const shared = entries.get("xl/sharedStrings.xml")?.toString("utf8") || "";
  const sharedStrings: string[] = [];
  for (const item of shared.matchAll(/<si\b[\s\S]*?<\/si>/g)) {
    sharedStrings.push(stripTags(item[0]));
  }

  const sheetName = firstWorksheet(entries);
  const xml = entries.get(sheetName)?.toString("utf8");
  if (!xml) throw new Error("Excel worksheet could not be read.");

  const rows: string[][] = [];
  let maxCol = 0;
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const header = cellMatch[1];
      const body = cellMatch[2];
      const ref = attr(header, "r");
      const col = cellColumn(ref);
      const type = attr(header, "t");
      let value = textInside(body, "v");
      if (type === "s" && value !== "") value = sharedStrings[Number(value)] ?? value;
      else if (type === "inlineStr") value = textInside(body, "t");
      else if (type === "b") value = value === "1" ? "TRUE" : "FALSE";
      cells[col] = value;
      maxCol = Math.max(maxCol, col);
    }
    rows.push(cells);
    if (rows.length >= 250) break;
  }

  const columns = Math.min(Math.max(maxCol + 1, 1), 40);
  const body = rows.map((row, rowIndex) => {
    const cells = Array.from({ length: columns }, (_, i) => `<td>${escapeHtml(row[i] ?? "")}</td>`).join("");
    return `<tr><th class="row-number">${rowIndex + 1}</th>${cells}</tr>`;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(fileName)}</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f7f9fc;font:13px Arial,sans-serif;color:#17233a}
  .wrap{padding:18px}.title{font-weight:700;margin:0 0 12px}.note{color:#68758a;font-size:12px;margin-bottom:12px}
  .sheet{overflow:auto;background:#fff;border:1px solid #dfe6ef;border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,.03)}
  table{border-collapse:collapse;min-width:100%;white-space:pre}.row-number{background:#f3f6fa;color:#718096;font-weight:600;text-align:right;position:sticky;left:0}
  th,td{border-right:1px solid #e4e9f0;border-bottom:1px solid #e4e9f0;padding:8px 10px;min-width:90px;max-width:420px;text-align:left;vertical-align:top}
  tr:first-child td{font-weight:600;background:#f8fafc}.row-number{min-width:42px;width:42px}
</style></head><body><div class="wrap"><h3 class="title">${escapeHtml(fileName)}</h3><div class="note">Excel preview • first worksheet • up to 250 rows</div><div class="sheet"><table>${body || '<tr><td>No readable cells found.</td></tr>'}</table></div></div></body></html>`;
}
