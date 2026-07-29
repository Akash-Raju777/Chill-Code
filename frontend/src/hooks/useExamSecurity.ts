import { useEffect, useRef } from 'react';

interface SecurityConfig {
  testId: number;
  onWarning: (type: string, reason: string) => void;
  isSessionActive: boolean;
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
export function useExamSecurity({ testId, onWarning, isSessionActive }: SecurityConfig) {
  const onWarningRef = useRef(onWarning);
  onWarningRef.current = onWarning;

  // Tracks text copied from within this editor session
  const internalClipboardRef = useRef<string>('');

  useEffect(() => {
    if (!isSessionActive) return;

    // ─── 1. Keyboard Shortcuts Blocker ────────────────────────────────────
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const keyLower = e.key.toLowerCase();

      // Print (Ctrl+P) and Save (Ctrl+S) — not exam-relevant
      if (isCtrl && ['p', 's'].includes(keyLower)) {
        e.preventDefault();
        onWarningRef.current('KEYBOARD_SHORTCUT', `Attempted print or save page shortcuts (Ctrl+${e.key.toUpperCase()})`);
        return;
      }

      // Developer tools (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U)
      const isDevToolsKeys =
        e.key === 'F12' ||
        (isCtrl && e.shiftKey && ['i', 'j', 'c'].includes(keyLower)) ||
        (isCtrl && keyLower === 'u');

      if (isDevToolsKeys) {
        e.preventDefault();
        onWarningRef.current('DEV_TOOLS_OPEN', 'Attempted to open browser developer tools or view source');
        return;
      }
    };

    // ─── 2. Right-Click Context Menu blocker ──────────────────────────────
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      onWarningRef.current('RIGHT_CLICK', 'Attempted to right-click inside the examination window');
    };

    // ─── 3. Tab Switching — ONLY via Visibility API ───────────────────────
    // This is the CORRECT way: visibilitychange fires only when the user
    // actually navigates away from the tab (not DevTools, not blur events).
    const handleVisibilityChange = () => {
      if (document.hidden) {
        onWarningRef.current('TAB_SWITCH', 'Switched browser tab or minimized window');
      }
    };

    // ─── 4. Smart Clipboard: Track internal copies, block external pastes ─
    const getCopiedText = (): string => {
      let text = window.getSelection()?.toString() || '';
      if (!text && document.activeElement?.tagName === 'TEXTAREA') {
        const ta = document.activeElement as HTMLTextAreaElement;
        text = ta.value.substring(ta.selectionStart, ta.selectionEnd) || ta.value;
      }
      return text;
    };

    const handleCopy = (e: ClipboardEvent) => {
      const text = getCopiedText();
      if (text) {
        internalClipboardRef.current = text;
      }
    };

    const handleCut = (e: ClipboardEvent) => {
      const text = getCopiedText();
      if (text) {
        internalClipboardRef.current = text;
      }
    };

    const handlePaste = async (e: ClipboardEvent) => {
      const clipboardText = e.clipboardData?.getData('text') ?? '';

      if (clipboardText && clipboardText.trim().length > 0) {
        // Normalize whitespace for comparison to avoid minor formatting mismatches
        const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
        
        if (normalize(clipboardText) === normalize(internalClipboardRef.current)) {
          return; // Internal paste — allow naturally
        }
        
        // Block external paste
        e.preventDefault();
        e.stopPropagation();
        onWarningRef.current('EXTERNAL_PASTE', 'Attempted to paste content from outside the assessment editor');
      }
    };

    // ─── 5. Drag & Drop blocker ───────────────────────────────────────────
    const handleDragDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onWarningRef.current('DRAG_DROP', 'Drag and drop actions are disabled during the secure exam');
    };

    // ─── 6. Fullscreen Exit Tracker ───────────────────────────────────────
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        onWarningRef.current('FULLSCREEN_EXIT', 'Exited secure full-screen assessment view');
      }
    };

    // ─── 7. Viewport Resize / Split Screen Tracker ────────────────────────
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      const currentHeight = window.innerHeight;

      if (currentWidth < lastWidth - 100 || currentHeight < lastHeight - 100) {
        onWarningRef.current(
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

    // NOTE: copy & cut are captured globally but NOT prevented — we just record them
    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('cut', handleCut, true);
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
      document.removeEventListener('copy', handleCopy, true);
      document.removeEventListener('cut', handleCut, true);
      document.removeEventListener('paste', handlePaste, true);
      document.removeEventListener('dragstart', handleDragDrop, true);
      document.removeEventListener('drop', handleDragDrop, true);
      document.removeEventListener('fullscreenchange', handleFullscreenChange, true);
      window.removeEventListener('resize', handleResize, true);
    };
  }, [testId, isSessionActive]);
}
