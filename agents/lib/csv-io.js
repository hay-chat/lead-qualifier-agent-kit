// CSV helpers for the ICP agent kit.
//
// Usage:
//   node agents/lib/csv-io.js list-pending            # rows without a score
//   node agents/lib/csv-io.js list-qualified          # GOOD_FIT rows without key_people
//   node agents/lib/csv-io.js get <index>             # single row as JSON
//   node agents/lib/csv-io.js update <index> '<json>' # merge JSON into row + write back

const fs = require('fs');
const path = require('path');
const os = require('os');
const lockfile = require('proper-lockfile');

const ROOT = path.resolve(__dirname, '../..');
const INPUT = process.env.COMPANIES_CSV || path.join(ROOT, 'companies.csv');
const OUTPUT = process.env.COMPANIES_OUTPUT_CSV || path.join(ROOT, 'companies.output.csv');

const OUTPUT_COLUMNS = [
  'name',
  'website',
  'score',
  'fit',
  'stage',
  'pricing_model',
  'customer_type',
  'vertical',
  'employees',
  'support_page',
  'chat_supplier',
  'notes',
  'key_people',
  'language',
  'researched_at',
  'outreach_prepped_at',
];

function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 2;
      } else if (ch === '"') {
        inQuotes = false;
        i++;
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        row.push(field);
        field = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim().length > 0));
}

function stringifyCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((v) => {
          const s = v == null ? '' : String(v);
          if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(',')
    )
    .join(os.EOL) + os.EOL;
}

function readInput() {
  if (!fs.existsSync(INPUT)) {
    throw new Error(`Missing input CSV at ${INPUT}. Create it with columns: name,website`);
  }
  const rows = parseCsv(fs.readFileSync(INPUT, 'utf8'));
  if (rows.length === 0) throw new Error(`Input CSV is empty`);
  const [header, ...data] = rows;
  const idx = {
    name: header.findIndex((h) => h.trim().toLowerCase() === 'name'),
    website: header.findIndex((h) => h.trim().toLowerCase() === 'website'),
  };
  if (idx.name < 0 || idx.website < 0) {
    throw new Error(`Input CSV must have "name" and "website" columns`);
  }
  return data.map((r, i) => ({
    index: i,
    name: (r[idx.name] || '').trim(),
    website: (r[idx.website] || '').trim(),
  }));
}

function readOutput() {
  if (!fs.existsSync(OUTPUT)) return [];
  const rows = parseCsv(fs.readFileSync(OUTPUT, 'utf8'));
  if (rows.length === 0) return [];
  const [header, ...data] = rows;
  return data.map((r) => {
    const obj = {};
    header.forEach((h, i) => { obj[h.trim()] = r[i] || ''; });
    return obj;
  });
}

function writeOutput(rows) {
  const header = OUTPUT_COLUMNS;
  const body = rows.map((r) => header.map((h) => r[h] ?? ''));
  fs.writeFileSync(OUTPUT, stringifyCsv([header, ...body]));
}

function keyOf(row) {
  return `${(row.name || '').toLowerCase()}|${(row.website || '').toLowerCase()}`;
}

function mergedState() {
  const inputs = readInput();
  const existing = readOutput();
  const byKey = new Map(existing.map((r) => [keyOf(r), r]));
  return inputs.map((inp) => {
    const existing = byKey.get(keyOf(inp));
    return { ...existing, name: inp.name, website: inp.website, index: inp.index };
  });
}

async function withLock(fn) {
  if (!fs.existsSync(OUTPUT)) fs.writeFileSync(OUTPUT, '');
  const release = await lockfile.lock(OUTPUT, {
    retries: { retries: 20, minTimeout: 50, maxTimeout: 500 },
    stale: 10000,
  });
  try {
    return await fn();
  } finally {
    await release();
  }
}

async function updateRow(index, patch) {
  return withLock(async () => {
    const rows = mergedState();
    if (index < 0 || index >= rows.length) throw new Error(`index out of range: ${index}`);
    const row = rows[index];
    const merged = { ...row };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      if (typeof v === 'object') merged[k] = JSON.stringify(v);
      else merged[k] = String(v);
    }
    rows[index] = merged;
    writeOutput(rows.map(({ index: _, ...rest }) => rest));
    return merged;
  });
}

function listPending() {
  return mergedState().filter((r) => !r.score);
}

function listQualified() {
  return mergedState().filter((r) => r.fit === 'GOOD_FIT' && !r.key_people);
}

function getRow(index) {
  const rows = mergedState();
  if (index < 0 || index >= rows.length) throw new Error(`index out of range: ${index}`);
  return rows[index];
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  try {
    if (cmd === 'list-pending') {
      console.log(JSON.stringify(listPending(), null, 2));
    } else if (cmd === 'list-qualified') {
      console.log(JSON.stringify(listQualified(), null, 2));
    } else if (cmd === 'get') {
      console.log(JSON.stringify(getRow(Number(args[0])), null, 2));
    } else if (cmd === 'update') {
      const patch = JSON.parse(args[1]);
      const row = await updateRow(Number(args[0]), patch);
      console.log(JSON.stringify(row, null, 2));
    } else {
      console.error('Usage: csv-io.js <list-pending | list-qualified | get <index> | update <index> <json>>');
      process.exit(1);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { readInput, readOutput, mergedState, updateRow, listPending, listQualified, getRow };
