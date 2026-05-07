const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const DEFAULT_TIMEOUT = 60000; // 15 seconds
const ABSOLUTE_HTTP_URL_REGEX = /^https?:\/\//i;

export type DocumentPreviewKind = 'pdf' | 'word' | 'image' | 'other';
const CLOUDINARY_UPLOAD_URL_REGEX = /https:\/\/res\.cloudinary\.com\/[^/]+\/(image|raw|video)\/upload\//i;
const CLOUDINARY_RAW_UPLOAD_URL_REGEX = /https:\/\/res\.cloudinary\.com\/[^/]+\/raw\/upload\//i;

function joinApiUrl(path: string): string {
  const normalizedBase = API_BASE.replace(/\/+$/, '');
  const normalizedPath = path.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedPath}`;
}

/**
 * Resolve a document file_path from backend into a fully qualified URL.
 * Handles legacy relative paths (uploads/*), API-prefixed paths, and full HTTP URLs.
 */
export function resolveDocumentFileUrl(filePath: string): string {
  const rawPath = (filePath || '').trim();
  if (!rawPath) return rawPath;

  if (ABSOLUTE_HTTP_URL_REGEX.test(rawPath)) {
    return rawPath;
  }

  const normalized = rawPath.replace(/\\/g, '/');
  const withoutLeadingSlash = normalized.replace(/^\/+/, '');

  if (withoutLeadingSlash.startsWith('api/v1/')) {
    return joinApiUrl(withoutLeadingSlash);
  }

  if (withoutLeadingSlash.startsWith('uploads/')) {
    return joinApiUrl(`api/v1/${withoutLeadingSlash}`);
  }

  return joinApiUrl(`api/v1/${withoutLeadingSlash}`);
}

function sanitizeCloudinaryFilename(name: string): string {
  if (!name) return 'document';

  // Remove extension if present in name to avoid double extension in flag
  const nameWithoutExt = name.includes('.') ? name.split('.').slice(0, -1).join('.') : name;

  // Simple Vietnamese character normalization
  const signedChars = "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ";
  const unsignedChars = "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyydAAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYYD";
  let unsignedName = nameWithoutExt.split('').map(c => {
    const idx = signedChars.indexOf(c);
    return idx > -1 ? unsignedChars[idx] : c;
  }).join('');

  // Replace spaces and special chars with underscores, keep only alphanumeric and - _
  return unsignedName
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9-_]/g, '')
    .substring(0, 100) || 'document';
}

function applyCloudinaryUploadFlag(url: string, flag: string, value?: string): string {
  if (!url || !CLOUDINARY_UPLOAD_URL_REGEX.test(url)) return url;

  const fullFlag = value ? `${flag}:${value}` : flag;

  // Check if flag already exists in any form (standalone or with value)
  if (url.includes(`/${flag}`) || url.includes(`,${flag}`)) {
    return url;
  }

  return url.replace('/upload/', `/upload/${fullFlag}/`);
}

function ensureCloudinaryExtension(url: string, extension?: string): string {
  if (!url || !CLOUDINARY_UPLOAD_URL_REGEX.test(url)) return url;

  const ext = (extension || '').replace(/^\./, '').trim().toLowerCase();
  if (!ext) return url;

  const [withoutHash, hashPart = ''] = url.split('#');
  const [pathPart, queryPart = ''] = withoutHash.split('?');

  const segments = pathPart.split('/');
  const lastSegment = segments[segments.length - 1] || '';

  try {
    const decodedLastSegment = decodeURIComponent(lastSegment).toLowerCase();
    if (decodedLastSegment.endsWith(`.${ext}`)) return url;
    if (decodedLastSegment.includes('.')) return url;
  } catch (e) {
    if (lastSegment.includes('.')) return url;
  }

  const separator = queryPart ? '?' : '';
  const hashSeparator = hashPart ? '#' : '';

  return `${pathPart}.${ext}${separator}${queryPart}${hashSeparator}${hashPart}`;
}

function inferPreferredExtension(input: {
  kind?: DocumentPreviewKind;
  fileName?: string | null;
  fileType?: string | null;
  filePath?: string | null;
}): string | undefined {
  const fromName = extractExtension(input.fileName);
  if (fromName) return fromName;

  const fileType = (input.fileType || '').toLowerCase();
  if (input.kind === 'pdf' || fileType.includes('pdf')) return 'pdf';
  if (fileType.includes('wordprocessingml')) return 'docx';
  if (fileType.includes('msword')) return 'doc';
  if (fileType.startsWith('image/')) {
    const subtype = fileType.split('/')[1]?.split(';')[0]?.trim().toLowerCase();
    if (subtype) return subtype === 'jpeg' ? 'jpg' : subtype;
  }

  const fromPath = extractExtension(input.filePath);
  if (fromPath) return fromPath;

  return undefined;
}

function normalizeCloudinaryDocumentUrl(url: string, input: {
  kind?: DocumentPreviewKind;
  fileName?: string | null;
  fileType?: string | null;
} = {}): string {
  const extension = inferPreferredExtension({
    ...input,
    filePath: url,
  });
  return ensureCloudinaryExtension(url, extension);
}

export function getDocumentPreviewUrl(
  url: string,
  kind?: DocumentPreviewKind,
  fileName?: string | null,
  fileType?: string | null,
): string {
  const normalized = normalizeCloudinaryDocumentUrl(url, { kind, fileName, fileType });
  return normalized;
}

export function getDocumentDownloadUrl(
  url: string,
  kind?: DocumentPreviewKind,
  fileName?: string | null,
  fileType?: string | null,
): string {
  const normalized = normalizeCloudinaryDocumentUrl(url, { kind, fileName, fileType });
  const downloadName = sanitizeCloudinaryFilename(fileName || 'document');
  const attachmentUrl = applyCloudinaryUploadFlag(normalized, 'fl_attachment', downloadName);

  // Add a cache buster to ensure the browser fetches the fresh version with headers.
  const separator = attachmentUrl.includes('?') ? '&' : '?';
  return `${attachmentUrl}${separator}t=${Date.now()}`;
}

function stripQueryHash(value: string): string {
  return value.split('#')[0].split('?')[0];
}

function extractExtension(value?: string | null): string {
  if (!value) return '';
  const cleaned = stripQueryHash(value).trim();
  if (!cleaned) return '';

  const normalized = cleaned.replace(/\\/g, '/');
  const segment = normalized.split('/').pop() || normalized;
  const decoded = (() => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  })();

  const lastDot = decoded.lastIndexOf('.');
  if (lastDot === -1 || lastDot === decoded.length - 1) return '';
  return decoded.slice(lastDot + 1).toLowerCase();
}

export function inferDocumentPreviewKind(input: {
  fileName?: string | null;
  fileType?: string | null;
  filePath?: string | null;
}): DocumentPreviewKind {
  const fileType = (input.fileType || '').toLowerCase();

  if (fileType.includes('pdf')) return 'pdf';
  if (
    fileType.includes('msword') ||
    fileType.includes('wordprocessingml') ||
    fileType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml')
  ) {
    return 'word';
  }
  if (fileType.startsWith('image/')) return 'image';

  const ext = extractExtension(input.fileName) || extractExtension(input.filePath);
  if (ext === 'pdf') return 'pdf';
  if (ext === 'doc' || ext === 'docx') return 'word';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';

  return 'other';
}

/**  Generic fetch wrapper with auth token injection, timeout and error handling. */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT,
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
  const id = setTimeout(() => controller.abort(), timeoutMs);

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
      } else if (res.status === 429) {
        message = 'Bạn đã thao tác quá nhiều, vui lòng thử lại sau.';
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

export interface CloudinaryUploadSignatureResponse {
  cloud_name: string;
  api_key: string;
  upload_url: string;
  signature: string;
  timestamp: number;
  folder: string;
  public_id: string;
  resource_type: 'raw' | 'image' | 'video';
  type: 'upload';
  access_mode: 'public';
}

export interface CloudinaryUploadCompleteResponse {
  document: DocumentResponse;
  extracted_text: string | null;
  ocr_error: string | null;
}

async function requestCloudinaryUploadSignature(file: File, chatSessionId?: string) {
  return request<CloudinaryUploadSignatureResponse>('/api/v1/documents/upload/presign', {
    method: 'POST',
    body: JSON.stringify({
      file_name: file.name,
      content_type: file.type,
      chat_session_id: chatSessionId || 'general',
    }),
  });
}

async function uploadFileDirectlyToCloudinary(file: File, signature: CloudinaryUploadSignatureResponse) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signature.api_key);
  formData.append('timestamp', String(signature.timestamp));
  formData.append('signature', signature.signature);
  formData.append('folder', signature.folder);
  formData.append('public_id', signature.public_id);
  formData.append('type', signature.type);
  formData.append('access_mode', signature.access_mode);

  const response = await fetch(signature.upload_url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message = errorBody?.error?.message || errorBody?.message || response.statusText || 'Cloudinary upload failed';
    throw new Error(message);
  }

  return response.json();
}

async function finalizeCloudinaryUpload(
  uploadResult: any,
  file: File,
  title?: string,
  chatSessionId?: string,
) {
  const completeResponse = await request<CloudinaryUploadCompleteResponse>('/api/v1/documents/upload/complete', {
    method: 'POST',
    body: JSON.stringify({
      title,
      file_path: uploadResult.secure_url || uploadResult.url,
      file_type: file.type,
      file_size: uploadResult.bytes,
      cloudinary_public_id: uploadResult.public_id,
      chat_session_id: chatSessionId || 'general',
      resource_type: uploadResult.resource_type,
    }),
  });

  return completeResponse.document;
}

export async function uploadDocument(file: File, title?: string, chatSessionId?: string) {
  const signature = await requestCloudinaryUploadSignature(file, chatSessionId);
  console.debug('uploadDocument: presign signature', { file: file.name, chatSessionId, signature });
  const uploadResult = await uploadFileDirectlyToCloudinary(file, signature);
  console.debug('uploadDocument: cloudinary result', { file: file.name, uploadResult });
  const doc = await finalizeCloudinaryUpload(uploadResult, file, title, chatSessionId);
  console.debug('uploadDocument: finalize returned', { file: file.name, doc });
  return doc;
}

export async function uploadAdminKnowledgeBaseDocument(file: File, title?: string) {
  const formData = new FormData();
  formData.append('file', file);
  if (title) {
    formData.append('title', title);
  }

  return request<DocumentResponse>('/api/v1/admin/knowledge-base/upload', {
    method: 'POST',
    body: formData,
  });
}

export function logout() {
  return request<void>('/api/v1/auth/logout', { method: 'POST' });
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

/* ─── Admin Users ───────────────────────────────────────── */

export function getAdminUsers(skip = 0, limit = 100) {
  return request<UserResponse[]>(`/api/v1/admin/users?skip=${skip}&limit=${limit}`);
}

export function updateAdminUser(id: string, data: { role?: string; is_active?: boolean }) {
  return request<UserResponse>(`/api/v1/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/* ─── Admin Audit Logs ────────────────────────────────────── */

