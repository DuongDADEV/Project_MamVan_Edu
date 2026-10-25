import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase/client.ts';

/**
 * Cấu hình Mầm AI cho admin (đợt 25/10 — kiến trúc key-admin).
 * Giáo viên không nhập key nữa: key nhập ở màn này (lưu vào
 * ai_settings 'ai_keys', chỉ service role đọc được; proxy ưu tiên
 * key trong DB rồi mới fallback biến môi trường Vercel). Màn này
 * quản lý model từng nấc, thứ tự chuỗi failover, bật/tắt từng nấc
 * và key từng nấc, lưu qua /api/admin/ai-settings (JWT admin).
 * Nút kiểm tra lưu trước rồi mới test, vì /api/admin/ai-test đọc
 * cấu hình ĐÃ LƯU trong DB (không đọc form chưa lưu).
 * Biểu đồ token: proxy ghi mỗi lần gọi thành công vào ai_usage
 * (migration 017); Gemini/Groq không có API xem giới hạn còn lại
 * nên chỉ thống kê đã dùng — riêng OpenRouter có API giới hạn key
 * nên hiện được cả phần còn lại.
 */
const LEGS = [
  { id: 'gemini', label: 'Gemini (Google)' },
  { id: 'groq', label: 'Groq' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'workersai', label: 'Workers AI (Cloudflare)' },
] as const;

type LegId = (typeof LEGS)[number]['id'];

interface AiSettingsState {
  models: Record<string, string>;
  order: string[];
  enabled: Record<string, boolean>;
}

interface LegTestResult {
  leg: string;
  model: string;
  configured: boolean;
  ok: boolean;
  status?: number;
  latencyMs?: number;
  message?: string;
}

interface UsageRow {
  leg: string;
  model: string;
  calls: number;
  totalTokens: number;
  lastAt: string | null;
}

const fmtNum = (n: number) => n.toLocaleString('en-US');
const fmtDate = (s: string | null) => {
  if (!s) return '';
  try {
    return new Date(s).toLocaleString('vi-VN');
  } catch {
    return '';
  }
};

const legLabel = (id: string) => LEGS.find((l) => l.id === id)?.label || id;

async function adminToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Chưa có phiên admin.');
  return token;
}

