import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const minify = process.argv.includes('--minify');

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);
pkg.version = `${major}.${minor}.${patch + 1}`;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
const version = pkg.version;

const result = await esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  write: false,
  minify,
  target: ['chrome90'],
  logLevel: 'silent',
});

const js = result.outputFiles[0].text;
const css = readFileSync('src/style.css', 'utf8');
let html = readFileSync('src/index.html', 'utf8');

html = html.replace('  <!-- STYLES -->', `  <style>\n${css}  </style>`);
html = html.replace('  <!-- SCRIPTS -->', `  <script>\n${js}  </script>`);
html = html.replace('{{APP_VERSION}}', version);

mkdirSync('dist', { recursive: true });
writeFileSync('dist/opencrank.html', html);
console.log(`Built dist/opencrank.html (v${version})`);
