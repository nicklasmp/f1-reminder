'use client';

import { useEffect, useState } from 'react';

export function UpdateBanner() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const wire = (reg: ServiceWorkerRegistration) => {
      // Already waiting (e.g. page was refreshed while a SW was pending)
      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(reg.waiting);
        return;
      }
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(sw);
          }
        });
      });
    };

    navigator.serviceWorker.ready.then((reg) => {
      wire(reg);
      // Check for updates every 60 s (PWA users rarely navigate so the
      // browser won't detect updates on its own)
      const id = setInterval(() => reg.update(), 60_000);
      return () => clearInterval(id);
    });

    // When the new SW takes over, reload so the user gets fresh assets
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloading) {
        reloading = true;
        window.location.reload();
      }
    });
  }, []);

  const handleUpdate = () => {
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
  };

  if (!waitingWorker) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 'calc(72px + env(safe-area-inset-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: '#1e1e1e',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '999px',
        padding: '9px 10px 9px 18px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{
        fontSize: '13px',
        fontFamily: 'var(--font-body)',
        color: 'rgba(255,255,255,0.7)',
      }}>
        Ny version tilgængelig
      </span>
      <button
        onClick={handleUpdate}
        style={{
          background: 'var(--f1-red)',
          color: 'white',
          border: 'none',
          borderRadius: '999px',
          padding: '7px 16px',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
          letterSpacing: '0.01em',
        }}
      >
        Opdater nu
      </button>
    </div>
  );
}
