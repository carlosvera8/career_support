#!/usr/bin/env node

/**
 * sync-portals.mjs — Sync companies_merged.csv → portals.yml tracked_companies
 *
 * Reads companies_merged.csv and adds companies that have a Greenhouse or Lever
 * ATS slug but are not yet tracked in portals.yml.
 *
 * Usage:
 *   node sync-portals.mjs              # add all eligible companies
 *   node sync-portals.mjs --dry-run    # preview without writing
 *   node sync-portals.mjs --min-wlb 3.5       # only add DS WLB >= 3.5
 *   node sync-portals.mjs --min-employees 500  # only add headcount >= 500
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

const CSV_PATH = 'companies_merged.csv';
const PORTALS_PATH = 'portals.yml';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const minWlbIdx = args.indexOf('--min-wlb');
const minWlb = minWlbIdx !== -1 ? parseFloat(args[minWlbIdx + 1]) : null;

const minEmpIdx = args.indexOf('--min-employees');
const minEmployees = minEmpIdx !== -1 ? parseInt(args[minEmpIdx + 1]) : null;

// ── Name normalization (strip common suffixes for dedup) ──────────────

const SUFFIXES = [' ai', ' inc', ' llc', ' corp', ' technologies', ' systems', ' labs', ' group', ' platform', ' platforms'];

function normalizeName(name) {
  let n = name.toLowerCase().trim();
  for (const s of SUFFIXES) {
    if (n.endsWith(s)) { n = n.slice(0, -s.length); break; }
  }
  return n;
}

// ── CSV parser ────────────────────────────────────────────────────────

function parseCsv(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    // Simple split — fields in this CSV don't contain commas inside quotes
    const values = line.split(',');
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] || '').trim()]));
  });
}

// ── Extract tracked names and ATS slugs from portals.yml ─────────────

function loadTrackedData(portalsText) {
  const names = new Set();
  const slugs = new Set();

  for (const m of portalsText.matchAll(/^\s+-\s+name:\s+(.+)$/gm)) {
    names.add(m[1].trim().toLowerCase());
  }

  // Extract slugs from careers_url and api fields
  for (const m of portalsText.matchAll(/greenhouse\.io\/([^\s/'"]+)/g)) slugs.add(m[1].toLowerCase());
  for (const m of portalsText.matchAll(/boards-api\.greenhouse\.io\/v1\/boards\/([^\s/'"]+)/g)) slugs.add(m[1].toLowerCase());
  for (const m of portalsText.matchAll(/jobs\.lever\.co\/([^\s/'"]+)/g)) slugs.add(m[1].toLowerCase());
  for (const m of portalsText.matchAll(/jobs\.ashbyhq\.com\/([^\s/'"]+)/g)) slugs.add(m[1].toLowerCase());

  return { names, slugs };
}

// ── Build YAML entry string ───────────────────────────────────────────

function buildEntry(row) {
  const { name, greenhouse_slug: ghSlug, lever_slug: leverSlug,
          glassdoor_ds_it_wlb_score, employee_count_estimate, notes } = row;

  const wlb = glassdoor_ds_it_wlb_score ? parseFloat(glassdoor_ds_it_wlb_score) : null;
  const emp = employee_count_estimate ? parseInt(employee_count_estimate) : null;

  const noteParts = [];
  if (wlb) noteParts.push(`DS WLB: ${wlb}/5.`);
  if (emp) noteParts.push(`~${emp.toLocaleString()} employees.`);
  if (notes) noteParts.push(notes);
  const noteStr = noteParts.join(' ');

  let entry = `\n  - name: ${name}\n`;

  if (ghSlug) {
    entry += `    careers_url: https://job-boards.greenhouse.io/${ghSlug}\n`;
    entry += `    api: https://boards-api.greenhouse.io/v1/boards/${ghSlug}/jobs\n`;
  } else if (leverSlug) {
    entry += `    careers_url: https://jobs.lever.co/${leverSlug}\n`;
  }

  if (noteStr) {
    // Escape double-quotes in notes
    entry += `    notes: "${noteStr.replace(/"/g, '\\"')}"\n`;
  }
  entry += `    enabled: true\n`;
  return entry;
}

// ── Main ──────────────────────────────────────────────────────────────

function main() {
  if (!existsSync(CSV_PATH)) { console.error(`Error: ${CSV_PATH} not found`); process.exit(1); }
  if (!existsSync(PORTALS_PATH)) { console.error(`Error: ${PORTALS_PATH} not found`); process.exit(1); }

  const rows = parseCsv(readFileSync(CSV_PATH, 'utf-8'));
  const portalsText = readFileSync(PORTALS_PATH, 'utf-8');
  const { names: tracked, slugs: trackedSlugs } = loadTrackedData(portalsText);

  // Build normalized name set for fuzzy dedup
  const trackedNormalized = new Set([...tracked].map(normalizeName));

  const toAdd = [];
  const skippedAlready = [];
  const skippedNoSlug = [];
  const skippedFilter = [];

  for (const row of rows) {
    const { greenhouse_slug: ghSlug, lever_slug: leverSlug, name } = row;

    if (!ghSlug && !leverSlug) { skippedNoSlug.push(name); continue; }

    const nameLower = name.toLowerCase();
    const nameNorm = normalizeName(name);
    const slugLower = (ghSlug || leverSlug || '').toLowerCase();

    if (tracked.has(nameLower) || trackedSlugs.has(slugLower) || trackedNormalized.has(nameNorm)) {
      skippedAlready.push(name); continue;
    }

    const wlb = parseFloat(row.glassdoor_ds_it_wlb_score);
    if (minWlb !== null && (isNaN(wlb) || wlb < minWlb)) {
      skippedFilter.push(`${name} (DS WLB ${row.glassdoor_ds_it_wlb_score || 'n/a'})`);
      continue;
    }

    const emp = parseInt(row.employee_count_estimate);
    if (minEmployees !== null && (isNaN(emp) || emp < minEmployees)) {
      skippedFilter.push(`${name} (employees: ${row.employee_count_estimate || 'n/a'})`);
      continue;
    }

    toAdd.push(row);
  }

  console.log(`companies_merged.csv: ${rows.length} rows`);
  console.log(`Already tracked: ${skippedAlready.length}`);
  console.log(`No ATS slug: ${skippedNoSlug.length}`);
  if (skippedFilter.length) console.log(`Filtered by WLB/employees: ${skippedFilter.length}`);
  console.log(`To add: ${toAdd.length}`);

  if (toAdd.length === 0) {
    console.log('\nNothing to add.');
    return;
  }

  if (dryRun) {
    console.log('\n--- DRY RUN (portals.yml not modified) ---\n');
    for (const row of toAdd) {
      const ats = row.greenhouse_slug
        ? `greenhouse:${row.greenhouse_slug}`
        : `lever:${row.lever_slug}`;
      const wlb = row.glassdoor_ds_it_wlb_score || 'n/a';
      console.log(`  + ${row.name}  (${ats})  DS WLB: ${wlb}`);
    }
    return;
  }

  // Append to portals.yml — preserve all existing content + comments
  const block = `\n  # -- Synced from companies_merged.csv (${new Date().toISOString().slice(0, 10)}) --\n`
    + toAdd.map(buildEntry).join('');

  writeFileSync(PORTALS_PATH, portalsText + block, 'utf-8');

  console.log(`\nAdded ${toAdd.length} companies to portals.yml:`);
  for (const row of toAdd) {
    const ats = row.greenhouse_slug
      ? `greenhouse:${row.greenhouse_slug}`
      : `lever:${row.lever_slug}`;
    const wlb = row.glassdoor_ds_it_wlb_score || 'n/a';
    console.log(`  + ${row.name}  (${ats})  DS WLB: ${wlb}`);
  }

  if (skippedFilter.length) {
    console.log(`\nFiltered out (did not meet --min-wlb / --min-employees):`);
    skippedFilter.forEach(s => console.log(`  - ${s}`));
  }
}

main();
