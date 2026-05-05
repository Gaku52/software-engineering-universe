#!/usr/bin/env node
/**
 * translation-status.js
 *
 * Detects translated/untranslated files and outputs:
 * 1. Progress summary
 * 2. Per-category breakdown
 * 3. Next batch of files to translate (for agent prompts)
 *
 * Usage:
 *   node translation-status.js              # Show progress
 *   node translation-status.js --next 24    # Show next 24 files to translate
 *   node translation-status.js --batch 3    # Group into batches of 3 for agents
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SKILLS_ROOT = path.resolve(__dirname, '../..');
const EXCLUDE_DIRS = ['ja', '_meta', '_legacy', '_original-skills'];
const EXCLUDE_CATEGORIES = ['08-hobby'];

function isJapanese(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').slice(0, 20);
    const jpPattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;
    let jpLineCount = 0;
    for (const line of lines) {
      if (jpPattern.test(line)) jpLineCount++;
    }
    return jpLineCount > 1;
  } catch {
    return false;
  }
}

function findFiles(pattern) {
  const results = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(SKILLS_ROOT, fullPath);

      // Skip excluded directories
      if (entry.isDirectory()) {
        const dirName = entry.name;
        if (EXCLUDE_DIRS.includes(dirName)) continue;
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        if (pattern === 'docs' && relPath.includes('/docs/')) {
          results.push(fullPath);
        } else if (pattern === 'SKILL.md' && entry.name === 'SKILL.md') {
          results.push(fullPath);
        }
      }
    }
  }

  // Walk each category directory
  const categories = fs.readdirSync(SKILLS_ROOT)
    .filter(d => /^\d{2}-/.test(d) && !EXCLUDE_CATEGORIES.includes(d))
    .map(d => path.join(SKILLS_ROOT, d));

  for (const catDir of categories) {
    walk(catDir);
  }

  return results.sort();
}

function getCategory(filePath) {
  const rel = path.relative(SKILLS_ROOT, filePath);
  const parts = rel.split(path.sep);
  return parts[0] || 'unknown';
}

function main() {
  const args = process.argv.slice(2);
  const nextCount = args.includes('--next') ? parseInt(args[args.indexOf('--next') + 1]) || 24 : 0;
  const batchSize = args.includes('--batch') ? parseInt(args[args.indexOf('--batch') + 1]) || 3 : 3;

  // Find all files
  const docsFiles = findFiles('docs');
  const skillFiles = findFiles('SKILL.md');

  // Classify
  const docsJp = docsFiles.filter(f => isJapanese(f));
  const docsEn = docsFiles.filter(f => !isJapanese(f));
  const skillJp = skillFiles.filter(f => isJapanese(f));
  const skillEn = skillFiles.filter(f => !isJapanese(f));

  const totalFiles = docsFiles.length + skillFiles.length;
  const totalEn = docsEn.length + skillEn.length;
  const totalJp = docsJp.length + skillJp.length;
  const pct = ((totalEn / totalFiles) * 100).toFixed(1);

  // Summary
  console.log('=== Translation Progress ===');
  console.log(`SKILL.md: ${skillEn.length} / ${skillFiles.length} (${skillJp.length} remaining)`);
  console.log(`docs:     ${docsEn.length} / ${docsFiles.length} (${docsJp.length} remaining)`);
  console.log(`Total:    ${totalEn} / ${totalFiles} = ${pct}%`);
  console.log('');

  // Per-category breakdown
  const categories = {};
  for (const f of docsFiles) {
    const cat = getCategory(f);
    if (!categories[cat]) categories[cat] = { total: 0, en: 0, jp: 0 };
    categories[cat].total++;
    if (isJapanese(f)) categories[cat].jp++;
    else categories[cat].en++;
  }

  console.log('=== Per-Category (docs) ===');
  for (const [cat, stats] of Object.entries(categories).sort()) {
    const catPct = stats.total > 0 ? ((stats.en / stats.total) * 100).toFixed(0) : '0';
    console.log(`${cat}: ${stats.en}/${stats.total} (${catPct}%) — ${stats.jp} remaining`);
  }
  console.log('');

  // Next files to translate
  if (nextCount > 0 || args.length === 0) {
    const count = nextCount || 24;
    const nextFiles = docsJp.slice(0, count);

    console.log(`=== Next ${nextFiles.length} files to translate ===`);
    for (const f of nextFiles) {
      console.log(path.relative(SKILLS_ROOT, f));
    }
    console.log('');

    // Generate batch prompts
    if (args.includes('--batch') || args.length === 0) {
      const batches = [];
      for (let i = 0; i < nextFiles.length; i += batchSize) {
        batches.push(nextFiles.slice(i, i + batchSize));
      }

      console.log(`=== Agent Batches (${batches.length} agents x ${batchSize} files) ===`);
      for (let i = 0; i < batches.length; i++) {
        console.log(`\nBatch ${i + 1}:`);
        for (const f of batches[i]) {
          console.log(`  ${f}`);
        }
      }
    }
  }
}

main();
