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

  const nums = new Set();
  for (const line of lines) {
    const cols = line.split('\t');
    if (cols[0] === 'id' || cols[2]?.trim() !== 'completed') continue;
    const num = cols[5]?.trim();
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
let batchOutPath = null;

if (batchMode) {
  fs.mkdirSync(BATCHES_DIR, { recursive: true });

  // Pick a unique output filename before reading seenNums, so we never overwrite an existing file
  const base = buildTimestamp();
  let outName = `${base}.csv`;
  let counter = 1;
  while (fs.existsSync(path.join(BATCHES_DIR, outName))) {
    outName = `${base}_${counter++}.csv`;
  }
  batchOutPath = path.join(BATCHES_DIR, outName);

  const seenNums = new Set();
  for (const existing of fs.readdirSync(BATCHES_DIR).filter(f => f.endsWith('.csv')).sort()) {
    const lines = fs.readFileSync(path.join(BATCHES_DIR, existing), 'utf8').split('\n').slice(1);
    for (const line of lines) {
      if (!line.trim()) continue;
      // Strip leading zeros so "001" and "1" both normalize to "1"
      const raw = line.split(',')[0].replace(/^"|"$/g, '');
      const num = raw.replace(/^0+/, '') || '0';
      if (num) seenNums.add(num);
    }
  }
  // Include any report not yet in a batch CSV (batch-run or manually evaluated)
  filesToProcess = allFiles.filter(f => {
    const num = f.match(/^(\d+)/)?.[1]?.replace(/^0+/, '') || '0';
    return !seenNums.has(num);
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
  if (rows.length === 0) {
    console.log('No new reports — all already in a previous batch CSV.');
    process.exit(0);
  }
  writeCSV(rows, batchOutPath);
} else {
  writeCSV(rows, MASTER_CSV);
}
