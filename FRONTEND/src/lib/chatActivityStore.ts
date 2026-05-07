export interface ChatProcessingState {
  busySessionId: string | null;
  targetUserMessageId: string | null;
  statusText: string;
  updatedAt: number;
}

const STORAGE_KEY = 'rag_ai_chat_processing_state_v1';
const PROCESSING_STATE_TTL_MS = 5 * 60 * 1000;
export const CHAT_PROCESSING_EVENT = 'chat_processing_state_updated';
export const CHAT_MESSAGES_UPDATED_EVENT = 'chat_messages_updated';
export const CHAT_ASSISTANT_RESPONSE_READY_EVENT = 'chat_assistant_response_ready';

export interface ChatMessagesUpdatedDetail {
  sessionId: string;
  updatedAt: number;
}

export interface ChatAssistantResponseReadyDetail {
  sessionId: string;
  messageId: string | null;
  updatedAt: number;
}

const DEFAULT_STATE: ChatProcessingState = {
  busySessionId: null,
  targetUserMessageId: null,
  statusText: '',
  updatedAt: 0,
};

function canUseBrowserApis() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function normalizeState(input?: Partial<ChatProcessingState>): ChatProcessingState {
  return {
    busySessionId: input?.busySessionId || null,
    targetUserMessageId: input?.targetUserMessageId || null,
    statusText: typeof input?.statusText === 'string' ? input.statusText : '',
    updatedAt: input?.updatedAt || Date.now(),
  };
}

function isExpiredProcessingState(state: ChatProcessingState) {
  return !!state.busySessionId
    && state.updatedAt > 0
    && Date.now() - state.updatedAt > PROCESSING_STATE_TTL_MS;
}

export function readChatProcessingState(): ChatProcessingState {
  if (!canUseBrowserApis()) return { ...DEFAULT_STATE };

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<ChatProcessingState>;
    const state = normalizeState(parsed);
    if (isExpiredProcessingState(state)) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return { ...DEFAULT_STATE };
    }
    return state;
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
  const current = readChatProcessingState();
  const next = normalizeState({
    ...current,
    ...input,
    updatedAt: input.updatedAt || Date.now(),
  });

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
    targetUserMessageId: null,
    statusText: '',
    updatedAt: Date.now(),
  });
}

export function clearChatProcessingStateForSession(sessionId: string | null | undefined) {
  const current = readChatProcessingState();
  if (!sessionId || current.busySessionId !== sessionId) return current;
  return clearChatProcessingState();
}

export function emitChatMessagesUpdated(sessionId: string) {
  if (!canUseBrowserApis() || !sessionId) return;

  window.dispatchEvent(
    new CustomEvent<ChatMessagesUpdatedDetail>(CHAT_MESSAGES_UPDATED_EVENT, {
      detail: {
        sessionId,
        updatedAt: Date.now(),
      },
    }),
  );
}

export function emitChatAssistantResponseReady(sessionId: string, messageId?: string | null) {
  if (!canUseBrowserApis() || !sessionId) return;

  window.dispatchEvent(
    new CustomEvent<ChatAssistantResponseReadyDetail>(CHAT_ASSISTANT_RESPONSE_READY_EVENT, {
      detail: {
        sessionId,
        messageId: messageId || null,
        updatedAt: Date.now(),
      },
    }),
  );
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

export function subscribeChatMessagesUpdated(
  listener: (detail: ChatMessagesUpdatedDetail) => void,
): () => void {
  if (!canUseBrowserApis()) {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<ChatMessagesUpdatedDetail>;
    const sessionId = customEvent.detail?.sessionId;
    if (!sessionId) return;
    listener({
      sessionId,
      updatedAt: customEvent.detail.updatedAt || Date.now(),
    });
  };

  window.addEventListener(CHAT_MESSAGES_UPDATED_EVENT, handler as EventListener);

  return () => {
    window.removeEventListener(CHAT_MESSAGES_UPDATED_EVENT, handler as EventListener);
  };
}

export function subscribeChatAssistantResponseReady(
  listener: (detail: ChatAssistantResponseReadyDetail) => void,
): () => void {
  if (!canUseBrowserApis()) {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<ChatAssistantResponseReadyDetail>;
    const sessionId = customEvent.detail?.sessionId;
    if (!sessionId) return;
    listener({
      sessionId,
      messageId: customEvent.detail.messageId || null,
      updatedAt: customEvent.detail.updatedAt || Date.now(),
    });
  };

  window.addEventListener(CHAT_ASSISTANT_RESPONSE_READY_EVENT, handler as EventListener);

  return () => {
    window.removeEventListener(CHAT_ASSISTANT_RESPONSE_READY_EVENT, handler as EventListener);
  };
}
