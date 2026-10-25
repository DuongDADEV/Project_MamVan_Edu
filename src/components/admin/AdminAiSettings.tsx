import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase/client.ts';

/**
 * Cấu hình Mầm AI cho admin (đợt 25/10 — kiến trúc key-admin).
 * Giáo viên không nhập key nữa: key nằm trong biến môi trường Vercel
 * (GEMINI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY). Màn này chỉ
 * quản lý model từng nấc, thứ tự chuỗi failover và bật/tắt từng nấc,
 * lưu vào bảng ai_settings qua /api/admin/ai-settings (JWT admin).
 * Nút kiểm tra lưu trước rồi mới test, vì /api/admin/ai-test đọc
 * cấu hình ĐÃ LƯU trong DB (không đọc form chưa lưu).
 */
const LEGS = [
  { id: 'gemini', label: 'Gemini (Google)' },
  { id: 'groq', label: 'Groq' },
  { id: 'openrouter', label: 'OpenRouter' },
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
        }),
      });
      if (!res.ok) throw new Error(`Lưu thất bại (HTTP ${res.status}).`);
      setNotice('Đã lưu cấu hình AI.');
      return true;
    } catch (e: any) {
      setError(e.message || 'Lưu cấu hình thất bại.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [settings]);

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
          Giáo viên không nhập key nữa. Key của 3 nấc nằm trong biến môi trường Vercel
          (GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY) — màn này chỉ đổi model,
          thứ tự chuỗi failover và bật/tắt từng nấc. Để trống ô model = giữ nguyên giá
          trị đã lưu (không reset về mặc định). Nút kiểm tra sẽ lưu trước rồi mới test
          theo cấu hình đã lưu.
        </p>
      </div>

      <div className="space-y-3">
        {settings.order.map((leg, idx) => (
          <div
            key={leg}
            className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-2xl bg-[#FAF5EB] border border-[#E6DCC8]"
          >
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