export interface AuditLogResponse {
  id: string;
  user_id: string | null;
  user_name?: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  detail: any;
  created_at: string;
}

export interface AuditLogListResponse {
  items: AuditLogResponse[];
  total: number;
}

export function getAuditLogs(params: Record<string, any> = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.append(key, String(value));
    }
  }
  const str = qs.toString();
  const url = str ? `/api/v1/admin/audit-logs?${str}` : '/api/v1/admin/audit-logs';
  return request<AuditLogListResponse>(url);
}

/* ─── Admin Prompt Templates ─────────────────────────────── */

export interface PromptTemplateResponse {
  id: string;
  name: string;
  description: string | null;
  query: string;
  extra_instructions: string | null;
  mode: 'qa' | 'generate';
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromptTemplateCreate {
  name: string;
  description?: string;
  content: string;
  mode: 'qa' | 'generate';
}

export interface PromptTemplateUpdate {
  name?: string;
  description?: string;
  content?: string;
  mode?: 'qa' | 'generate';
  is_active?: boolean;
}

export interface PromptTemplateListResponse {
  items: PromptTemplateResponse[];
  total: number;
}

export function getPromptTemplates() {
  return request<PromptTemplateListResponse>('/api/v1/admin/prompt-templates');
}

export function createPromptTemplate(data: PromptTemplateCreate) {
  return request<PromptTemplateResponse>('/api/v1/admin/prompt-templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updatePromptTemplate(id: string, data: PromptTemplateUpdate) {
  return request<PromptTemplateResponse>(`/api/v1/admin/prompt-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deletePromptTemplate(id: string) {
  return request<void>(`/api/v1/admin/prompt-templates/${id}`, { method: 'DELETE' });
}


export function recordPromptTemplateUse(id: string) {
  return request<void>(`/api/v1/chat/prompt-templates/${id}/use`, { method: 'POST' });
}


/* ─── Drafting / RAG ────────────────────────────────────── */

export interface DraftRequest {
  query: string;
  extras?: string;
  session_id?: string;
}

export interface DraftMeta {
  query: string;
  extras: string | null;
  elapsed_s: number;
  form_id: string;
  form_type: string;
  legal_sources: string[];
  context_stats: Record<string, number>;
}

export interface DraftResponse {
  status: string;
  mode: 'draft' | 'legal_qa';
  fields: Record<string, string>;
  meta: DraftMeta;
  document?: DocumentResponse | null;
}

export function generateDraftDocx(data: DraftRequest) {
  return request<DraftResponse>('/api/v1/drafting/generate-docx', {
    method: 'POST',
    body: JSON.stringify(data),
  }, 360000);
}

/* ─── Chat ──────────────────────────────────────────────── */

export function getUserPromptTemplates() {
  return request<PromptTemplateListResponse>('/api/v1/chat/prompt-templates');
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string | null;
  is_archived: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  mode?: string;
  feedback?: 'like' | 'dislike' | null;
  token_count: number | null;
  created_at: string;
}

export type ChatStreamEvent =
  | { type: 'user_message'; message: ChatMessage }
  | { type: 'meta'; meta: Record<string, unknown> }
  | { type: 'token'; delta: string }
  | { type: 'assistant_message'; message: ChatMessage }
  | { type: 'done'; meta?: Record<string, unknown> }
  | { type: 'error'; error: string; meta?: Record<string, unknown> };

export function createSession(title?: string) {
  return request<ChatSession>('/api/v1/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export function listSessions(includeArchived = false) {
  const params = new URLSearchParams();
  if (includeArchived) params.set('include_archived', 'true');
  const query = params.toString();
  return request<ChatSession[]>(
    query ? `/api/v1/chat/sessions?${query}` : '/api/v1/chat/sessions',
    { cache: 'no-store' },
  );
}

export function getSession(id: string) {
  return request<ChatSession & { messages: ChatMessage[] }>(
    `/api/v1/chat/sessions/${id}`,
  );
}

export function updateSession(id: string, data: { title?: string; is_archived?: boolean; is_pinned?: boolean }) {
  return request<ChatSession>(`/api/v1/chat/sessions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteSession(id: string) {
  return request<void>(`/api/v1/chat/sessions/${id}`, { method: 'DELETE' });
}

export function sendMessage(sessionId: string, content: string, mode: 'qa' | 'generate' = 'qa', extras?: string) {
  const timeoutMs = mode === 'qa' ? 180000 : 360000;
  return request<ChatMessage>(
    `/api/v1/chat/sessions/${sessionId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ content, mode, extras }),
    },
    timeoutMs
  );
}

export async function* streamMessage(
  sessionId: string,
  content: string,
  mode: 'qa' | 'generate' = 'qa',
  extras?: string,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/v1/chat/sessions/${sessionId}/messages/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content, mode, extras }),
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
    const message = errorBody.detail || `HTTP ${response.status}`;
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error('Máy chủ không trả về luồng dữ liệu.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const raw = line.trim();
      if (!raw) continue;

      try {
        const event = JSON.parse(raw) as ChatStreamEvent;
        yield event;
      } catch {
        // Ignore malformed streaming lines.
      }
    }
  }

  const tail = buffer.trim();
  if (tail) {
    try {
      const event = JSON.parse(tail) as ChatStreamEvent;
      yield event;
    } catch {
      // Ignore malformed trailing line.
    }
  }
}

export function getMessages(sessionId: string) {
  return request<ChatMessage[]>(
    `/api/v1/chat/sessions/${sessionId}/messages`,
    { cache: 'no-store' },
  );
}

export function submitMessageFeedback(messageId: string, feedback: 'like' | 'dislike' | null) {
  return request<ChatMessage>(`/api/v1/chat/messages/${messageId}/feedback`, {
    method: 'PUT',
    body: JSON.stringify({ feedback }),
  });
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
  session_id?: string | null;
  chunk_count: number;
  rag_ingested: boolean;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export function extractTextFromImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request<{ text: string }>('/api/v1/documents/extract-text', {
    method: 'POST',
    body: formData,
  });
}

export function listDocuments(skip = 0, limit = 50, sessionId?: string) {
  const params = new URLSearchParams({
    skip: String(skip),
    limit: String(limit),
  });

  if (sessionId) {
    params.set('session_id', sessionId);
  }

  return request<{ items: DocumentResponse[]; total: number }>(
    `/api/v1/documents?${params.toString()}`,
  );
}

export function deleteDocument(id: string) {
  return request<void>(`/api/v1/documents/${id}`, { method: 'DELETE' });
}

/* ─── Admin System Stats & Management ─────────────────────── */

export function getAdminKnowledgeBase(skip = 0, limit = 50) {
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
  return request<{ items: DocumentResponse[]; total: number }>(`/api/v1/admin/knowledge-base?${params}`);
}

export function deleteAdminKnowledgeBase(id: string) {
  return request<void>(`/api/v1/admin/knowledge-base/${id}`, { method: 'DELETE' });
}

export interface GpuInfo {
  index: number;
  name: string;
  vram_used_mb: number;
  vram_total_mb: number;
  vram_free_mb: number;
  vram_percent: number;
  gpu_util_percent: number;
  memory_util_percent: number;
  temperature_c: number | null;
  power_w: number | null;
  power_limit_w: number | null;
}

export interface SystemInfo {
  cpu_percent: number;
  ram_used_mb: number;
  ram_total_mb: number;
  ram_percent: number;
  disk_used_gb: number;
  disk_total_gb: number;
  disk_percent: number;
}

export interface VramHistoryPoint {
  time: string;
  value: number;
}

export interface SystemStatsResponse {
  is_mock: boolean;
  gpu_count: number;
  gpus: GpuInfo[];
  system: SystemInfo;
  storage?: {
    status: 'healthy' | 'error';
    provider: string;
    error_message: string | null;
  };
  vram_history: VramHistoryPoint[];
  collected_at: string;
}

export function getSystemStats() {
  return request<SystemStatsResponse>('/api/v1/admin/system-stats');
}

export interface DashboardStatsResponse {
  feedback: {
    total_responses: number;
    likes: number;
    dislikes: number;
    no_feedback: number;
    like_rate: number;
    dislike_rate: number;
  };
  users: {
    total: number;
    active: number;
    inactive: number;
    new_this_month: number;
  };
}

export function getDashboardStats() {
  return request<DashboardStatsResponse>('/api/v1/admin/dashboard-stats');
}

/* ─── Admin AI Monitoring ────────────────────────────────── */

export interface AIMonitoringTrend {
  name: string;
  queries: number;
  errors: number;
  avgLatency: number;
}

export interface AIMonitoringResponse {
  summary: {
    total_queries: number;
    success_rate: number;
    error_rate: number;
    avg_latency_ms: number;
    user_satisfaction: number;
    interaction_stats: {
      likes: number;
      dislikes: number;
      total_feedback: number;
    };
    mode_distribution: Record<string, number>;
    top_forms: Array<{ name: string; value: number }>;
  };
  trends: AIMonitoringTrend[];
  collected_at: string;
}

export function getAIMonitoringStats(days: number = 7) {
  return request<AIMonitoringResponse>(`/api/v1/admin/ai-monitoring?days=${days}`);
}

/* ─── Admin RAG ChromaDB Management ──────────────────────── */

export interface RAGStatusResponse {
  [collection: string]: number;
}

export interface RAGCheckResponse {
  exists: boolean;
  chunk_count: number;
  article_count: number;
  articles: string[];
  so_hieu: string;
}

export interface RAGIngestRequest {
  ocr_text: string;
  ministry?: string;
  manual_so_hieu?: string;
  manual_loai_vb?: string;
  manual_ten_van_ban?: string;
  force_if_exists?: boolean;
  only_new_chunks?: boolean;
}

export interface RAGIngestResponse {
  status: 'ok' | 'error' | 'skipped';
  header: {
    so_hieu: string;
    ten_van_ban: string;
    co_quan: string;
    loai_vb: string;
  };
  doc_already_exists: boolean;
  articles_found: number;
  chunks_created: number;
  abolished_found: Array<{ so_hieu: string; count: number; snippet: string }>;
  delete_results: Array<{ so_hieu: string; deleted_count: number }>;
  upsert_result: {
    upserted: number;
    skipped: number;
    errors: string[];
  };
  errors: string[];
  bm25_rebuild?: string;
}

export interface RAGDeleteDocRequest {
  so_hieu: string;
  dry_run?: boolean;
  collection_key?: string;
}

export interface RAGDeleteDocResponse {
  so_hieu: string;
  found_ids: string[];
  deleted_count: number;
  dry_run: boolean;
  protected: boolean;
  bm25_rebuild?: string;
}

export interface RAGDeleteArticleRequest {
  so_hieu: string;
  article_query: string;
  dry_run?: boolean;
  collection_key?: string;
}

export interface RAGDeleteArticleResponse {
  found_ids: string[];
  deleted_count: number;
  dry_run: boolean;
  bm25_rebuild?: string;
}

export function getRAGStatus() {
  return request<RAGStatusResponse>('/api/v1/admin/rag/status');
}

export function checkRAGDoc(so_hieu: string, collection_key: string = 'legal') {
  return request<RAGCheckResponse>('/api/v1/admin/rag/check', {
    method: 'POST',
    body: JSON.stringify({ so_hieu, collection_key }),
  });
}

export function ingestRAGDoc(data: RAGIngestRequest) {
  return request<RAGIngestResponse>('/api/v1/admin/rag/ingest', {
    method: 'POST',
    body: JSON.stringify(data),
  }, 300000); // 5 min timeout for heavy documents
}

export function deleteRAGDoc(data: RAGDeleteDocRequest) {
  return request<RAGDeleteDocResponse>('/api/v1/admin/rag/delete-doc', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteRAGArticle(data: RAGDeleteArticleRequest) {
  return request<RAGDeleteArticleResponse>('/api/v1/admin/rag/delete-article', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function rebuildBM25() {
  return request<{ status: string; message: string }>('/api/v1/admin/rag/rebuild-bm25', {
    method: 'POST',
  });
}

export interface OCRExtractResponse {
  text: string;
  filename: string;
  chars: number;
  method: string;
}

export function adminExtractText(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request<OCRExtractResponse>('/api/v1/admin/rag/extract-text', {
    method: 'POST',
    body: formData,
  }, 120000); // 2 min timeout for large scanned PDFs
}

// Ingest a document from Cloudinary into ChromaDB (OCR → chunk → embed)
export function ingestDocToRAG(documentId: string) {
  return request<RAGIngestResponse>(`/api/v1/admin/rag/ingest-doc/${documentId}`, {
    method: 'POST',
  }, 300000); // 5 min timeout for heavy OCR
}

// Remove document from ChromaDB only (keep in Cloudinary)
export function uningestDocFromRAG(documentId: string) {
  return request<{ status: string; deleted_count: number }>(`/api/v1/admin/rag/uningest-doc/${documentId}`, {
    method: 'POST',
  });
}

// Hard delete: remove from ChromaDB + Cloudinary + PostgreSQL
export function hardDeleteDoc(documentId: string) {
  return request<{ status: string; errors: string[] }>(`/api/v1/admin/rag/hard-delete-doc/${documentId}`, {
    method: 'DELETE',
  });
}
