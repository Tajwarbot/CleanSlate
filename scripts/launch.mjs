import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec, execSync } from 'child_process';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

// Ensure build exists
if (!existsSync(resolve(dist, 'manifest.json'))) {
  console.log('Building CleanSlate extension first...');
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
}

// Possible browser executable paths on Windows
const chromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${os.homedir()}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
];

let browserPath = chromePaths.find((p) => existsSync(p));

if (!browserPath) {
  console.error('No supported browser (Chrome / Edge / Brave) found at standard installation paths.');
  console.log('Please open chrome://extensions in your browser and select "Load unpacked", pointing to:');
  console.log(dist);
  process.exit(1);
}

const userDevProfile = resolve(root, '.dev-profile');
console.log(`\n🚀 Launching browser (${browserPath}) with CleanSlate pre-loaded...`);
console.log(`Extension Directory: ${dist}\n`);

const cmd = `"${browserPath}" --load-extension="${dist}" --user-data-dir="${userDevProfile}" "https://www.facebook.com"`;

exec(cmd, (err) => {
  if (err) {
    console.error('Error launching browser:', err);
  }
});
