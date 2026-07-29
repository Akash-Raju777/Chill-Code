import { useEffect, useRef } from 'react';

interface SecurityConfig {
  testId: number;
  onWarning: (type: string, reason: string) => void;
  isSessionActive: boolean;
  internalClipboardRef?: React.MutableRefObject<string>;
}

/**
 * Secure exam monitoring hook.
 *
 * Tab Detection: Uses ONLY the Visibility API (document.visibilitychange).
 * This fires when the user *actually* switches tabs or minimises the window,
 * but NOT when opening DevTools, clicking inside the page, scrolling, or
 * moving the mouse.
 *
 * Copy/Paste Protection:
 * - Tracks text copied from within the editor session in internalClipboardRef.
 * - Allows internal copy/paste freely (code the student wrote).
 * - Blocks paste of content that was NOT copied inside this session (external).
 * - Shows a warning on external paste attempt.
 *
 * Fullscreen Enforcement:
 * - Detects fullscreen exit via fullscreenchange API.
 * - Raises FULLSCREEN_EXIT warning which triggers the overlay in the parent.
 */
export function useExamSecurity({ testId, onWarning, isSessionActive, internalClipboardRef }: SecurityConfig) {
  const onWarningRef = useRef(onWarning);
  onWarningRef.current = onWarning;

  // Fallback track text copied from within this editor session if parent doesn't provide it
  const fallbackClipboardRef = useRef<string>('');
  const activeClipboardRef = internalClipboardRef || fallbackClipboardRef;

  useEffect(() => {
    if (!isSessionActive) return;

    let lastWarningTime = 0;
    const triggerWarning = (type: string, reason: string) => {
      const now = Date.now();
      if (now - lastWarningTime < 3000) {
        console.log('Debounced duplicate/rapid warning in useExamSecurity:', type, reason);
        return;
      }
      lastWarningTime = now;
      onWarningRef.current(type, reason);
    };

    // ─── 1. Keyboard Shortcuts Blocker ────────────────────────────────────
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const keyLower = e.key.toLowerCase();

      // Print (Ctrl+P) and Save (Ctrl+S) — not exam-relevant
      if (isCtrl && ['p', 's'].includes(keyLower)) {
        e.preventDefault();
        triggerWarning('KEYBOARD_SHORTCUT', `Attempted print or save page shortcuts (Ctrl+${e.key.toUpperCase()})`);
        return;
      }

      // Developer tools (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U)
      const isDevToolsKeys =
        e.key === 'F12' ||
        (isCtrl && e.shiftKey && ['i', 'j', 'c'].includes(keyLower)) ||
        (isCtrl && keyLower === 'u');

      if (isDevToolsKeys) {
        e.preventDefault();
        triggerWarning('DEV_TOOLS_OPEN', 'Attempted to open browser developer tools or view source');
        return;
      }
    };

    // ─── 2. Right-Click Context Menu blocker ──────────────────────────────
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerWarning('RIGHT_CLICK', 'Attempted to right-click inside the examination window');
    };

    // ─── 3. Tab Switching & Focus Loss — Visibility & Blur API ──────────────
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerWarning('TAB_SWITCH', 'Switched browser tab or minimized window');
      }
    };

    const handleBlur = () => {
      // Blur fires instantly on Alt+Tab or clicking outside the window.
      // Only fire if student was inside fullscreen (to avoid duplicate triggers on exit overlay)
      if (document.fullscreenElement && !document.hidden) {
        triggerWarning('WINDOW_BLUR', 'Switched to another application or lost window focus (Alt+Tab)');
      }
    };

    // ─── 4. Smart Clipboard: block external pastes ────────────────────────
    // We rely on the parent component (e.g. Monaco Editor) to populate activeClipboardRef on copy/cut.
    const handlePaste = async (e: ClipboardEvent) => {
      const clipboardText = e.clipboardData?.getData('text') ?? '';

      if (clipboardText && clipboardText.trim().length > 0) {
        // Normalize whitespace for comparison to avoid minor formatting mismatches
        const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
        
        if (normalize(clipboardText) === normalize(activeClipboardRef.current)) {
          return; // Internal paste — allow naturally
        }
        
        // Block external paste
        e.preventDefault();
        e.stopPropagation();
        triggerWarning('EXTERNAL_PASTE', 'Attempted to paste content from outside the assessment editor');
      }
    };

    // ─── 5. Drag & Drop blocker ───────────────────────────────────────────
    const handleDragDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      triggerWarning('DRAG_DROP', 'Drag and drop actions are disabled during the secure exam');
    };

    // ─── 6. Fullscreen Exit Tracker ───────────────────────────────────────
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        triggerWarning('FULLSCREEN_EXIT', 'Exited secure full-screen assessment view');
      }
    };

    // ─── 7. Viewport Resize / Split Screen Tracker ────────────────────────
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;
    const handleResize = () => {
      // Only check resize if currently in fullscreen (exiting fullscreen changes size, which is covered by FULLSCREEN_EXIT)
      if (!document.fullscreenElement) return;

      const currentWidth = window.innerWidth;
      const currentHeight = window.innerHeight;

      if (currentWidth < lastWidth - 100 || currentHeight < lastHeight - 100) {
        triggerWarning(
          'VIEWPORT_RESIZE',
          `Suspicious window resizing or split-screen action detected (${currentWidth}x${currentHeight})`
        );
      }

      lastWidth = currentWidth;
      lastHeight = currentHeight;
    };

    // ─── Register all listeners ───────────────────────────────────────────
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('visibilitychange', handleVisibilityChange, true);
    window.addEventListener('blur', handleBlur, true);

    // Paste IS intercepted to block external content
    document.addEventListener('paste', handlePaste, true);

    document.addEventListener('dragstart', handleDragDrop, true);
    document.addEventListener('drop', handleDragDrop, true);
    document.addEventListener('fullscreenchange', handleFullscreenChange, true);
    window.addEventListener('resize', handleResize, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange, true);
      window.removeEventListener('blur', handleBlur, true);
      document.removeEventListener('paste', handlePaste, true);
      document.removeEventListener('dragstart', handleDragDrop, true);
      document.removeEventListener('drop', handleDragDrop, true);
      document.removeEventListener('fullscreenchange', handleFullscreenChange, true);
      window.removeEventListener('resize', handleResize, true);
    };
  }, [testId, isSessionActive]);
}
