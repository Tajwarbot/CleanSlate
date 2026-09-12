import { existsSync, readdirSync, readFileSync } from 'fs';
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

const localAppData = process.env.LOCALAPPDATA || resolve(os.homedir(), 'AppData/Local');
const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

const browserConfigs = [
  {
    id: 'brave',
    name: 'Brave Browser',
    exePaths: [
      resolve(programFiles, 'BraveSoftware/Brave-Browser/Application/brave.exe'),
      resolve(programFilesX86, 'BraveSoftware/Brave-Browser/Application/brave.exe'),
      resolve(localAppData, 'BraveSoftware/Brave-Browser/Application/brave.exe'),
    ],
    userDataDir: resolve(localAppData, 'BraveSoftware/Brave-Browser/User Data'),
    extUrl: 'brave://extensions',
  },
  {
    id: 'chrome',
    name: 'Google Chrome',
    exePaths: [
      resolve(programFiles, 'Google/Chrome/Application/chrome.exe'),
      resolve(programFilesX86, 'Google/Chrome/Application/chrome.exe'),
      resolve(localAppData, 'Google/Chrome/Application/chrome.exe'),
    ],
    userDataDir: resolve(localAppData, 'Google/Chrome/User Data'),
    extUrl: 'chrome://extensions',
  },
  {
    id: 'edge',
    name: 'Microsoft Edge',
    exePaths: [
      resolve(programFilesX86, 'Microsoft/Edge/Application/msedge.exe'),
      resolve(programFiles, 'Microsoft/Edge/Application/msedge.exe'),
      resolve(localAppData, 'Microsoft/Edge/Application/msedge.exe'),
    ],
    userDataDir: resolve(localAppData, 'Microsoft/Edge/User Data'),
    extUrl: 'edge://extensions',
  },
  {
    id: 'opera',
    name: 'Opera',
    exePaths: [
      resolve(localAppData, 'Programs/Opera/opera.exe'),
      resolve(programFiles, 'Opera/opera.exe'),
      resolve(programFilesX86, 'Opera/opera.exe'),
    ],
    userDataDir: resolve(localAppData, 'Opera Software/Opera Stable'),
    extUrl: 'opera://extensions',
  },
  {
    id: 'vivaldi',
    name: 'Vivaldi',
    exePaths: [
      resolve(localAppData, 'Vivaldi/Application/vivaldi.exe'),
      resolve(programFiles, 'Vivaldi/Application/vivaldi.exe'),
    ],
    userDataDir: resolve(localAppData, 'Vivaldi/User Data'),
    extUrl: 'vivaldi://extensions',
  },
];

console.log('\n====================================================');
console.log('   🧼 CleanSlate Extension Installation Helper');
console.log('====================================================\n');

// Step 1: Ensure extension is built
if (!existsSync(resolve(dist, 'manifest.json'))) {
  console.log('📦 Building CleanSlate extension...');
  try {
    execSync('npm run build', { cwd: root, stdio: 'inherit' });
  } catch (err) {
    console.error('❌ Build failed. Please fix build errors before installing.');
    process.exit(1);
  }
} else {
  console.log('⚡ CleanSlate extension bundle found in "dist" directory.');
}

const installedBrowsers = browserConfigs
  .map((b) => ({
    ...b,
    exe: b.exePaths.find(existsSync) || '',
  }))
  .filter((b) => Boolean(b.exe));

function getProfilesForBrowser(userDataDir) {
  const profiles = [];
  if (!userDataDir || !existsSync(userDataDir)) return profiles;

  try {
    const entries = readdirSync(userDataDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'System Profile' || entry.name === 'Guest Profile') continue;

      const prefPath = resolve(userDataDir, entry.name, 'Preferences');
      if (existsSync(prefPath)) {
        let name = entry.name;
        try {
          const pref = JSON.parse(readFileSync(prefPath, 'utf-8'));
          if (pref.profile && pref.profile.name) {
            name = pref.profile.name;
          }
        } catch {
          // ignore parsing error
        }
        profiles.push({
          dirName: entry.name,
          displayName: name === entry.name ? entry.name : `${name} (${entry.name})`,
        });
      }
    }
  } catch {
    // ignore readdir error
  }
  return profiles;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(query) {
  return new Promise((res) => rl.question(query, res));
}