export const AdminAiSettings: React.FC = () => {
  const [settings, setSettings] = useState<AiSettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<LegTestResult[] | null>(null);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [keysConfigured, setKeysConfigured] = useState<Record<string, boolean>>({});
  const [keySource, setKeySource] = useState<Record<string, string | null>>({});
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [openrouter, setOpenrouter] = useState<{ used: number; limit: number | null } | null>(null);
  const [accountId, setAccountId] = useState('');
  const [accountIdSource, setAccountIdSource] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await adminToken();
      const res = await fetch('/api/admin/ai-settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Tải cấu hình thất bại (HTTP ${res.status}).`);
      const data = await res.json();
      const order: string[] = Array.isArray(data.order) ? [...data.order] : [];
      for (const l of LEGS) if (!order.includes(l.id)) order.push(l.id);
      setSettings({
        models: data.models || {},
        order,
        enabled: data.enabled || {},
      });
      setKeysConfigured(data.keysConfigured || {});
      setKeySource(data.keySource || {});
      setUsage(Array.isArray(data.usage) ? data.usage : []);
      setOpenrouter(data.openrouter || null);
      setAccountId(data.workersaiAccountId || '');
      setAccountIdSource(data.workersaiAccountIdSource || null);
    } catch (e: any) {
      setError(e.message || 'Không tải được cấu hình AI.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!settings) return false;
    setSaving(true);
    setNotice(null);
    try {
      const token = await adminToken();
      const res = await fetch('/api/admin/ai-settings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          models: settings.models,
          order: settings.order,
          enabled: settings.enabled,
          // Chỉ gửi key nào admin vừa nhập (trống = giữ nguyên key đã lưu).
          keys: Object.fromEntries(
            LEGS.map((l) => [l.id, (keyInputs[l.id] || '').trim()]).filter(
              ([, v]) => v
            )
          ),
          // Account ID Workers AI: trống = giữ nguyên đã lưu (không phải
          // key nên hiện lại được trong ô nhập).
          ...(accountId.trim() ? { workersaiAccountId: accountId.trim() } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Lưu thất bại (HTTP ${res.status}).`);
      // Key vừa nhập đã lưu vào DB — đánh dấu đã cấu hình, xóa ô nhập.
      const kc = { ...keysConfigured };
      const ks = { ...keySource };
      for (const l of LEGS) {
        if ((keyInputs[l.id] || '').trim()) {
          kc[l.id] = true;
          ks[l.id] = 'db';
        }
      }
      setKeysConfigured(kc);
      setKeySource(ks);
      setKeyInputs({});
      setNotice('Đã lưu cấu hình AI.');
      return true;
    } catch (e: any) {
      setError(e.message || 'Lưu cấu hình thất bại.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [settings, keyInputs, keysConfigured, keySource]);

  const handleTest = async () => {
    setTesting(true);
    setResults(null);
    setError(null);
    try {
      const ok = await save();
      if (!ok) return;
      const token = await adminToken();
      const res = await fetch('/api/admin/ai-test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Kiểm tra thất bại (HTTP ${res.status}).`);
      const data = await res.json();
      setResults(Array.isArray(data.legs) ? data.legs : []);
    } catch (e: any) {
      setError(e.message || 'Kiểm tra thất bại.');
    } finally {
      setTesting(false);
    }
  };

  const move = (leg: string, dir: -1 | 1) => {
    if (!settings) return;
    const order = [...settings.order];
    const i = order.indexOf(leg);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    setSettings({ ...settings, order });
  };

  if (loading) {
    return (
      <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl shadow-xs p-6 text-sm text-[#6B7280]">
        Đang tải cấu hình Mầm AI...
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl shadow-xs p-6 space-y-3">
        <p className="text-sm font-bold text-[#DC2626]">{error || 'Không tải được cấu hình AI.'}</p>
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 rounded-xl bg-[#2F3E6B] text-white text-xs font-bold"
        >
          Tải lại
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#FFFDF8] border border-[#E6DCC8] rounded-3xl shadow-xs p-6 space-y-5">
      <div>
        <h3 className="font-lora font-bold text-base text-[#2F3E6B]">Cấu hình Mầm AI</h3>
        <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
          Giáo viên không nhập key nữa. Nhập key cho từng nấc ngay tại đây
          (lưu vào database, chỉ máy chủ đọc được; nếu chưa nhập ở đây thì
          dùng key trong biến môi trường Vercel). Để trống ô model hoặc ô
          key = giữ nguyên giá trị đã lưu (không reset, không xóa). Nút
          kiểm tra sẽ lưu trước rồi mới test theo cấu hình đã lưu. Nấc Workers AI cần thêm Account ID Cloudflare (ô riêng dưới nấc đó).
        </p>
      </div>

      <div className="space-y-3">
        {settings.order.map((leg, idx) => (
          <div
            key={leg}
            className="p-3 rounded-2xl bg-[#FAF5EB] border border-[#E6DCC8] space-y-2.5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <span className="w-6 h-6 rounded-lg bg-[#2F3E6B] text-white text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="text-sm font-bold text-[#2F3E6B] w-32">{legLabel(leg)}</span>
                <button
                  type="button"
                  onClick={() => move(leg, -1)}
                  disabled={idx === 0}
                  className="px-2 py-1 rounded-lg border border-[#E6DCC8] text-xs font-bold disabled:opacity-40"
                  title="Lên trước"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(leg, 1)}
                  disabled={idx === settings.order.length - 1}
                  className="px-2 py-1 rounded-lg border border-[#E6DCC8] text-xs font-bold disabled:opacity-40"
                  title="Xuống sau"
                >
                  ↓
                </button>
              </div>
              <input
                type="text"
                value={settings.models[leg] || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    models: { ...settings.models, [leg]: e.target.value },
                  })
                }
                placeholder="Tên model"
                className="flex-1 px-3 py-2 rounded-xl border border-[#D1C7B7] bg-white text-xs text-[#2F3E6B] font-mono focus:outline-none focus:border-[#E2704A]"
              />
              <label className="flex items-center gap-1.5 text-xs font-bold text-[#2F3E6B] shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enabled[leg] !== false}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      enabled: { ...settings.enabled, [leg]: e.target.checked },
                    })
                  }
                />
                Bật nấc này
              </label>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <input
                type="password"
                autoComplete="off"
                value={keyInputs[leg] || ''}
                onChange={(e) =>
                  setKeyInputs({ ...keyInputs, [leg]: e.target.value })
                }
                placeholder={
                  keysConfigured[leg]
                    ? '•••••••• đã cấu hình — để trống giữ nguyên'
                    : 'Nhập API key cho nấc này'
                }
                className="flex-1 px-3 py-2 rounded-xl border border-[#D1C7B7] bg-white text-xs text-[#2F3E6B] font-mono focus:outline-none focus:border-[#E2704A]"
              />
              <span className="text-[11px] text-[#6B7280] shrink-0">
                Key:{' '}
                {keysConfigured[leg]
                  ? keySource[leg] === 'db'
                    ? 'đã nhập tại đây'
                    : 'đang dùng key Vercel'
                  : 'chưa có'}
              </span>
            </div>
            {leg === 'workersai' && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <input
                  type="text"
                  autoComplete="off"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="Account ID Cloudflare cho nấc Workers AI"
                  className="flex-1 px-3 py-2 rounded-xl border border-[#D1C7B7] bg-white text-xs text-[#2F3E6B] font-mono focus:outline-none focus:border-[#E2704A]"
                />
                <span className="text-[11px] text-[#6B7280] shrink-0">
                  Account ID:{' '}
                  {accountId
                    ? accountIdSource === 'db'
                      ? 'đã lưu tại đây'
                      : 'đang dùng biến môi trường'
                    : 'chưa có'}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-xs font-bold text-[#DC2626]">{error}</p>}
      {notice && <p className="text-xs font-bold text-emerald-700">{notice}</p>}

      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={save}
          disabled={saving || testing}
          className="px-5 py-2.5 rounded-xl bg-[#2F3E6B] text-white text-xs font-bold disabled:opacity-40"
        >
          {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
        </button>
        <button
          type="button"
          onClick={handleTest}
          disabled={saving || testing}
          className="px-5 py-2.5 rounded-xl bg-[#E2704A] hover:bg-[#D45E36] text-white text-xs font-bold disabled:opacity-40"
        >
          {testing ? 'Đang kiểm tra từng nấc...' : 'Lưu & kiểm tra từng nấc'}
        </button>
      </div>

      <div className="border-t border-[#E6DCC8] pt-4 space-y-3">
        <h4 className="font-lora font-bold text-sm text-[#2F3E6B]">Token đã dùng theo model</h4>
        <p className="text-[11px] text-[#6B7280] leading-relaxed">
          Thống kê từ khi bật ghi log (mỗi lần AI trả lời thành công). Gemini,
          Groq và Workers AI không có API xem giới hạn còn lại nên chỉ hiện
          đã dùng; riêng OpenRouter có API giới hạn key nên hiện được cả
          phần còn lại.
        </p>
        {usage.length === 0 ? (
          <p className="text-xs text-[#6B7280]">
            Chưa có lượt gọi nào được ghi log — dùng trợ lý AI vài câu rồi tải lại trang này.
          </p>
        ) : (
          <div className="space-y-2.5">
            {(() => {
              const max = Math.max(1, ...usage.map((u) => u.totalTokens));
              return usage.map((u) => (
                <div key={`${u.leg}|||${u.model}`}>
                  <div className="flex flex-wrap justify-between gap-2 text-xs">
                    <span className="font-bold text-[#2F3E6B]">
                      {legLabel(u.leg)} · <span className="font-mono font-normal">{u.model}</span>
                    </span>
                    <span className="text-[#6B7280]">
                      {fmtNum(u.totalTokens)} token · {u.calls} lần gọi
                      {u.lastAt ? ` · gần nhất ${fmtDate(u.lastAt)}` : ''}
                    </span>
                  </div>
                  <div className="h-2.5 mt-1 rounded-full bg-[#E6DCC8]/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#2F3E6B]"
                      style={{ width: `${Math.max(2, Math.round((u.totalTokens / max) * 100))}%` }}
                    />
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
        {keysConfigured.openrouter && openrouter && openrouter.limit !== null && (
          <div className="p-3 rounded-2xl bg-[#FAF5EB] border border-[#E6DCC8] space-y-1.5">
            <div className="flex flex-wrap justify-between gap-2 text-xs font-bold text-[#2F3E6B]">
              <span>OpenRouter — giới hạn key</span>
              <span>
                Đã dùng {fmtNum(openrouter.used)} / {fmtNum(openrouter.limit)} · Còn{' '}
                {fmtNum(Math.max(0, openrouter.limit - openrouter.used))}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-[#E6DCC8]/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#E2704A]"
                style={{
                  width: `${Math.min(100, Math.max(2, Math.round((openrouter.used / Math.max(1, openrouter.limit)) * 100)))}%`,
                }}
              />
            </div>
          </div>
        )}
        {keysConfigured.openrouter && openrouter && openrouter.limit === null && (
          <p className="text-[11px] text-[#6B7280]">
            OpenRouter không công bố giới hạn cho key này — đã dùng {fmtNum(openrouter.used)} (đơn vị của OpenRouter).
          </p>
        )}
        {keysConfigured.openrouter && !openrouter && (
          <p className="text-[11px] text-[#6B7280]">
            Không lấy được giới hạn OpenRouter lúc này (thử tải lại trang).
          </p>
        )}
      </div>

      {results && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#FAF5EB]/70 border-b border-[#E6DCC8] text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
                <th className="py-2.5 px-4">Nấc</th>
                <th className="py-2.5 px-4">Model</th>
                <th className="py-2.5 px-4">Key đã cấu hình</th>
                <th className="py-2.5 px-4">Kết quả</th>
                <th className="py-2.5 px-4">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6DCC8]/60">
              {results.map((r) => (
                <tr key={r.leg}>
                  <td className="py-2.5 px-4 font-bold text-[#2F3E6B]">{legLabel(r.leg)}</td>
                  <td className="py-2.5 px-4 font-mono text-xs">{r.model}</td>
                  <td className="py-2.5 px-4 text-xs">{r.configured ? 'Có' : 'Chưa'}</td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        r.ok
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {r.ok ? '✓ OK' : '✗ Lỗi'}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-[#6B7280]">
                    {r.latencyMs !== undefined ? `${r.latencyMs}ms` : ''}
                    {r.status !== undefined ? ` · HTTP ${r.status}` : ''}
                    {r.message ? ` · ${r.message}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
