#!/usr/bin/env node
/**
 * Scans reports and exports to CSV.
 * Default: rebuilds data/reports.csv from all reports (called by Stop hook).
 * --batch:  writes data/batches/YYYYMMDDHHII.csv using only reports from the
 *           current batch run (reads report numbers from batch/batch-state.tsv).
 */

import fs from 'fs';
import path from 'path';

const REPORTS_DIR = './reports';
const MASTER_CSV = './data/reports.csv';
const BATCH_STATE = './batch/batch-state.tsv';
const BATCHES_DIR = './data/batches';

const batchMode = process.argv.includes('--batch');

function parseReport(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').slice(0, 20);

  const get = (key) => {
    const line = lines.find(l => l.toLowerCase().startsWith(`**${key.toLowerCase()}:**`));
    return line ? line.replace(/^\*\*[^*]+:\*\*\s*/, '').trim() : '';
  };

  const scoreRaw = get('score');
  const scoreMatch = scoreRaw.match(/^(\d+(\.\d+)?)\s*\/\s*5/);
  const score = scoreMatch ? parseFloat(scoreMatch[1]).toFixed(1) : scoreRaw || '';

  const titleLine = lines.find(l => l.startsWith('# ')) || '';
  let company = '', role = '';
  const evalMatch = titleLine.match(/^#\s+Evaluation:\s+(.+?)\s+[—–-]+\s+(.+)$/);
  const numMatch = titleLine.match(/^#\s+\d+\s+[—–-]+\s+(.+?)\s+[|]\s+(.+)$/);
  if (evalMatch) {
    company = evalMatch[1].trim();
    role = evalMatch[2].trim();
  } else if (numMatch) {
    company = numMatch[1].trim();
    role = numMatch[2].trim();
  } else {
    const slug = path.basename(filePath, '.md').replace(/^\d+-/, '').replace(/-\d{4}-\d{2}-\d{2}$/, '');
    company = slug.replace(/-/g, ' ');
    role = titleLine.replace(/^#+\s*/, '').trim();
  }

  const filename = path.basename(filePath, '.md');
  const num = filename.match(/^(\d+)/)?.[1] || '';

  return {
    num,
    date: get('date'),
    company,
    role,
    score,
    url: get('url'),
    legitimacy: get('legitimacy'),
    archetype: get('archetype'),
    verification: get('verification'),
    report: filename + '.md',
  };
}

function readBatchReportNums() {
  if (!fs.existsSync(BATCH_STATE)) return new Set();
  const lines = fs.readFileSync(BATCH_STATE, 'utf8').split('\n');

  // Parse all data rows
  const rows = [];
  for (const line of lines) {
    const cols = line.split('\t');
    if (cols[0] === 'id' || !cols[3]) continue;
    rows.push({ startedAt: cols[3].trim(), reportNum: cols[5]?.trim() });
  }
  if (rows.length === 0) return new Set();

  // Only include rows from the most recent batch session (same UTC date as latest entry)
  const latestDate = rows.map(r => r.startedAt.slice(0, 10)).sort().at(-1);
  const nums = new Set();
  for (const row of rows) {
    if (row.startedAt.slice(0, 10) !== latestDate) continue;
    const num = row.reportNum;
    if (num && num !== '-') nums.add(num.replace(/^0+/, '') || '0');
  }
  return nums;
}

function buildTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function writeCSV(rows, outPath) {
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const headers = ['#', 'Date', 'Company', 'Role', 'Score', 'URL', 'Legitimacy', 'Archetype', 'Verification', 'Report'];
  const csvLines = [
    headers.join(','),
    ...rows.map(r => [r.num, r.date, r.company, r.role, r.score, r.url, r.legitimacy, r.archetype, r.verification, r.report].map(escape).join(','))
  ];
  fs.writeFileSync(outPath, csvLines.join('\n') + '\n');
  console.log(`Wrote ${rows.length} rows to ${outPath}`);
}

const allFiles = fs.readdirSync(REPORTS_DIR)
  .filter(f => f.endsWith('.md'))
  .sort();

let filesToProcess = allFiles;

if (batchMode) {
  const batchNums = readBatchReportNums();
  if (batchNums.size === 0) {
    console.log('No completed reports found in batch-state.tsv — skipping batch CSV.');
    process.exit(0);
  }
  filesToProcess = allFiles.filter(f => {
    const num = f.match(/^(\d+)/)?.[1]?.replace(/^0+/, '') || '0';
    return batchNums.has(num);
  });
}

const rows = [];
for (const file of filesToProcess) {
  try {
    const row = parseReport(path.join(REPORTS_DIR, file));
    if (row) rows.push(row);
  } catch {
    // skip unreadable files
  }
}

rows.sort((a, b) => a.num.padStart(6, '0').localeCompare(b.num.padStart(6, '0')));

if (batchMode) {
  fs.mkdirSync(BATCHES_DIR, { recursive: true });
  writeCSV(rows, path.join(BATCHES_DIR, `${buildTimestamp()}.csv`));
} else {
  writeCSV(rows, MASTER_CSV);
}
