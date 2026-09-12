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
const devProfile = resolve(root, '.cleanslate-profile');

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
console.log('   🧼 CleanSlate Extension Installation Helper');
console.log('====================================================\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function promptUser() {
  if (browsers.length === 0) {
    console.log('No supported browsers found automatically.');
    openExtensionsPage('chrome://extensions');
    rl.close();
    return;
  }

  console.log('Detected installed browsers:');
  browsers.forEach((b, index) => {
    console.log(`  [${index + 1}] ${b.name}`);
  });

  rl.question(`\nSelect browser (1-${browsers.length}) [Default: 1]: `, (answer) => {
    const choiceIdx = parseInt(answer.trim() || '1', 10) - 1;
    const selected = browsers[choiceIdx] || browsers[0];

    console.log(`\nHow would you like to install CleanSlate into ${selected.name}?`);
    console.log('  [1] Permanent Install (Opens extensions page + copies folder path to Ctrl+V)');
    console.log('  [2] Direct Launch Window (Starts browser instance with extension pre-loaded)');

    rl.question('\nSelect mode (1 or 2) [Default: 1]: ', (modeAns) => {
      const mode = modeAns.trim() || '1';
      if (mode === '2') {
        launchDirectDevWindow(selected);
      } else {
        openExtensionsPage(selected.extUrl, selected);
      }
      rl.close();
    });
  });
}

function launchDirectDevWindow(browser) {
  console.log(`\n🚀 Launching ${browser.name} with CleanSlate pre-loaded...`);
  const cmd = `"${browser.exe}" --user-data-dir="${devProfile}" --disable-extensions-except="${dist}" --load-extension="${dist}" "${browser.extUrl}"`;
  exec(cmd);
  console.log('Browser launched successfully into extensions page!');
}

function openExtensionsPage(extUrl, browser) {
  try {
    const psCmd = `pwsh -Command "Set-Clipboard -Value '${dist}'"`;
    execSync(psCmd, { stdio: 'ignore' });
    console.log(`\n📋 CleanSlate folder path copied to your clipboard:`);
    console.log(`   ${dist}\n`);
  } catch {
    try {
      execSync(`echo ${dist}| clip`, { stdio: 'ignore' });
    } catch {
      // Ignore fallback
    }
  }

  console.log(`📂 Opening "dist" folder in File Explorer...`);
  exec(`explorer "${dist}"`);

  console.log(`🌐 Opening ${extUrl} in your browser...`);
  if (browser && browser.exe) {
    exec(`"${browser.exe}" "${extUrl}"`);
  } else {
    exec(`start ${extUrl}`);
  }

  console.log('\n====================================================');
  console.log('   ⚡ 3-STEP INSTALLATION:');
  console.log('====================================================');
  console.log(' 1️⃣  Toggle "Developer mode" ON (top-right of extensions page)');
  console.log(' 2️⃣  Click "Load unpacked" (top-left button)');
  console.log(' 3️⃣  Press Ctrl+V to paste path & click "Select Folder"');
  console.log('====================================================\n');
  console.log('CleanSlate will now remain installed permanently in your browser toolbar!');
}

promptUser();
