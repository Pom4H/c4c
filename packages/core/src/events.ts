export type ProcedureEvent =
  | { type: 'procedure.started'; requestId: string; procedureName: string; timestamp: number }
  | { type: 'procedure.completed'; requestId: string; procedureName: string; timestamp: number; duration: number }
  | { type: 'procedure.failed'; requestId: string; procedureName: string; timestamp: number; duration: number; error: string };

export type ProcedureListener = (event: ProcedureEvent) => void;

const listeners = new Set<ProcedureListener>();
const requestIdToListeners = new Map<string, Set<ProcedureListener>>();

export function subscribeProcedures(listener: ProcedureListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeProcedureRequest(requestId: string, listener: ProcedureListener): () => void {
  let set = requestIdToListeners.get(requestId);
  if (!set) {
    set = new Set();
    requestIdToListeners.set(requestId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) {
      requestIdToListeners.delete(requestId);
    }
  };
}

export function publishProcedureEvent(event: ProcedureEvent): void {
  for (const l of Array.from(listeners)) {
    try { l(event); } catch {}
  }
  const set = requestIdToListeners.get(event.requestId);
  if (set) {
    for (const l of Array.from(set)) {
      try { l(event); } catch {}
    }
  }
}
