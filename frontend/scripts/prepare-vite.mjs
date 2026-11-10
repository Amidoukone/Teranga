import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePublic = path.join(frontendRoot, 'public');
const stagedPublic = path.join(frontendRoot, '.vite-public');
const canonicalHtmlPath = path.join(sourcePublic, 'index.html');
const viteHtmlPath = path.join(frontendRoot, 'index.html');
const generatedMarker = '<!-- Generated from public/index.html for Vite. -->';

if (path.dirname(stagedPublic) !== frontendRoot || path.basename(stagedPublic) !== '.vite-public') {
  throw new Error('Unexpected Vite staging directory.');
}

rmSync(stagedPublic, { recursive: true, force: true });
mkdirSync(stagedPublic, { recursive: true });

function copyPublicFiles(sourceDir, targetDir) {
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.toLowerCase() === 'index.html') continue;

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(targetPath, { recursive: true });
      copyPublicFiles(sourcePath, targetPath);
    } else if (entry.isFile()) {
      cpSync(sourcePath, targetPath);
    }
  }
}

copyPublicFiles(sourcePublic, stagedPublic);

let html = readFileSync(canonicalHtmlPath, 'utf8').replaceAll('%PUBLIC_URL%', '');
if (!html.includes(generatedMarker)) {
  if (statSync(viteHtmlPath, { throwIfNoEntry: false })) {
    const existingHtml = readFileSync(viteHtmlPath, 'utf8');
    if (!existingHtml.includes(generatedMarker)) {
      throw new Error('Refusing to overwrite an unrecognized frontend/index.html.');
    }
  }
  html = html.replace('<head>', `<head>\n    ${generatedMarker}`);
  html = html.replace('</body>', '    <script type="module" src="/src/index.jsx"></script>\n  </body>');
}

writeFileSync(viteHtmlPath, html, 'utf8');
