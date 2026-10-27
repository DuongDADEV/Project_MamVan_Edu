import {
  createPool,
  type Pool,
  type PoolConnection,
} from 'mysql2/promise';

/**
 * GĐ3 — MySQL pool dùng chung cho mọi route API VPS-only.
 * Kết nối lười (lazy): tạo pool lúc import không mở kết nối ngay; lỗi
 * cấu hình chỉ lộ khi query đầu tiên chạy — route phải map lỗi đó
 * thành 500, không lộ chi tiết kết nối ra client.
 *
 * Env (chỉ đọc env, không hardcode secret nào):
 *   MYSQL_HOST (mặc định 127.0.0.1), MYSQL_PORT (mặc định 3306),
 *   MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE (mặc định mamvan).
 * timezone '+00:00': mọi TIMESTAMP trong SQL đều hiểu theo UTC; ngày
 * giờ Việt Nam (VN) được tính ở JS (xem api/_lib/xp.ts), KHÔNG dùng
 * CONVERT_TZ vì MySQL trên VPS có thể thiếu bảng múi giờ.
 */

export const pool: Pool = createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || '',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'mamvan',
  timezone: '+00:00',
  waitForConnections: true,
  connectionLimit: 10,
});

/**
 * Db tối thiểu mà mọi helper GĐ3 nhận: query cho SELECT (trả rows),
 * execute cho INSERT/UPDATE/DELETE (trả result header: insertId /
 * affectedRows). Cả hai đều "unwrap" cặp [rows, fields] của mysql2.
 * Một Db có thể là pool (mỗi câu chạy trên 1 kết nối riêng) hoặc là
 * kết nối của 1 transaction đang mở (xem withTransaction).
 */
export interface Db {
  query: <T = any>(sql: string, params?: any[]) => Promise<T>;
  execute: <T = any>(sql: string, params?: any[]) => Promise<T>;
}

function wrapConnection(conn: PoolConnection): Db {
  return {
    query: async <T = any>(sql: string, params?: any[]): Promise<T> => {
      const [rows] = await conn.query(sql, params);
      return rows as T;
    },
    execute: async <T = any>(sql: string, params?: any[]): Promise<T> => {
      const [result] = await conn.execute(sql, params);
      return result as T;
    },
  };
}

/** Db gắn với pool — dùng cho các câu đọc đơn lẻ, không cần transaction. */
export const db: Db = {
  query: async <T = any>(sql: string, params?: any[]): Promise<T> => {
    const [rows] = await pool.query(sql, params);
    return rows as T;
  },
  execute: async <T = any>(sql: string, params?: any[]): Promise<T> => {
    const [result] = await pool.execute(sql, params);
    return result as T;
  },
};

export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  return db.query<T>(sql, params);
}

export async function execute<T = any>(sql: string, params?: any[]): Promise<T> {
  return db.execute<T>(sql, params);
}

const TX_MARKER = '__mamvanTx';

/** True khi Db này đang chạy trong 1 transaction của withTransaction. */
export function isTxDb(candidate: Db): boolean {
  return !!(candidate as any)[TX_MARKER];
}

/**
 * Chạy fn trong 1 transaction: BEGIN, COMMIT khi xong, ROLLBACK khi lỗi
 * (rồi throw lại lỗi gốc), luôn release kết nối. Db truyền vào fn đã
 * gắn cờ TX_MARKER để các helper (vd xp.ts) biết là KHÔNG tự mở
 * transaction lồng mà chạy thẳng trên kết nối này — nhờ đó route có
 * thể gộp nhiều bước ghi (vd chấm bài + cộng XP) trong cùng 1 transaction.
 */
export async function withTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const tx = wrapConnection(conn);
    (tx as any)[TX_MARKER] = true;
    const result = await fn(tx);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // Rollback lỗi thì lỗi gốc vẫn là thứ cần báo.
    }
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Parse 1 cột JSON từ mysql2: cột JSON có thể về dạng object (mysql2
 * đã parse) hoặc string (cột TEXT / driver chưa parse). Trả fallback
 * khi giá trị null/undefined, sai kiểu, hoặc chuỗi JSON hỏng — không
 * bao giờ throw, để route tự quyết khi dữ liệu hỏng.
 */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') {
    if (Buffer.isBuffer(value)) {
      try {
        return JSON.parse(value.toString('utf8')) as T;
      } catch {
        return fallback;
      }
    }
    return value as T;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/** Chuẩn hóa giá trị ghi vào cột JSON: luôn ghi chuỗi JSON (hoặc NULL). */
export function toJson(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}
