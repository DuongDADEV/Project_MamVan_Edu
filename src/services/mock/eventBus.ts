/**
 * Event bus & Multi-tab sync cho hệ thống Mầm Văn.
 * Sử dụng BroadcastChannel + fallback storage event để đồng bộ tức thì
 * giữa hai tab. Hỗ trợ sourceId để tránh vòng lặp phản xạ lại chính nguồn phát.
 */

export type Listener = (payload?: any, sourceId?: string) => void;

interface ListenerEntry {
  callback: Listener;
  subscriberId?: string;
}

class SyncEventBus {
  private channel: BroadcastChannel | null = null;
  private listeners: Map<string, Set<ListenerEntry>> = new Map();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('mam_van_sync_channel');
        this.channel.onmessage = (event) => {
          const { entity, payload, sourceId } = event.data || {};
          if (entity) {
            // Sự kiện từ tab khác được gắn sourceId truyền sang
            this.dispatchLocal(entity, payload, sourceId);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel not available, falling back to local events:', e);
      }
    }

    if (typeof window !== 'undefined') {
      // Ánh xạ khóa localStorage -> entity tương ứng để dispatch đúng thực thể.
      // Trước đây mọi lần ghi đều phát entity '*' khiến các tab khác nạp lại
      // TOÀN BỘ dữ liệu hai lần (một qua BroadcastChannel, một qua storage).
      const KEY_TO_ENTITY: Record<string, string> = {
        mam_van_classes: 'class',
        mam_van_students: 'student',
        mam_van_teachers: 'teacher',
        mam_van_topics: 'content',
        mam_van_videos: 'content',
        mam_van_theories: 'content',
        mam_van_quizzes: 'quiz',
        mam_van_questions: 'quiz',
        mam_van_rewards: 'reward',
        mam_van_reward_requests: 'reward',
        mam_van_student_states: 'state',
        mam_van_essay_submissions: 'essay',
        mam_van_auth_session: 'auth',
        mam_van_system_settings: 'settings',
        mam_van_audit_logs: 'audit',
      };
      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith('mam_van_')) {
          // Sự kiện storage của trình duyệt chỉ đến từ tab khác
          const entity = KEY_TO_ENTITY[e.key] || '*';
          this.dispatchLocal(entity, { key: e.key }, 'browser-storage-event');
        }
      });
    }
  }

  /**
   * Phát sự kiện tới các subscriber trong tab hiện tại.
   * Nếu subscriber có subscriberId trùng với sourceId, bỏ qua để tránh phản xạ lại chính mình.
   */
  private dispatchLocal(entity: string, payload?: any, sourceId?: string) {
    // 1. Specific listeners
    const specific = this.listeners.get(entity);
    if (specific) {
      specific.forEach((entry) => {
        if (!entry.subscriberId || entry.subscriberId !== sourceId) {
          try {
            entry.callback(payload, sourceId);
          } catch (err) {
            console.error(`[EventBus] Lỗi khi xử lý listener [${entity}]:`, err);
          }
        }
      });
    }

    // 2. Wildcard listeners
    const wildcards = this.listeners.get('*');
    if (wildcards) {
      wildcards.forEach((entry) => {
        if (!entry.subscriberId || entry.subscriberId !== sourceId) {
          try {
            entry.callback({ entity, payload }, sourceId);
          } catch (err) {
            console.error(`[EventBus] Lỗi khi xử lý wildcard listener:`, err);
          }
        }
      });
    }
  }

  /**
   * Phát sự kiện: truyền tới các listener trong cùng tab (khác sourceId)
   * và broadcast sang các tab khác qua BroadcastChannel.
   */
  public emit(entity: string, payload?: any, sourceId?: string) {
    this.dispatchLocal(entity, payload, sourceId);
    if (this.channel) {
      try {
        this.channel.postMessage({ entity, payload, sourceId });
      } catch (e) {
        console.error('Lỗi khi gửi broadcast message:', e);
      }
    }
  }

  /**
   * Đăng ký lắng nghe sự kiện.
   * @param entity Tên thực thể ('state', 'auth', 'student', 'class', etc.)
   * @param callback Hàm xử lý (payload, sourceId)
   * @param subscriberId Id định danh của người nhận để bỏ qua các event do chính mình phát
   */
  public subscribe(
    entity: string,
    callback: Listener,
    subscriberId?: string
  ): () => void {
    if (!this.listeners.has(entity)) {
      this.listeners.set(entity, new Set());
    }

    const entry: ListenerEntry = { callback, subscriberId };
    this.listeners.get(entity)!.add(entry);

    return () => {
      const set = this.listeners.get(entity);
      if (set) {
        set.delete(entry);
        if (set.size === 0) {
          this.listeners.delete(entity);
        }
      }
    };
  }
}

export const syncEventBus = new SyncEventBus();
