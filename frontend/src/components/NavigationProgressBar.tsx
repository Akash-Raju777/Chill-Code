'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Complete progress on pathname or searchParams change
  useEffect(() => {
    if (visible) {
      setProgress(100);
      const hideTimeout = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 200);
      return () => clearTimeout(hideTimeout);
    }
  }, [pathname, searchParams]);

  // Click listener for all internal navigation links
  useEffect(() => {
    const handleLinkClick = (event: MouseEvent) => {
      // Find closest anchor tag
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a') as HTMLAnchorElement | null;

      if (!anchor || !anchor.href) return;

      // Ignore if new tab, external link, download, or hash on current page
      if (
        anchor.target === '_blank' ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      try {
        const url = new URL(anchor.href, window.location.origin);
        // Only trigger for same-origin navigation
        if (url.origin === window.location.origin) {
          const isSamePath = url.pathname === window.location.pathname && url.search === window.location.search;
          if (!isSamePath && !url.hash.startsWith('#')) {
            // Start navigation indicator immediately
            setVisible(true);
            setProgress(25);

            if (timerRef.current) clearInterval(timerRef.current);

            // Gradually animate up to 85% while waiting for page
            let current = 25;
            timerRef.current = setInterval(() => {
              current += Math.random() * 12;
              if (current > 85) {
                current = 85;
                if (timerRef.current) clearInterval(timerRef.current);
              }
              setProgress(current);
            }, 100);
          }
        }
      } catch (e) {
        // Fallback: ignore invalid URLs
      }
    };

    document.addEventListener('click', handleLinkClick, { capture: true });

    return () => {
      document.removeEventListener('click', handleLinkClick, { capture: true });
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none h-[2.5px] overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="h-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500 transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
          boxShadow: '0 0 12px rgba(6, 182, 212, 0.8), 0 0 6px rgba(139, 92, 246, 0.6)',
        }}
      />
    </div>
  );
}
