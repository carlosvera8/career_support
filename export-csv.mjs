// Converts data/applications.md to output/applications.csv (read-only on source)
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcPath = join(__dirname, 'data', 'applications.md');
const outPath = join(__dirname, 'output', 'applications.csv');

const md = readFileSync(srcPath, 'utf8');

const rows = md
  .split('\n')
  .filter(line => line.startsWith('|'))   // only table rows
  .filter(line => !line.match(/^\|[-| ]+\|$/)) // drop separator row
  .map(line =>
    line
      .split('|')
      .slice(1, -1)                        // drop leading/trailing empty splits
      .map(cell => cell.trim())
  );

if (rows.length < 2) {
  console.error('No table rows found in applications.md');
  process.exit(1);
}

const [header, ...data] = rows;

// Strip markdown links: [text](url) → text
const stripLinks = str => str.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

// Wrap in quotes if value contains comma, quote, or newline; escape internal quotes
const csvCell = str => {
  const val = stripLinks(str);
  if (/[",\n]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
};

const lines = [
  header.map(csvCell).join(','),
  ...data.map(row => row.map(csvCell).join(','))
];

writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`✅ Exported ${data.length} rows → ${outPath}`);
