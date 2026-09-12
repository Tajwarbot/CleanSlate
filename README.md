# CleanSlate

CleanSlate is a privacy-first browser extension for reviewing and removing your own Facebook and Messenger activity. It works locally in your browser and uses the controls rendered by Facebook rather than an external Facebook API.


## Install from GitHub (recommended)

You do not need Node.js or programming knowledge to install a published package.

1. Open the repository's **Releases** page:
   `https://github.com/Tajwarbot/CleanSlate/releases`
2. Download the latest `cleanslate-vX.Y.Z.zip` file.
3. Extract the ZIP file to a permanent folder. Do not delete this folder after installing.
4. Open your browser's extensions page:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`
5. Turn on **Developer mode**.
6. Click **Load unpacked**.
7. Select the extracted CleanSlate folder—the folder containing `manifest.json`. (dist)
8. Pin CleanSlate to the browser toolbar, then open Facebook or Messenger and click the extension icon.

Browsers do not allow a ZIP file to be installed directly as an unpacked extension, which is why it must be extracted first. Keep the extracted folder in place while using CleanSlate.

### Why two installation clicks are required

Chrome, Brave, and Edge intentionally prevent websites, GitHub, scripts, and local ZIP files from silently enabling Developer mode or installing an unpacked extension. This protects users from malware silently adding browser extensions. No GitHub download can safely bypass those browser controls.

For that reason, the normal GitHub installation always requires the user to:

1. Enable **Developer mode**.
2. Choose **Load unpacked**.
3. Select the extracted folder.

CleanSlate's optional Windows helper (`npm run start`, for source users) can open the extensions page, open the build folder, and copy the folder path to the clipboard, but the final browser clicks must remain manual.

## First use

1. Open Facebook or Messenger and make sure you are signed in.
2. Click the CleanSlate toolbar icon.
3. Choose **Facebook Activity** or **Messenger**.
4. Follow the guided page check.
5. Use **Safety Preview Mode** first if you want to verify the loaded activity without removing anything.
6. To actually remove Facebook activity, turn Safety Preview Mode off and confirm the cleanup. CleanSlate uses Facebook's native **All**, **Remove**, and confirmation controls.

Facebook may initially open the general Activity Log. If the extension says you are on the default page, click **Open specific page** again until the requested category is detected.

## Install from source

This is for contributors or users who want to build the extension themselves.

Requirements:

- Node.js 20 or newer
- Chrome, Brave, Edge, or another Chromium browser

From the repository folder:

```powershell
npm install
npm run package
```

The packaged extension is written to `release/cleanslate-vX.Y.Z.zip`. Extract it and follow the installation steps above.

For development without creating a ZIP:

```powershell
npm install
npm run build
```

Then load the `dist` folder as the unpacked extension.

## Safety and privacy

- CleanSlate does not use a Facebook access token or external Facebook API.
- Activity is inspected in the logged-in browser tab.
- Safety Preview never clicks Facebook's Remove button.
- Facebook cleanup may be irreversible. Review the page and confirmation carefully.
- The extension requests access only to Facebook and Messenger pages plus local extension storage.

## Browser updates

After downloading a newer release:

1. Extract the new ZIP to a new folder.
2. Open the extensions page.
3. Click **Reload** on CleanSlate, or remove the old unpacked version and load the new folder.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run build` | Type-check and build the extension into `dist` |
| `npm run package` | Build a versioned ZIP in `release` |
| `npm run typecheck` | Run TypeScript checking |
| `npm test` | Run the test suite |
