import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../../');
const websiteDir = path.resolve(__dirname, '../');

const filesToSync = [
  { src: 'PRODUCT_THESIS.md', dest: 'thesis.md' },
  { src: 'ROADMAP.md', dest: 'roadmap.md' },
  { src: 'packages/schema/README.md', dest: 'schema/index.md' },
  { src: 'packages/schema/docs/MIGRATION_GUIDE.md', dest: 'schema/migration-guide.md' },
  { src: 'packages/schema/docs/BENCHMARKS.md', dest: 'schema/benchmarks.md' },
  { src: 'packages/schema/docs/ISSUE_CODES.md', dest: 'schema/issue-codes.md' },
  { src: 'packages/migrate-runner/README.md', dest: 'runner/index.md' },
  { src: 'packages/migrate-runner/docs/RUNNER.md', dest: 'runner/spec.md' },
  { src: 'packages/ui/README.md', dest: 'ui/index.md' },
  { src: 'packages/theme/README.md', dest: 'theme/index.md' }
];

console.log('Syncing documentation files...');

for (const { src, dest } of filesToSync) {
  const srcPath = path.resolve(rootDir, src);
  const destPath = path.resolve(websiteDir, dest);

  if (fs.existsSync(srcPath)) {
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(srcPath, destPath);
    console.log(`Synced: ${src} -> ${dest}`);
  } else {
    console.warn(`Warning: Source file not found: ${srcPath}`);
  }
}

console.log('Sync complete.');
