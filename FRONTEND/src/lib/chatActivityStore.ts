export interface ChatProcessingState {
  busySessionId: string | null;
  statusText: string;
  updatedAt: number;
}

const STORAGE_KEY = 'rag_ai_chat_processing_state_v1';
export const CHAT_PROCESSING_EVENT = 'chat_processing_state_updated';

const DEFAULT_STATE: ChatProcessingState = {
  busySessionId: null,
  statusText: '',
  updatedAt: 0,
};

function canUseBrowserApis() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function normalizeState(input?: Partial<ChatProcessingState>): ChatProcessingState {
  return {
    busySessionId: input?.busySessionId || null,
    statusText: typeof input?.statusText === 'string' ? input.statusText : '',
    updatedAt: input?.updatedAt || Date.now(),
  };
}

export function readChatProcessingState(): ChatProcessingState {
  if (!canUseBrowserApis()) return { ...DEFAULT_STATE };

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<ChatProcessingState>;
    return normalizeState(parsed);
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function emitChatProcessingState(state: ChatProcessingState) {
  if (!canUseBrowserApis()) return;

  window.dispatchEvent(
    new CustomEvent<ChatProcessingState>(CHAT_PROCESSING_EVENT, {
      detail: state,
    }),
  );
}

export function writeChatProcessingState(input: Partial<ChatProcessingState>): ChatProcessingState {
  const next = normalizeState(input);

  if (!canUseBrowserApis()) return next;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage write failures; in-memory event is still enough for current tab.
  }

  emitChatProcessingState(next);
  return next;
}

export function clearChatProcessingState() {
  return writeChatProcessingState({
    busySessionId: null,
    statusText: '',
    updatedAt: Date.now(),
  });
}

export function subscribeChatProcessingState(
  listener: (state: ChatProcessingState) => void,
): () => void {
  if (!canUseBrowserApis()) {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<ChatProcessingState>;
    listener(normalizeState(customEvent.detail));
  };

  window.addEventListener(CHAT_PROCESSING_EVENT, handler as EventListener);

  return () => {
    window.removeEventListener(CHAT_PROCESSING_EVENT, handler as EventListener);
  };
}
