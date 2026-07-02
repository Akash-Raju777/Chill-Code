import { useEffect, useRef } from 'react';

interface SecurityConfig {
  testId: number;
  onWarning: (type: string, reason: string) => void;
  isSessionActive: boolean;
}

export function useExamSecurity({ testId, onWarning, isSessionActive }: SecurityConfig) {
  const onWarningRef = useRef(onWarning);
  onWarningRef.current = onWarning;

  useEffect(() => {
    if (!isSessionActive) return;

    // 1. Enter Fullscreen automatically
    const enterFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        console.error('Failed to auto enter fullscreen', err);
      }
    };
    enterFullscreen();

    // 2. Block Keyboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+X, Inspect tools F12/Ctrl+Shift+I, View source Ctrl+U)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      
      // Copy, Paste, Cut
      if (isCtrl && ['c', 'v', 'x'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        onWarningRef.current('KEYBOARD_SHORTCUT', `Attempted keyboard copy/paste/cut (${e.key.toUpperCase()})`);
        return;
      }

      // Developer tools
      if (e.key === 'F12' || (isCtrl && e.shiftKey && ['i', 'j'].includes(e.key.toLowerCase())) || (isCtrl && e.key.toLowerCase() === 'u')) {
        e.preventDefault();
        onWarningRef.current('DEV_TOOLS_OPEN', 'Attempted to open browser developer tools');
        return;
      }
    };

    // 3. Block Context Menu (Right Click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      onWarningRef.current('RIGHT_CLICK', 'Attempted to right click inside editor canvas');
    };

    // 5. Track Fullscreen exits
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        onWarningRef.current('FULLSCREEN_EXIT', 'Exited secure full-screen assessment view');
      }
    };

    // Add listeners
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('fullscreenchange', handleFullscreenChange, true);

    // Clean up
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('fullscreenchange', handleFullscreenChange, true);
    };
  }, [testId, isSessionActive]);
}
