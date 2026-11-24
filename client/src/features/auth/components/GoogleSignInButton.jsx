import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let scriptPromise;

function loadGoogleScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = undefined;
      reject(new Error('Google script failed to load'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * "Sign in with Google" via Google Identity Services. The ID token it returns
 * is sent to POST /auth/google, where the server verifies it.
 * Hidden entirely when VITE_GOOGLE_CLIENT_ID is not configured.
 */
export function GoogleSignInButton({ onCredential, disabled }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const { i18n } = useTranslation();
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !ref.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => response?.credential && callbackRef.current(response.credential),
          ux_mode: 'popup',
        });
        window.google.accounts.id.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: Math.min(ref.current.offsetWidth || 320, 400),
          locale: i18n.language,
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [clientId, i18n.language]);

  if (!clientId || failed) return null;
  return (
    <div
      ref={ref}
      className={disabled ? 'pointer-events-none flex min-h-tap justify-center opacity-60' : 'flex min-h-tap justify-center'}
    />
  );
}
