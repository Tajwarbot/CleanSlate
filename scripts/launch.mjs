import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec, execSync } from 'child_process';
import readline from 'readline';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

// Ensure extension is built
if (!existsSync(resolve(dist, 'manifest.json'))) {
  console.log('Building CleanSlate extension...');
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
}

// Ensure zip package is generated
try {
  execSync('npm run package', { cwd: root, stdio: 'ignore' });
} catch {
  // Ignore zip failure if non-critical
}

const localAppData = process.env.LOCALAPPDATA || resolve(os.homedir(), 'AppData/Local');
const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

const browsers = [
  {
    id: 'brave',
    name: 'Brave Browser',
    exe: [
      resolve(programFiles, 'BraveSoftware/Brave-Browser/Application/brave.exe'),
      resolve(programFilesX86, 'BraveSoftware/Brave-Browser/Application/brave.exe'),
      resolve(localAppData, 'BraveSoftware/Brave-Browser/Application/brave.exe'),
    ].find(existsSync) || '',
    extUrl: 'brave://extensions',
  },
  {
    id: 'chrome',
    name: 'Google Chrome',
    exe: [
      resolve(programFiles, 'Google/Chrome/Application/chrome.exe'),
      resolve(programFilesX86, 'Google/Chrome/Application/chrome.exe'),
      resolve(localAppData, 'Google/Chrome/Application/chrome.exe'),
    ].find(existsSync) || '',
    extUrl: 'chrome://extensions',
  },
  {
    id: 'edge',
    name: 'Microsoft Edge',
    exe: [
      resolve(programFilesX86, 'Microsoft/Edge/Application/msedge.exe'),
      resolve(programFiles, 'Microsoft/Edge/Application/msedge.exe'),
      resolve(localAppData, 'Microsoft/Edge/Application/msedge.exe'),
    ].find(existsSync) || '',
    extUrl: 'edge://extensions',
  },
].filter((b) => Boolean(b.exe));

console.log('\n====================================================');
console.log('   🧼 CleanSlate Browser Extension Launcher');
console.log('====================================================\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function promptUser() {
  if (browsers.length === 0) {
    console.log('No supported browsers found automatically.');
    openExplorerAndExtensions('https://www.facebook.com');
    rl.close();
    return;
  }

  console.log('Detected installed browsers on your system:');
  browsers.forEach((b, index) => {
    console.log(`  [${index + 1}] ${b.name}`);
  });
  console.log(`  [${browsers.length + 1}] Open File Explorer & Extensions Page (Manual 1-Click Load)`);

  rl.question(`\nSelect your browser (1-${browsers.length + 1}) [Default: 1]: `, (answer) => {
    const choiceIdx = parseInt(answer.trim() || '1', 10) - 1;

    if (choiceIdx >= 0 && choiceIdx < browsers.length) {
      const selected = browsers[choiceIdx];
      console.log(`\nSelected: ${selected.name}`);
      console.log('  [1] Launch with your Existing Main Profile (Keeps your Facebook login active)');
      console.log('  [2] Open Extensions page & Dist folder in File Explorer');

      rl.question('\nChoice [Default: 1]: ', (profileChoice) => {
        const mode = profileChoice.trim() || '1';
        if (mode === '1') {
          launchBrowserWithMainProfile(selected);
        } else {
          openExplorerAndExtensions(selected.extUrl);
        }
        rl.close();
      });
    } else {
      openExplorerAndExtensions('brave://extensions');
      rl.close();
    }
  });
}

function launchBrowserWithMainProfile(browser) {
  console.log(`\n🚀 Launching ${browser.name} with your main logged-in profile...`);
  console.log(`Pre-loading extension from: ${dist}\n`);

  const cmd = `"${browser.exe}" --load-extension="${dist}" "https://www.facebook.com"`;
  exec(cmd, (err) => {
    if (err) {
      console.log(`Could not launch directly. Opening extensions page instead.`);
      openExplorerAndExtensions(browser.extUrl);
    }
  });
}

function openExplorerAndExtensions(extUrl) {
  console.log(`\n📂 Opening build directory in File Explorer: ${dist}`);
  exec(`explorer "${dist}"`);

  console.log(`\n🌐 Opening extensions page: ${extUrl}`);
  console.log('\n--- 1-Click Instructions ---');
  console.log('1. Turn on "Developer mode" toggle in top-right of your browser.');
  console.log('2. Click "Load unpacked" and select the opened "dist" folder.');
  console.log('============================\n');

  exec(`start ${extUrl}`).on('error', () => {
    exec(`start https://www.facebook.com`);
  });
}

promptUser();
