import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const distDir = 'dist';

// List of files and patterns to copy
const filesToCopy = [
  'index.html',
  'manifest.json',
  'Aurebesh.ttf',
  'Orbitron.woff2',
  'favicon.ico',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'apple-touch-icon.png',
  'android-chrome-192x192.png',
  'android-chrome-256x256.png',
  'sw.js'
];
const dirsToCopy = ['screenshots'];

// Clean and create dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });
console.log(`Created directory: ${distDir}`);

// Copy files
filesToCopy.forEach(file => {
  const sourcePath = path.join(file);
  const destPath = path.join(distDir, file);
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
  } else {
    console.warn(`Warning: Source file not found, skipping: ${sourcePath}`);
  }
});

// Copy directories
dirsToCopy.forEach(dir => {
  const sourcePath = path.join(dir);
  const destPath = path.join(distDir, dir);
  if (fs.existsSync(sourcePath)) {
    fs.cpSync(sourcePath, destPath, { recursive: true });
  } else {
    console.warn(`Warning: Source directory not found, skipping: ${sourcePath}`);
  }
});
// Use esbuild to bundle JavaScript
esbuild.build({
  entryPoints: ['msh3js.js'],
  bundle: true,
  outfile: 'dist/msh3js.bundle.js',
  format: 'esm',
  minify: true,
}).catch((e) => {
  console.error("esbuild failed:", e);
  process.exit(1);
}).then(() => {
  console.log('JavaScript bundled successfully.');
});

console.log('Web assets successfully copied to dist folder.');