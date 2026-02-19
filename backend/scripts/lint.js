'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = ['index.js', 'src', 'tests', 'scripts'];
const JS_EXT = '.js';

function walk(entryPath, output) {
  const stat = fs.statSync(entryPath);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(entryPath)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      walk(path.join(entryPath, name), output);
    }
    return;
  }

  if (stat.isFile() && entryPath.endsWith(JS_EXT)) {
    output.push(entryPath);
  }
}

function collectFiles() {
  const files = [];
  for (const target of TARGETS) {
    const absolute = path.join(ROOT, target);
    if (!fs.existsSync(absolute)) continue;
    walk(absolute, files);
  }
  return files;
}

const files = collectFiles();
const failures = [];

for (const filePath of files) {
  try {
    const source = fs.readFileSync(filePath, 'utf8');
    new vm.Script(source, { filename: filePath });
  } catch (err) {
    failures.push({
      filePath: path.relative(ROOT, filePath),
      stderr: err && err.message ? String(err.message) : '',
    });
  }
}

if (failures.length > 0) {
  console.error('Lint (syntax check) failed:');
  for (const failure of failures) {
    console.error(`- ${failure.filePath}`);
    if (failure.stderr) {
      console.error(failure.stderr);
    }
  }
  process.exit(1);
}

console.log(`Lint OK (${files.length} files checked)`);
