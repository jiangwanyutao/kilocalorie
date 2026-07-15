import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const pub = resolve(root, 'public');

const jobs = [
  { svg: 'favicon.svg',              out: 'icons/pwa-192.png',        w: 192 },
  { svg: 'icons/icon-maskable.svg',  out: 'icons/pwa-512.png',        w: 512 },
  { svg: 'favicon.svg',              out: 'icons/apple-touch-icon.png', w: 180 },
];

for (const job of jobs) {
  const svg = readFileSync(resolve(pub, job.svg), 'utf-8');
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: job.w } })
    .render()
    .asPng();
  writeFileSync(resolve(pub, job.out), png);
  console.log(`  ✓ ${job.out}  ${(png.length / 1024).toFixed(1)} KB @ ${job.w}px`);
}

console.log('\nicons generated.');
