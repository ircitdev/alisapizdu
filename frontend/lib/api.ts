export interface InviteResponse {
  code: string;
  url: string;
  preset_name: string;
  allow_rename: boolean;
}

export interface InviteInfo {
  code: string;
  preset_name: string;
  allow_rename: boolean;
  used: boolean;
  created_by_user_id: number | null;
}

export interface Message {
  id: number;
  type: 'free' | 'paid' | 'invite';
  sender_name: string | null;
  user_message: string;
  alice_response: string;
  alice_image: string | null;
  has_image: number;
  amount: number | null;
  created_at: string;
  user_id: number | null;
  device: string | null;
  os: string | null;
  city: string | null;
  country: string | null;
  reply_to: number | null;
  votes_up: number;
  votes_down: number;
}

export interface MessagesResponse {
  messages: Message[];
  next_cursor: number | null;
  has_more: boolean;
}

export interface StatsResponse {
  total_messages: number;
  online_count: number;
  vip_count: number;
}

export interface AskResponse {
  id: number;
  status: 'streaming';
}

export interface PaymentResponse {
  payment_url: string;
  payment_id: string;
}

const API_BASE = '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text().catch(() => 'Unknown error');
    throw new Error(`API error ${res.status}: ${error}`);
  }

  return res.json();
}

export async function fetchMessages(
  cursor?: number | null,
  limit: number = 20
): Promise<MessagesResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor != null) {
    params.set('cursor', String(cursor));
  }
  return apiFetch<MessagesResponse>(`/messages?${params}`);
}

export async function fetchStats(): Promise<StatsResponse> {
  return apiFetch<StatsResponse>('/stats');
}

export async function askAlice(): Promise<AskResponse> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  return apiFetch<AskResponse>('/ask', {
    method: 'POST',
    body: JSON.stringify({ timezone }),
  });
}

export async function askCustom(
  message: string,
  senderName?: string
): Promise<AskResponse> {
  return apiFetch<AskResponse>('/ask-custom', {
    method: 'POST',
    body: JSON.stringify({
      message,
      sender_name: senderName || null,
    }),
  });
}

export async function createPayment(message: string): Promise<PaymentResponse> {
  return apiFetch<PaymentResponse>('/payment/create', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export function getSSEUrl(): string {
  return `${API_BASE}/messages/stream`;
}

export async function voteMessage(
  messageId: number,
  vote: 1 | -1
): Promise<{ ok: boolean; up: number; down: number }> {
  return apiFetch(`/vote/${messageId}`, {
    method: 'POST',
    body: JSON.stringify({ vote }),
  });
}

export async function updateName(
  messageId: number,
  senderName: string
): Promise<{ ok: boolean }> {
  return apiFetch(`/name/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ sender_name: senderName }),
  });
}

export function getMessageShareUrl(messageId: number): string {
  return `${window.location.origin}/#msg-${messageId}`;
}

export async function createInvite(
  presetName: string,
  allowRename: boolean,
  notifyEmail?: string,
  userId?: number | null
): Promise<InviteResponse> {
  return apiFetch<InviteResponse>('/invite', {
    method: 'POST',
    body: JSON.stringify({
      preset_name: presetName,
      allow_rename: allowRename,
      notify_email: notifyEmail || undefined,
      user_id: userId || undefined,
    }),
  });
}

export async function getInvite(code: string): Promise<InviteInfo> {
  return apiFetch<InviteInfo>(`/invite/${code}`);
}

export async function useInvite(
  code: string,
  name?: string,
  timezone?: string
): Promise<AskResponse> {
  return apiFetch<AskResponse>(`/invite/${code}/use`, {
    method: 'POST',
    body: JSON.stringify({ name, timezone }),
  });
}
