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
console.log('   🧼 CleanSlate Browser Extension Setup');
console.log('====================================================\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function promptUser() {
  if (browsers.length === 0) {
    console.log('No supported browsers found automatically.');
    installIntoMainBrowser('chrome://extensions');
    rl.close();
    return;
  }

  console.log('Select your browser to load CleanSlate into your logged-in profile:');
  browsers.forEach((b, index) => {
    console.log(`  [${index + 1}] ${b.name}`);
  });

  rl.question(`\nSelect browser (1-${browsers.length}) [Default: 1]: `, (answer) => {
    const choiceIdx = parseInt(answer.trim() || '1', 10) - 1;
    const selected = browsers[choiceIdx] || browsers[0];

    installIntoMainBrowser(selected.extUrl, selected);
    rl.close();
  });
}

function installIntoMainBrowser(extUrl, browser) {
  // Copy dist directory path to Windows clipboard for effortless paste
  try {
    const psCmd = `pwsh -Command "Set-Clipboard -Value '${dist}'"`;
    execSync(psCmd, { stdio: 'ignore' });
    console.log(`\n📋 Extension path copied to your clipboard:`);
    console.log(`   ${dist}\n`);
  } catch {
    // Fallback clip command
    try {
      execSync(`echo ${dist}| clip`, { stdio: 'ignore' });
    } catch {
      // Ignore if clip unavailable
    }
  }

  console.log(`📂 Opening "dist" folder in File Explorer...`);
  exec(`explorer "${dist}"`);

  console.log(`🌐 Opening ${extUrl} in your browser...`);
  
  if (browser && browser.exe) {
    exec(`"${browser.exe}" "${extUrl}"`);
    exec(`"${browser.exe}" "https://www.facebook.com"`);
  } else {
    exec(`start ${extUrl}`);
  }

  console.log('\n====================================================');
  console.log('   ⚡ 3-STEP QUICK SETUP IN YOUR BROWSER:');
  console.log('====================================================');
  console.log(' 1️⃣  Toggle "Developer mode" ON (top-right of extensions page)');
  console.log(' 2️⃣  Click "Load unpacked" (top-left button)');
  console.log(' 3️⃣  Press Ctrl+V to paste folder path & click "Select Folder"');
  console.log('====================================================\n');
  console.log('Done! CleanSlate will stay installed permanently in your browser.');
}

promptUser();
