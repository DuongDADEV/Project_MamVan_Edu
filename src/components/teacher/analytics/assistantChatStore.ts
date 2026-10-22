import { useSyncExternalStore } from 'react';
import type {
  AssistantChart,
  AssistantToolRun,
} from '../../../services/ai/analyticsAssistant.ts';

export interface ChatMsg {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  toolRuns?: AssistantToolRun[];
  chart?: AssistantChart;
  followups?: string[];
  isError?: boolean;
}

interface ChatState {
  messages: ChatMsg[];
  busy: boolean;
}

/**
 * Kho hội thoại DÙNG CHUNG của Trợ lý phân tích: tab trong mục Phân tích và
 * bong bóng chat nổi đọc/ghi cùng một lịch sử này nên hai nơi luôn đồng nhất.
 * Lịch sử được lưu bền vào localStorage của trình duyệt (giữ tối đa 80 tin
 * nhắn gần nhất) — tải lại trang hay đóng/mở bong bóng đều không mất.
 */
const STORAGE_KEY = 'mam_van_assistant_chat_v1';
const MAX_STORED = 80;

function loadMessages(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return arr.filter((m) => m && typeof m.text === 'string');
      }
    }
  } catch {
    /* dữ liệu hỏng → bắt đầu trống */
  }
  return [];
}

let state: ChatState = { messages: loadMessages(), busy: false };
let seq = state.messages.reduce((mx, m) => Math.max(mx, m.id || 0), 0) + 1;
const listeners = new Set<() => void>();

function emit(next: ChatState) {
  state = next;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state.messages.slice(-MAX_STORED))
    );
  } catch {
    /* quota đầy hoặc chế độ riêng tư: bỏ qua, hội thoại vẫn chạy trong phiên */
  }
  listeners.forEach((l) => l());
}

export function subscribeAssistantChat(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getAssistantChatState(): ChatState {
  return state;
}

export function useAssistantChat(): ChatState {
  return useSyncExternalStore(
    subscribeAssistantChat,
    getAssistantChatState,
    getAssistantChatState
  );
}

export function appendAssistantMsg(msg: Omit<ChatMsg, 'id'>) {
  emit({ ...state, messages: [...state.messages, { ...msg, id: seq++ }] });
}

export function setAssistantBusy(busy: boolean) {
  if (state.busy !== busy) emit({ ...state, busy });
}

export function clearAssistantChat() {
  emit({ messages: [], busy: false });
}