async function main() {
  if (installedBrowsers.length === 0) {
    console.log('\n❌ No supported Chromium browsers detected automatically.');
    openExtensionsPage('chrome://extensions', null, null);
    rl.close();
    return;
  }

  console.log('\nDetected installed browsers:');
  installedBrowsers.forEach((b, index) => {
    console.log(`  [${index + 1}] ${b.name}`);
  });

  const browserAns = await ask(`\nSelect browser (1-${installedBrowsers.length}) [Default: 1]: `);
  const browserIdx = parseInt(browserAns.trim() || '1', 10) - 1;
  const selectedBrowser = installedBrowsers[browserIdx] || installedBrowsers[0];

  const profiles = getProfilesForBrowser(selectedBrowser.userDataDir);

  let selectedProfile = null;
  if (profiles.length > 0) {
    console.log(`\nDetected profiles for ${selectedBrowser.name}:`);
    profiles.forEach((p, index) => {
      console.log(`  [${index + 1}] ${p.displayName}`);
    });
    console.log(`  [${profiles.length + 1}] Choose profile inside browser window`);

    const profileAns = await ask(`\nSelect profile (1-${profiles.length + 1}) [Default: 1]: `);
    const profileIdx = parseInt(profileAns.trim() || '1', 10) - 1;
    if (profileIdx >= 0 && profileIdx < profiles.length) {
      selectedProfile = profiles[profileIdx];
    }
  }

  console.log(`\nHow would you like to install CleanSlate into ${selectedBrowser.name}?`);
  console.log('  [1] Permanent Install (Opens extensions page + copies folder path to Ctrl+V)');
  console.log('  [2] Isolated Dev Session (Starts clean browser profile pre-loaded for testing)');

  const modeAns = await ask('\nSelect mode (1 or 2) [Default: 1]: ');
  const mode = modeAns.trim() || '1';

  if (mode === '2') {
    launchIsolatedDevWindow(selectedBrowser);
  } else {
    openExtensionsPage(selectedBrowser.extUrl, selectedBrowser, selectedProfile);
  }

  rl.close();
}

function launchIsolatedDevWindow(browser) {
  console.log(`\n🚀 Launching isolated session in ${browser.name}...`);
  const cmd = `"${browser.exe}" --user-data-dir="${devProfile}" --disable-extensions-except="${dist}" --load-extension="${dist}" "${browser.extUrl}"`;
  exec(cmd);
  console.log('✅ Isolated browser window launched with CleanSlate pre-loaded!');
}

function openExtensionsPage(extUrl, browser, profile) {
  try {
    const psCmd = `pwsh -Command "Set-Clipboard -Value '${dist}'"`;
    execSync(psCmd, { stdio: 'ignore' });
    console.log(`\n📋 CleanSlate folder path copied to your clipboard:`);
    console.log(`   ${dist}`);
  } catch {
    try {
      execSync(`echo ${dist}| clip`, { stdio: 'ignore' });
    } catch {
      // Ignore clip fallback failure
    }
  }

  console.log(`\n📂 Opening "dist" folder in File Explorer...`);
  try {
    exec(`explorer "${dist}"`);
  } catch {
    // Ignore explorer launch error
  }

  const profileFlag = profile ? `--profile-directory="${profile.dirName}"` : '';
  const profileNameStr = profile ? profile.displayName : 'Selected Browser';

  console.log(`\n🌐 Opening ${browser ? browser.name : 'browser'} extensions page (${profileNameStr})...`);

  const args = [];
  if (profileFlag) args.push(profileFlag);
  args.push(`--load-extension="${dist}"`);
  args.push(`"${extUrl}"`);

  if (browser && browser.exe) {
    const launchCmd = `"${browser.exe}" ${args.join(' ')}`;
    exec(launchCmd);
  } else {
    exec(`start ${extUrl}`);
  }

  console.log('\n====================================================');
  console.log('   ⚡ 3-STEP PERMANENT INSTALLATION:');
  console.log('====================================================');
  console.log(' 1️⃣  Toggle "Developer mode" ON (top-right of extensions page)');
  console.log(' 2️⃣  Click "Load unpacked" (top-left button)');
  console.log(' 3️⃣  Press Ctrl+V to paste path & click "Select Folder"');
  console.log('====================================================');
  console.log('CleanSlate will remain permanently installed in your browser toolbar!\n');
}

main();
