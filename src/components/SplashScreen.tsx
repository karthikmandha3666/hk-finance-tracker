import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onDismiss: () => void;
  isReady?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onDismiss, isReady = true }) => {
  const [fading, setFading] = useState<boolean>(false);

  useEffect(() => {
    // Keep splash visible for startup duration (target ~1000ms), then smoothly fade out
    const minTimer = setTimeout(() => {
      if (isReady) {
        setFading(true);
        setTimeout(onDismiss, 300);
      }
    }, 1000);

    return () => clearTimeout(minTimer);
  }, [isReady, onDismiss]);

  const handleManualDismiss = () => {
    setFading(true);
    setTimeout(onDismiss, 200);
  };

  return (
    <div
      className={`splash-overlay ${fading ? 'fade-out' : ''}`}
      onClick={handleManualDismiss}
      role="banner"
      aria-label="Spendly Startup Screen"
    >
      <div className="splash-ambient-glow" aria-hidden="true" />
      <div className="splash-inner">
        <header className="splash-top-section">
          <span className="splash-hk-brand splash-hk-badge">HK</span>
        </header>

        <main className="splash-emblem-section">
          <img
            src={`${import.meta.env.BASE_URL}spendly-emblem.png`}
            alt="Spendly Emblem"
            className="splash-emblem-image"
          />
        </main>

        <footer className="splash-bottom-section">
          <h1 className="splash-brand-title splash-brand-name">Spendly</h1>
          <p className="splash-tagline">
            Spend smart. Live better.<br />
            Make every rupee count.
          </p>
        </footer>
      </div>
    </div>
  );
};
