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

    // 1. Keyboard Shortcuts Blocker
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const keyLower = e.key.toLowerCase();

      // Copy, Paste, Cut
      if (isCtrl && ['c', 'v', 'x'].includes(keyLower)) {
        e.preventDefault();
        onWarningRef.current('KEYBOARD_SHORTCUT', `Attempted keyboard copy/paste/cut (${e.key.toUpperCase()})`);
        return;
      }

      // Print (Ctrl+P) and Save (Ctrl+S)
      if (isCtrl && ['p', 's'].includes(keyLower)) {
        e.preventDefault();
        onWarningRef.current('KEYBOARD_SHORTCUT', `Attempted print or save page shortcuts (Ctrl+${e.key.toUpperCase()})`);
        return;
      }

      // Developer tools (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U)
      const isDevToolsKeys = e.key === 'F12' || 
        (isCtrl && e.shiftKey && ['i', 'j', 'c'].includes(keyLower)) || 
        (isCtrl && keyLower === 'u');

      if (isDevToolsKeys) {
        e.preventDefault();
        onWarningRef.current('DEV_TOOLS_OPEN', 'Attempted to open browser developer tools or view source');
        return;
      }
    };

    // 2. Right-Click Context Menu blocker
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      onWarningRef.current('RIGHT_CLICK', 'Attempted to right-click inside the examination window');
    };

    // 3. Tab Switching / Minimize Visibility Tracker
    const handleVisibilityChange = () => {
      if (document.hidden) {
        onWarningRef.current('TAB_SWITCH', 'Switched browser tab or minimized window');
      }
    };

    // 4. Lost Focus / Window Blur Tracker
    const handleWindowBlur = () => {
      onWarningRef.current('WINDOW_BLUR', 'Lost focus on the active exam window');
    };

    // 5. Text / Clipboard Actions blocker
    const handleClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
      onWarningRef.current('CLIPBOARD_ACTION', `Clipboard action blocked (${e.type.toUpperCase()})`);
    };

    // 6. Drag & Drop blocker
    const handleDragDrop = (e: DragEvent) => {
      e.preventDefault();
      onWarningRef.current('DRAG_DROP', 'Drag and drop actions are disabled during the secure exam');
    };

    // 7. Fullscreen Exit Tracker
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        onWarningRef.current('FULLSCREEN_EXIT', 'Exited secure full-screen assessment view');
      }
    };

    // 8. Split Screen / Resize Tracker
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      const currentHeight = window.innerHeight;

      if (currentWidth < lastWidth - 100 || currentHeight < lastHeight - 100) {
        onWarningRef.current('VIEWPORT_RESIZE', `Suspicious window resizing or split-screen action detected (${currentWidth}x${currentHeight})`);
      }

      lastWidth = currentWidth;
      lastHeight = currentHeight;
    };

    // Register all event listeners in capture phase
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('visibilitychange', handleVisibilityChange, true);
    window.addEventListener('blur', handleWindowBlur, true);
    document.addEventListener('copy', handleClipboard, true);
    document.addEventListener('cut', handleClipboard, true);
    document.addEventListener('paste', handleClipboard, true);
    document.addEventListener('dragstart', handleDragDrop, true);
    document.addEventListener('drop', handleDragDrop, true);
    document.addEventListener('fullscreenchange', handleFullscreenChange, true);
    window.addEventListener('resize', handleResize, true);

    // Clean up event listeners on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange, true);
      window.removeEventListener('blur', handleWindowBlur, true);
      document.removeEventListener('copy', handleClipboard, true);
      document.removeEventListener('cut', handleClipboard, true);
      document.removeEventListener('paste', handleClipboard, true);
      document.removeEventListener('dragstart', handleDragDrop, true);
      document.removeEventListener('drop', handleDragDrop, true);
      document.removeEventListener('fullscreenchange', handleFullscreenChange, true);
      window.removeEventListener('resize', handleResize, true);
    };
  }, [testId, isSessionActive]);
}
