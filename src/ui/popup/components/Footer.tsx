/**
 * Footer — version info and privacy link.
 */

export function Footer() {
  const version = chrome.runtime.getManifest().version;

  return (
    <footer className="cs-footer">
      CleanSlate v{version} · Your data stays on your device
    </footer>
  );
}
