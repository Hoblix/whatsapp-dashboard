import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  status?: string;
  mediaUrl?: string;
  mediaType?: string;
}

export interface Conversation {
  id: string;
  contactPhone: string;
  contactName?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  status?: string;
  assignedTo?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationStats {
  total: number;
  open: number;
  resolved: number;
  unread: number;
}

export interface Backup {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  status: string;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${path} -> ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export function useListConversations(params?: { status?: string; search?: string; limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.search) qs.set("search", params.search);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString() ? `?${qs}` : "";
  return useQuery<Conversation[]>({ queryKey: ["conversations", params], queryFn: () => apiFetch(`/api/conversations${query}`) });
}

export function useGetConversation(id: string) {
  return useQuery<Conversation>({ queryKey: ["conversation", id], queryFn: () => apiFetch(`/api/conversations/${id}`), enabled: !!id });
}

export function useGetHistory(conversationId: string) {
  return useQuery<Message[]>({ queryKey: ["history", conversationId], queryFn: () => apiFetch(`/api/conversations/${conversationId}/messages`), enabled: !!conversationId });
}

export function useGetStats() {
  return useQuery<ConversationStats>({ queryKey: ["stats"], queryFn: () => apiFetch("/api/stats") });
}

export function useListBackups() {
  return useQuery<Backup[]>({ queryKey: ["backups"], queryFn: () => apiFetch("/api/backups") });
}

export function useCreateBackup() {
  const qc = useQueryClient();
  return useMutation<Backup, Error>({ mutationFn: () => apiFetch("/api/backups", { method: "POST" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["backups"] }) });
}
