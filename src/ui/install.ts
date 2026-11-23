/**
 * Home-screen install. Chrome offers an install prompt once the page has a
 * manifest with icons and a service worker; we hold it until the player taps
 * "Add to home screen" in Settings. Installed, the game opens full screen,
 * loads from the phone, and the browser is far less likely to clear its save.
 */
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPrompt | undefined;

export function watchInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
  });
  window.addEventListener('appinstalled', () => (deferred = undefined));
  // The service worker only exists in a built game (not the dev server).
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    const register = () => void navigator.serviceWorker.register('./sw.js').catch(() => undefined);
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
  }
}

/** True when the browser will show its install prompt. */
export const canInstall = () => !!deferred;

/** True when the game already runs as an installed app. */
export const installed = () => window.matchMedia?.('(display-mode: fullscreen), (display-mode: standalone)').matches ?? false;

export async function promptInstall(): Promise<boolean> {
  const d = deferred;
  if (!d) return false;
  deferred = undefined;
  await d.prompt();
  return (await d.userChoice).outcome === 'accepted';
}
