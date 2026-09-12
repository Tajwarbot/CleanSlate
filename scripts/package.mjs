import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');
const zipFile = resolve(root, 'cleanslate-v0.1.0.zip');

if (!existsSync(dist)) {
  console.error('Error: dist directory does not exist. Run "npm run build" first.');
  process.exit(1);
}

try {
  // Use PowerShell Compress-Archive to create zip package
  const cmd = `pwsh -Command "Compress-Archive -Path '${dist}\\*' -DestinationPath '${zipFile}' -Force"`;
  execSync(cmd, { stdio: 'inherit' });
  console.log(`\n✅ CleanSlate extension packaged successfully: ${zipFile}`);
} catch (err) {
  console.error('Failed to create zip package:', err);
  process.exit(1);
}
