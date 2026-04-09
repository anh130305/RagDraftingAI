const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const DEFAULT_TIMEOUT = 15000; // 15 seconds

/**  Generic fetch wrapper with auth token injection, timeout and error handling. */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only set Content-Type for non-FormData bodies
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(id);

    if (!res.ok) {
      if (res.status === 500) {
        throw new Error('Máy chủ gặp lỗi hệ thống. Vui lòng thử lại sau.');
      }

      const errorBody = await res.json().catch(() => ({ detail: res.statusText }));

      // Parse Pydantic 422 validation errors into readable messages
      let message = '';
      if (res.status === 422 && Array.isArray(errorBody.detail)) {
        const fieldLabels: Record<string, string> = {
          username: 'Tên đăng nhập',
          password: 'Mật khẩu',
          department: 'Phòng ban',
          content: 'Nội dung',
          title: 'Tiêu đề',
        };
        message = errorBody.detail
          .map((err: any) => {
            const field = err.loc?.[err.loc.length - 1];
            const label = fieldLabels[field] || field;
            const type = err.type || '';
            if (type === 'string_pattern_mismatch')
              return `${label} chỉ được chứa chữ cái, số, dấu gạch dưới và gạch ngang`;
            if (type === 'string_too_short')
              return `${label} phải có ít nhất ${err.ctx?.min_length || ''} ký tự`;
            if (type === 'string_too_long')
              return `${label} không được vượt quá ${err.ctx?.max_length || ''} ký tự`;
            if (type === 'missing')
              return `${label} là bắt buộc`;
            if (type === 'value_error')
              return err.msg.replace('Value error, ', '');
            return err.msg || `${label} không hợp lệ`;
          })
          .join('. ');
      } else {
        message = errorBody.detail || `HTTP ${res.status}`;
      }

      const error: any = new Error(message);
      error.status = res.status;
      error.body = errorBody;
      throw error;
    }

    // 204 No Content
    if (res.status === 204) return undefined as T;
    return res.json();
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      throw new Error('Kết nối quá hạn. Vui lòng kiểm tra mạng của bạn.');
    }
    if (err.message === 'Failed to fetch') {
      throw new Error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng.');
    }
    throw err;
  }
}

/* ─── Auth ──────────────────────────────────────────────── */

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string | null;
  google_id: string | null;
  role: 'admin' | 'user' | 'moderator';
  department: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function login(username: string, password: string) {
  return request<TokenResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function register(
  username: string,
  password: string,
  department?: string,
) {
  return request<UserResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, department }),
  });
}

export function googleLogin(id_token: string, department?: string) {
  return request<TokenResponse & { needs_onboarding: boolean }>(
    '/api/v1/auth/google-login',
    {
      method: 'POST',
      body: JSON.stringify({ id_token, department }),
    },
  );
}

export function getMe() {
  return request<UserResponse>('/api/v1/users/me');
}

export function updateMe(data: { department?: string }) {
  return request<UserResponse>('/api/v1/users/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/* ─── Chat ──────────────────────────────────────────────── */

export interface ChatSession {
  id: string;
  user_id: string;
  title: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  token_count: number | null;
  created_at: string;
}

export function createSession(title?: string) {
  return request<ChatSession>('/api/v1/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export function listSessions(includeArchived = false) {
  const params = new URLSearchParams();
  if (includeArchived) params.set('include_archived', 'true');
  return request<ChatSession[]>(`/api/v1/chat/sessions?${params}`);
}

export function getSession(id: string) {
  return request<ChatSession & { messages: ChatMessage[] }>(
    `/api/v1/chat/sessions/${id}`,
  );
}

export function deleteSession(id: string) {
  return request<void>(`/api/v1/chat/sessions/${id}`, { method: 'DELETE' });
}

export function sendMessage(sessionId: string, content: string) {
  return request<ChatMessage>(
    `/api/v1/chat/sessions/${sessionId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ content }),
    },
  );
}

export function getMessages(sessionId: string) {
  return request<ChatMessage[]>(
    `/api/v1/chat/sessions/${sessionId}/messages`,
  );
}

/* ─── Documents ─────────────────────────────────────────── */

export interface DocumentResponse {
  id: string;
  title: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  uploaded_by: string | null;
  chunk_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export function uploadDocument(file: File, title?: string) {
  const formData = new FormData();
  formData.append('file', file);
  if (title) formData.append('title', title);
  return request<DocumentResponse>('/api/v1/documents/upload', {
    method: 'POST',
    body: formData,
  });
}

export function listDocuments(skip = 0, limit = 50) {
  return request<{ items: DocumentResponse[]; total: number }>(
    `/api/v1/documents?skip=${skip}&limit=${limit}`,
  );
}

export function deleteDocument(id: string) {
  return request<void>(`/api/v1/documents/${id}`, { method: 'DELETE' });
}
