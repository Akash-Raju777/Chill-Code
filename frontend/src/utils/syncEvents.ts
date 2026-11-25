/**
 * Centralized cross-page sync bus.
 *
 * A tiny pub/sub used so that a confirmed mutation on one page can update
 * other mounted pages (or warm them for next mount) WITHOUT refetching
 * everything or reloading the page. Pairs with smartCache tag invalidation:
 * cache marks related entries stale, sync events let live pages react instantly.
 */

export type SyncEventName =
  | 'submission:confirmed'     // question/test submission confirmed by backend
  | 'test:submitted'           // whole test submitted
  | 'test:exited'
  | 'result:updated'
  | 'badge:awarded'
  | 'achievement:updated'
  | 'leaderboard:invalidated'
  | 'questions:updated'
  | 'tests:updated'
  | 'dashboard:invalidated'
  | 'notifications:updated'
  | 'admin:tests-changed'
  | 'admin:students-changed'
  | 'admin:staff-changed';

export interface SyncPayload {
  questionId?: number;
  testId?: number;
  studentTestId?: number;
  submissionId?: number;
  status?: string;
  overallResult?: string;
  attemptCount?: number;
  [key: string]: unknown;
}

type Handler = (payload?: SyncPayload) => void;

const handlers = new Map<SyncEventName, Set<Handler>>();

export function onSyncEvent(name: SyncEventName, handler: Handler): () => void {
  let set = handlers.get(name);
  if (!set) {
    set = new Set();
    handlers.set(name, set);
  }
  set.add(handler);
  return () => {
    set?.delete(handler);
    if (set?.size === 0) handlers.delete(name);
  };
}

export function emitSyncEvent(name: SyncEventName, payload?: SyncPayload): void {
  const set = handlers.get(name);
  if (!set) return;
  set.forEach((h) => {
    try {
      h(payload);
    } catch (_) {
      /* handler errors must never break the caller */
    }
  });
}

/**
 * Map a successful mutation endpoint to the sync events it should emit.
 * Called by apiCall after a confirmed non-GET response.
 */
export function notifySync(endpoint: string, method: string, data: any): void {
  const ep = endpoint.toLowerCase();

  if (ep.includes('/student/question/') && ep.endsWith('/submit')) {
    emitSyncEvent('submission:confirmed', {
      questionId: data?.questionId,
      submissionId: data?.submissionId,
      status: data?.status,
      overallResult: data?.overallResult,
      attemptCount: data?.attemptCount,
    });
    emitSyncEvent('questions:updated', { questionId: data?.questionId });
    emitSyncEvent('result:updated', { submissionId: data?.submissionId });
    emitSyncEvent('dashboard:invalidated');
    return;
  }

  if (ep.includes('/student/tests/') && (ep.includes('/submit') || ep.includes('/exit'))) {
    emitSyncEvent('test:submitted', {
      testId: data?.id,
      submissionId: data?.submissionId,
      status: data?.status,
    });
    if (ep.includes('/exit')) emitSyncEvent('test:exited', { testId: data?.id });
    emitSyncEvent('tests:updated', { testId: data?.id });
    emitSyncEvent('questions:updated');
    emitSyncEvent('result:updated');
    emitSyncEvent('dashboard:invalidated');
    return;
  }

  if (ep.includes('/badges') || ep.includes('/badge-sets')) {
    emitSyncEvent('badge:awarded');
    emitSyncEvent('achievement:updated');
    emitSyncEvent('dashboard:invalidated');
    return;
  }

  if (ep.includes('/leaderboard') || ep.includes('/rank')) {
    emitSyncEvent('leaderboard:invalidated');
    return;
  }

  if (ep.includes('/admin/tests') || ep.includes('/admin/questions') || ep.includes('/admin/subjects')) {
    emitSyncEvent('admin:tests-changed');
    emitSyncEvent('tests:updated');
    return;
  }

  if (ep.includes('/admin/students') || ep.includes('/reattempt') || ep.includes('/approve')) {
    emitSyncEvent('admin:students-changed');
    emitSyncEvent('tests:updated');
    emitSyncEvent('questions:updated');
    return;
  }

  if (ep.includes('/super-admin/staff') || ep.includes('/work-assignments') || ep.includes('/permissions')) {
    emitSyncEvent('admin:staff-changed');
    return;
  }

  if (ep.includes('/notifications')) {
    emitSyncEvent('notifications:updated');
    return;
  }

  if (ep.includes('/dashboard')) {
    emitSyncEvent('dashboard:invalidated');
    return;
  }
}
