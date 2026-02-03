export type AutosaveType = 'fast' | 'slow';
export type AutosaveUrgency = 'debounced' | 'immediate';

export interface AutosaveRequest {
  type: AutosaveType;
  urgency: AutosaveUrgency;
  reason?: string;
}

type AutosaveListener = (request: AutosaveRequest) => void;

const listeners = new Set<AutosaveListener>();

export function requestAutosave(request: AutosaveRequest): void {
  for (const listener of listeners) {
    listener(request);
  }
}

export function subscribeAutosave(listener: AutosaveListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
