import { existsSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const releaseDir = resolve(root, 'release');
const zipFile = resolve(releaseDir, `cleanslate-v${packageJson.version}.zip`);

if (!existsSync(resolve(dist, 'manifest.json'))) {
  console.error('Error: built extension is missing. Run "npm run build" first.');
  process.exit(1);
}

try {
  mkdirSync(releaseDir, { recursive: true });

  if (process.platform === 'win32') {
    const source = dist.replace(/'/g, "''");
    const destination = zipFile.replace(/'/g, "''");
    execSync(
      `pwsh -NoProfile -Command "Compress-Archive -Path '${source}\\*' -DestinationPath '${destination}' -Force"`,
      { stdio: 'inherit' },
    );
  } else {
    execSync(`rm -f "${zipFile}" && (cd "${dist}" && zip -qr "${zipFile}" .)`, {
      stdio: 'inherit',
    });
  }

  console.log(`\n✅ CleanSlate extension packaged successfully: ${zipFile}`);
} catch (err) {
  console.error('Failed to create zip package:', err);
  process.exit(1);
}
