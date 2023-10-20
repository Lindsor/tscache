import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const outputPath = resolve(__dirname, '..', 'dist', 'esm', 'package.json');

writeFileSync(outputPath, JSON.stringify({ type: 'module' }), 'utf-8');
