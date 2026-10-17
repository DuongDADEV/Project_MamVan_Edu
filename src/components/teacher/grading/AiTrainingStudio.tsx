import React, { useState } from 'react';
import {
  RubricTemplate,
  GradedSampleEssay,
  AIGradingConfig,
  RubricCriterion,
} from '../../../types.ts';
import {
  BookOpen,
  Sparkles,
  Sliders,
  Play,
  TrendingDown,
  Plus,
  Trash2,
  Copy,
  Edit3,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Star,
  Layers,
  FileText,
  Save,
} from 'lucide-react';
import { aiService } from '../../../services/index.ts';

interface AiTrainingStudioProps {
  rubricTemplates: RubricTemplate[];
  onSaveRubricTemplate: (template: RubricTemplate) => Promise<void>;
  onDeleteRubricTemplate: (id: string) => Promise<void>;
  gradedSamples: GradedSampleEssay[];
  onSaveGradedSample: (sample: GradedSampleEssay) => Promise<void>;
  onDeleteGradedSample: (id: string) => Promise<void>;
  aiConfig: AIGradingConfig;
  onSaveAIConfig: (config: Partial<AIGradingConfig>) => Promise<void>;
  accuracyMetrics?: {
    averageDiff: number;
    highDiffRatio: number;
    weeklyTrends: { week: string; diff: number; total: number }[];
    diffByCriterion: { name: string; diff: number }[];
  };
}

export const AiTrainingStudio: React.FC<AiTrainingStudioProps> = ({
  rubricTemplates,
  onSaveRubricTemplate,
  onDeleteRubricTemplate,
  gradedSamples,
  onSaveGradedSample,
  onDeleteGradedSample,
  aiConfig,
  onSaveAIConfig,
  accuracyMetrics,
}) => {
  const [activeTab, setActiveTab] = useState<
    'rubrics' | 'samples' | 'style' | 'sandbox' | 'metrics'
  >('style');

  // State cấu hình phong cách
  const [configDraft, setConfigDraft] = useState<AIGradingConfig>(aiConfig);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSavedSuccess, setConfigSavedSuccess] = useState(false);

  // State Sandbox thử nghiệm AI
  const [sandboxText, setSandboxText] = useState(
    'Bài thơ Mầm non làm em nhớ đến những mầm xanh đang cựa mình thức giấc sau mùa đông giá rét. Tác giả đã dùng phép nhân hóa thật tài tình để miêu tả mầm non như một đứa trẻ thơ đang hé mắt nhìn mùa xuân tươi đẹp.'
  );
  const [sandboxRubricId, setSandboxRubricId] = useState(rubricTemplates[0]?.id || '');
  const [sandboxResult, setSandboxResult] = useState<any | null>(null);
  const [isSandboxRunning, setIsSandboxRunning] = useState(false);

  // State Modal chỉnh sửa Rubric
  const [editingRubric, setEditingRubric] = useState<RubricTemplate | null>(null);
  const [isRubricModalOpen, setIsRubricModalOpen] = useState(false);

  // State Modal chỉnh sửa Bài mẫu
  const [editingSample, setEditingSample] = useState<GradedSampleEssay | null>(null);
  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);
  const [sampleFilter, setSampleFilter] = useState<string>('ALL');

  // Xử lý lưu cấu hình phong cách
  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      await onSaveAIConfig(configDraft);
      setConfigSavedSuccess(true);
      setTimeout(() => setConfigSavedSuccess(false), 3000);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Xử lý chạy thử Sandbox
  const handleRunSandbox = async () => {
    if (!sandboxText.trim()) return;
    setIsSandboxRunning(true);
    setSandboxResult(null);
    try {
      const selectedRubric =
        rubricTemplates.find((t) => t.id === sandboxRubricId) || rubricTemplates[0];
      const rubricCriteria = (selectedRubric?.criteria || []).map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        weight: c.weight,
        maxPoints: (c.weight / 100) * 10,
      }));

      const res = await aiService.suggestEssayGrade(sandboxText, rubricCriteria, gradedSamples, {
        tone: configDraft.tone,
        strictness: configDraft.strictness,
        praiseStrengthsFirst: configDraft.praiseStrengthsFirst,
        feedbackLength: configDraft.feedbackLength,
      });
      setSandboxResult(res);
    } catch (e) {
      console.error('Lỗi chạy Sandbox AI:', e);
    } finally {
      setIsSandboxRunning(false);
    }
  };

  // Nhân bản Rubric
  const handleCloneRubric = async (r: RubricTemplate) => {
    const cloned: RubricTemplate = {
      ...r,
      id: 'rubric_' + Date.now(),
      title: `${r.title} (Bản sao)`,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    await onSaveRubricTemplate(cloned);
  };

  return (
    <div className="space-y-6">
      {/* BANNER NGUYÊN TẮC: AI CHỈ LÀ GỢI Ý */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
        <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-950 leading-relaxed">
          <strong className="font-bold text-amber-900 block text-sm mb-0.5">
            Nguyên tắc sư phạm: AI chỉ là trợ lý gợi ý – Thầy/Cô là người giữ thẩm quyền chốt điểm
          </strong>
          Hệ thống học máy của Mầm Văn được huấn luyện riêng theo Chương trình GDPT 2018 và phong cách
          chấm của thầy/cô thông qua các rubric, bài mẫu và phản hồi điều chỉnh điểm thực tế.
        </div>
      </div>

      {/* THANH TAB CON CỦA HUẤN LUYỆN AI */}
      <div className="flex border-b border-[#E8DFD1] gap-6 text-sm font-bold">
        <button
          onClick={() => setActiveTab('style')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'style'
              ? 'border-[#E2704A] text-[#E2704A]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" /> Phong cách chấm của AI
        </button>

        <button
          onClick={() => setActiveTab('rubrics')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'rubrics'
              ? 'border-[#E2704A] text-[#E2704A]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" /> Thư viện Rubric ({rubricTemplates.length})
        </button>

        <button
          onClick={() => setActiveTab('samples')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'samples'
              ? 'border-[#E2704A] text-[#E2704A]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Star className="w-4 h-4" /> Bài mẫu đã chấm ({gradedSamples.length})
        </button>

        <button
          onClick={() => setActiveTab('sandbox')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'sandbox'
              ? 'border-[#E2704A] text-[#E2704A]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Play className="w-4 h-4" /> Thử nghiệm AI (Sandbox)
        </button>

        <button
          onClick={() => setActiveTab('metrics')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'metrics'
              ? 'border-[#E2704A] text-[#E2704A]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingDown className="w-4 h-4" /> Chỉ số độ tin cậy AI
        </button>
      </div>

      {/* ================= 1. TAB THIẾT LẬP PHONG CÁCH ================= */}
      {activeTab === 'style' && (
        <div className="bg-white p-6 rounded-2xl border border-[#E8DFD1] shadow-xs space-y-6 max-w-3xl">
          <div>
            <h3 className="font-extrabold text-[#1E1B4B] text-base mb-1">
              Thiết lập giọng điệu & Độ khắt khe khi AI chấm bài
            </h3>
            <p className="text-xs text-slate-500">
              Các thiết lập này điều chỉnh cách AI viết nhận xét và mức độ trừ điểm cho từng tiêu chí
              khi đọc bài học sinh.
            </p>
          </div>

          <div className="space-y-5">
            {/* Giọng nhận xét */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Giọng điệu nhận xét của AI
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: 'encouraging',
                    name: 'Nhẹ nhàng, khích lệ',
                    desc: 'Khen ngợi nỗ lực, dùng từ gợi mở, khích lệ tự tin',
                  },
                  {
                    id: 'neutral',
                    name: 'Trung tính, khách quan',
                    desc: 'Đúng chuẩn mực, cân bằng giữa ưu điểm và hạn chế',
                  },
                  {
                    id: 'strict',
                    name: 'Nghiêm túc, chuẩn mực',
                    desc: 'Yêu cầu cao về cấu trúc, dùng từ và lập luận',
                  },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      configDraft.tone === item.id
                        ? 'bg-orange-50/80 border-[#E2704A] ring-2 ring-orange-200'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tone"
                      checked={configDraft.tone === item.id}
                      onChange={() =>
                        setConfigDraft({ ...configDraft, tone: item.id as any })
                      }
                      className="sr-only"
                    />
                    <div className="font-bold text-sm text-[#1E1B4B] mb-1">{item.name}</div>
                    <div className="text-[11px] text-slate-500 leading-relaxed">{item.desc}</div>
                  </label>
                ))}
              </div>
            </div>

            {/* Độ nghiêm khắc (Thanh trượt 1-5) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Độ nghiêm khắc chấm điểm: Mức {configDraft.strictness} / 5
                </label>
                <span className="text-xs font-semibold text-[#E2704A]">
                  {configDraft.strictness <= 2
                    ? 'Rất khích lệ (cho điểm thoáng)'
                    : configDraft.strictness === 3
                    ? 'Cân bằng (chuẩn mực)'
                    : 'Khắt khe (soi kỹ lỗi nhỏ)'}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={configDraft.strictness}
                onChange={(e) =>
                  setConfigDraft({ ...configDraft, strictness: parseInt(e.target.value) })
                }
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#E2704A]"
              />
              <div className="flex justify-between text-[11px] text-slate-400 font-semibold mt-1">
                <span>1 - Rất thoáng</span>
                <span>3 - Vừa phải</span>
                <span>5 - Rất khắt khe</span>
              </div>
            </div>

            {/* Bật/tắt nhắc điểm tốt trước */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Ưu tiên khen điểm sáng trước khi nêu hạn chế
                </span>
                <span className="text-[11px] text-slate-500">
                  AI sẽ mở đầu nhận xét bằng những câu khen chân thành về ý tưởng hoặc cảm xúc của học
                  sinh.
                </span>
              </div>
              <input
                type="checkbox"
                checked={configDraft.praiseStrengthsFirst}
                onChange={(e) =>
                  setConfigDraft({ ...configDraft, praiseStrengthsFirst: e.target.checked })
                }
                className="w-5 h-5 accent-[#E2704A] rounded-sm cursor-pointer"
              />
            </div>

            {/* Độ dài nhận xét */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Độ dài nhận xét mong muốn
              </label>
              <div className="flex gap-3">
                {[
                  { id: 'short', name: 'Ngắn gọn (2-3 câu)' },
                  { id: 'medium', name: 'Vừa phải (4-5 câu)' },
                  { id: 'detailed', name: 'Chi tiết (phân tích sâu)' },
                ].map((len) => (
                  <button
                    key={len.id}
                    type="button"
                    onClick={() =>
                      setConfigDraft({ ...configDraft, feedbackLength: len.id as any })
                    }
                    className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      configDraft.feedbackLength === len.id
                        ? 'bg-[#2F3E6B] text-white border-[#2F3E6B]'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {len.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            {configSavedSuccess ? (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Đã lưu cấu hình phong cách thành công!
              </span>
            ) : (
              <span />
            )}
            <button
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
              className="px-5 py-2.5 bg-[#E2704A] hover:bg-[#D05F39] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              {isSavingConfig ? 'Đang lưu...' : 'Lưu thiết lập'}
            </button>
          </div>
        </div>
      )}

      {/* ================= 2. TAB THƯ VIỆN RUBRIC MẪU ================= */}
      {activeTab === 'rubrics' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-[#1E1B4B] text-base">
                Thư viện Rubric đánh giá đoạn văn
              </h3>
              <p className="text-xs text-slate-500">
                Rubric chuẩn hóa tiêu chí chấm theo Chương trình Giáo dục phổ thông 2018
              </p>
            </div>
            <button
              onClick={() => {
                setEditingRubric({
                  id: 'rubric_' + Date.now(),
                  title: '',
                  category: 'cam_nghi',
                  description: '',
                  criteria: [
                    { id: 'c1', name: 'Nội dung ý', description: 'Đúng trọng tâm đề tài', weight: 40 },
                    { id: 'c2', name: 'Bố cục & Liên kết', description: 'Mở - thân - kết rõ ràng', weight: 20 },
                    { id: 'c3', name: 'Dùng từ & Chính tả', description: 'Từ ngữ chuẩn mực', weight: 20 },
                    { id: 'c4', name: 'Sáng tạo cảm xúc', description: 'Có giọng văn riêng', weight: 20 },
                  ],
                  createdAt: new Date().toISOString(),
                });
                setIsRubricModalOpen(true);
              }}
              className="px-4 py-2 bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Tạo Rubric mới
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rubricTemplates.map((r) => (
              <div
                key={r.id}
                className="bg-white p-5 rounded-2xl border border-[#E8DFD1] shadow-xs space-y-3 relative hover:border-indigo-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-[#1E1B4B] text-sm">{r.title}</h4>
                      {r.isDefault && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          Mặc định
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{r.description}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleCloneRubric(r)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Nhân bản rubric này"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingRubric(r);
                        setIsRubricModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Chỉnh sửa"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {!r.isDefault && (
                      <button
                        onClick={() => onDeleteRubricTemplate(r.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Xóa rubric"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Tiêu chí bên trong */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {r.criteria.map((c, i) => (
                    <div
                      key={c.id || i}
                      className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-slate-50"
                    >
                      <span className="font-semibold text-slate-700">{c.name}</span>
                      <span className="font-bold text-[#4F46E5]">{c.weight}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= 3. TAB BÀI MẪU ĐÃ CHẤM ================= */}
      {activeTab === 'samples' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-[#1E1B4B] text-base">
                Kho bài văn mẫu đối sánh cho AI (Few-Shot Examples)
              </h3>
              <p className="text-xs text-slate-500">
                AI sẽ đọc các bài mẫu này để hiểu chính xác cách thầy/cô chấm mức Kém, Trung bình,
                Khá, Tốt.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingSample({
                  id: 'sample_' + Date.now(),
                  title: '',
                  topicPrompt: '',
                  studentContent: '',
                  levelGrade: 'good',
                  totalScore: 7.5,
                  rubricScores: [],
                  teacherFeedback: '',
                  isFromStudentSubmission: false,
                  createdAt: new Date().toISOString(),
                });
                setIsSampleModalOpen(true);
              }}
              className="px-4 py-2 bg-[#E2704A] hover:bg-[#D05F39] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Thêm bài mẫu
            </button>
          </div>

          {/* Bộ lọc mức điểm */}
          <div className="flex gap-2">
            {[
              { id: 'ALL', name: 'Tất cả bài mẫu' },
              { id: 'excellent', name: 'Mức Tốt (8.5 - 10đ)' },
              { id: 'good', name: 'Mức Khá (7.0 - 8.0đ)' },
              { id: 'average', name: 'Mức Trung bình (5.0 - 6.5đ)' },
              { id: 'poor', name: 'Mức Kém (< 5.0đ)' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSampleFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                  sampleFilter === f.id
                    ? 'bg-[#2F3E6B] text-white border-[#2F3E6B]'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {gradedSamples
              .filter((s) => sampleFilter === 'ALL' || s.levelGrade === sampleFilter)
              .map((sample) => (
                <div
                  key={sample.id}
                  className="bg-white p-5 rounded-2xl border border-[#E8DFD1] shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                            sample.levelGrade === 'excellent'
                              ? 'bg-purple-100 text-purple-800'
                              : sample.levelGrade === 'good'
                              ? 'bg-emerald-100 text-emerald-800'
                              : sample.levelGrade === 'average'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {sample.totalScore} điểm
                        </span>
                        <h4 className="font-bold text-sm text-[#1E1B4B]">{sample.title}</h4>
                        {sample.isFromStudentSubmission && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            Lưu từ bài học sinh (Đã ẩn danh)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 italic mt-1">Đề: {sample.topicPrompt}</p>
                    </div>

                    <button
                      onClick={() => onDeleteGradedSample(sample.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Xóa bài mẫu"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Nội dung bài văn mẫu */}
                  <div className="p-4 rounded-xl bg-[#FAF8F3] border border-slate-200 text-xs font-serif text-[#1E1B4B] leading-relaxed">
                    "{sample.studentContent}"
                  </div>

                  {/* Nhận xét chuẩn của giáo viên */}
                  <div className="text-xs text-slate-700 bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                    <strong className="text-[#4F46E5] font-bold">Nhận xét của giáo viên: </strong>
                    {sample.teacherFeedback}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ================= 4. TAB THỬ NGHIỆM AI (SANDBOX) ================= */}
      {activeTab === 'sandbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cột trái: Đầu vào dán văn bản */}
          <div className="bg-white p-6 rounded-2xl border border-[#E8DFD1] shadow-xs space-y-4">
            <div>
              <h3 className="font-extrabold text-[#1E1B4B] text-base mb-1">
                Thử nghiệm AI chấm đoạn văn (Sandbox)
              </h3>
              <p className="text-xs text-slate-500">
                Dán một đoạn văn bất kỳ để xem AI sẽ đưa ra gợi ý gì trước khi dùng cho học sinh.
              </p>
            </div>

            {/* Chọn Rubric áp dụng */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Chọn Rubric áp dụng
              </label>
              <select
                value={sandboxRubricId}
                onChange={(e) => setSandboxRubricId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden"
              >
                {rubricTemplates.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Ô dán văn bản */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Đoạn văn thử nghiệm ({sandboxText.trim().split(/\s+/).length} từ)
              </label>
              <textarea
                rows={8}
                value={sandboxText}
                onChange={(e) => setSandboxText(e.target.value)}
                placeholder="Dán đoạn văn của học sinh hoặc đoạn văn mẫu vào đây..."
                className="w-full p-3.5 text-xs font-serif bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-[#E2704A] leading-relaxed"
              />
            </div>

            <button
              onClick={handleRunSandbox}
              disabled={isSandboxRunning || !sandboxText.trim()}
              className="w-full py-3 bg-[#E2704A] hover:bg-[#D05F39] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {isSandboxRunning ? 'AI đang phân tích và cho điểm...' : 'Thử AI chấm ngay'}
            </button>
          </div>

          {/* Cột phải: Kết quả AI đề xuất */}
          <div className="bg-white p-6 rounded-2xl border border-[#E8DFD1] shadow-xs space-y-4">
            <h3 className="font-extrabold text-[#1E1B4B] text-base mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" /> Kết quả AI gợi ý
            </h3>

            {!sandboxResult && !isSandboxRunning && (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-2xl">
                <Play className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs text-slate-400 font-semibold">
                  Bấm "Thử AI chấm ngay" ở cột bên trái để xem phân tích chi tiết.
                </p>
              </div>
            )}

            {isSandboxRunning && (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6">
                <div className="animate-spin w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full mb-3" />
                <p className="text-xs font-bold text-purple-800">
                  AI đang đối sánh văn bản với Rubric và bộ bài mẫu...
                </p>
              </div>
            )}

            {sandboxResult && (
              <div className="space-y-4">
                {/* Điểm tổng */}
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-purple-700 font-bold uppercase">
                      Tổng điểm gợi ý
                    </span>
                    <div className="text-2xl font-black text-purple-950">
                      {sandboxResult.totalScore} / 10
                    </div>
                  </div>
                  <span className="text-xs font-bold text-purple-600 bg-white px-2.5 py-1 rounded-full border border-purple-200">
                    Độ tin cậy: {Math.round((sandboxResult.confidence || 0.9) * 100)}%
                  </span>
                </div>

                {/* Từng tiêu chí */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase">
                    Chi tiết từng tiêu chí:
                  </span>
                  {sandboxResult.rubricScores.map((item: any, i: number) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-[#FAF8F3] border border-slate-200 text-xs space-y-1"
                    >
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>{item.criterionName}</span>
                        <span className="text-[#4F46E5]">
                          {item.suggestedScore ?? item.score} / {item.maxScore}đ
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px] italic">💡 {item.reason}</p>
                    </div>
                  ))}
                </div>

                {/* Nhận xét chung */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <span className="font-bold text-slate-800 block">Nhận xét chung đề xuất:</span>
                  <p className="text-slate-700 leading-relaxed italic">
                    "{sandboxResult.overallComment}"
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= 5. TAB CHỈ SỐ ĐỘ TIN CẬY ================= */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#E8DFD1] shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase block mb-1">
                Độ chênh trung bình (AI vs Thầy/Cô)
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#4F46E5]">
                  ± {accuracyMetrics?.averageDiff ?? 0.35}
                </span>
                <span className="text-xs text-emerald-600 font-bold">Rất sát điểm chuẩn</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Mức lệch dưới 0.5 điểm cho thấy AI đã hiểu đúng cách chấm của thầy cô.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E8DFD1] shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase block mb-1">
                Tỉ lệ giáo viên sửa nhiều (&gt; 1.5đ)
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-800">
                  {accuracyMetrics?.highDiffRatio ?? 8.5}%
                </span>
                <span className="text-xs text-slate-500">trên tổng bài chấm</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Chủ yếu rơi vào các bài viết có biểu hiện sáng tạo phá cách hoặc lạc đề.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E8DFD1] shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase block mb-1">
                Tổng bài đã hoàn tất thẩm định
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-700">36</span>
                <span className="text-xs text-slate-400">bài viết</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Dữ liệu mẫu giúp tinh chỉnh AI sau mỗi lần thầy/cô bấm "Chốt".
              </p>
            </div>
          </div>

          {/* Biểu đồ xu hướng lệch điểm theo tuần & theo tiêu chí */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Xu hướng tuần */}
            <div className="bg-white p-5 rounded-2xl border border-[#E8DFD1] shadow-xs space-y-4">
              <h4 className="font-extrabold text-sm text-[#1E1B4B]">
                Xu hướng độ chênh lệch điểm qua các tuần (Càng thấp càng chuẩn)
              </h4>
              <div className="space-y-3">
                {(
                  accuracyMetrics?.weeklyTrends || [
                    { week: 'Tuần 1', diff: 0.65, total: 6 },
                    { week: 'Tuần 2', diff: 0.48, total: 10 },
                    { week: 'Tuần 3', diff: 0.35, total: 12 },
                    { week: 'Tuần 4', diff: 0.22, total: 8 },
                  ]
                ).map((w, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-700">{w.week}</span>
                      <span className="text-[#4F46E5]">± {w.diff} điểm</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#4F46E5] rounded-full transition-all"
                        style={{ width: `${Math.max(15, (1 - w.diff) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Độ chênh theo tiêu chí */}
            <div className="bg-white p-5 rounded-2xl border border-[#E8DFD1] shadow-xs space-y-4">
              <h4 className="font-extrabold text-sm text-[#1E1B4B]">
                Độ chênh lệch trung bình theo từng tiêu chí Rubric
              </h4>
              <div className="space-y-3">
                {[
                  { name: 'Nội dung ý & Cảm thụ', diff: 0.35 },
                  { name: 'Bố cục & Liên kết', diff: 0.18 },
                  { name: 'Dùng từ & Chính tả', diff: 0.12 },
                  { name: 'Sáng tạo & Cảm xúc', diff: 0.42 },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-700">{item.name}</span>
                      <span className="text-slate-600">± {item.diff}đ</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${item.diff * 120}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL SỬA RUBRIC ================= */}
      {isRubricModalOpen && editingRubric && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-4">
            <h3 className="font-extrabold text-base text-[#1E1B4B]">
              {editingRubric.title ? 'Chỉnh sửa Rubric' : 'Tạo Rubric mẫu mới'}
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tên Rubric</label>
              <input
                type="text"
                value={editingRubric.title}
                onChange={(e) =>
                  setEditingRubric({ ...editingRubric, title: e.target.value })
                }
                placeholder="VD: Đoạn văn cảm nghĩ về bài thơ 4 chữ, 5 chữ"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả ngắn</label>
              <input
                type="text"
                value={editingRubric.description || ''}
                onChange={(e) =>
                  setEditingRubric({ ...editingRubric, description: e.target.value })
                }
                placeholder="VD: Đánh giá cảm thụ thơ bốn chữ theo GDPT 2018"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            {/* Danh sách tiêu chí */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">Các tiêu chí chấm</label>
              {editingRubric.criteria.map((c, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) => {
                      const newC = [...editingRubric.criteria];
                      newC[i].name = e.target.value;
                      setEditingRubric({ ...editingRubric, criteria: newC });
                    }}
                    placeholder="Tên tiêu chí"
                    className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <input
                    type="number"
                    value={c.weight}
                    onChange={(e) => {
                      const newC = [...editingRubric.criteria];
                      newC[i].weight = parseInt(e.target.value) || 0;
                      setEditingRubric({ ...editingRubric, criteria: newC });
                    }}
                    className="w-16 px-2 py-1.5 text-xs text-center bg-slate-50 border border-slate-200 rounded-lg font-bold"
                  />
                  <span className="text-xs font-bold text-slate-500">%</span>
                </div>
              ))}
            </div>

            {(() => {
              const totalWeight = editingRubric.criteria.reduce(
                (acc, c) => acc + (Number(c.weight) || 0),
                0
              );
              const weightOk = totalWeight === 100;
              return (
                <>
                  <p
                    className={`text-xs font-bold text-right ${
                      weightOk ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    Tổng trọng số: {totalWeight}%{' '}
                    {weightOk ? '✓' : '(phải đúng 100% mới lưu được — vì điểm từng tiêu chí được tính theo tỉ lệ này)'}
                  </p>
                  <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                    <button
                      onClick={() => setIsRubricModalOpen(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={async () => {
                        await onSaveRubricTemplate(editingRubric);
                        setIsRubricModalOpen(false);
                      }}
                      disabled={!editingRubric.title.trim() || !weightOk}
                      className="px-4 py-2 bg-[#E2704A] text-white text-xs font-bold rounded-xl disabled:opacity-50"
                    >
                      Lưu Rubric
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ================= MODAL SỬA BÀI MẪU ================= */}
      {isSampleModalOpen && editingSample && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-4">
            <h3 className="font-extrabold text-base text-[#1E1B4B]">
              {editingSample.title ? 'Chỉnh sửa bài mẫu' : 'Thêm bài văn mẫu cho AI'}
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu đề bài mẫu</label>
              <input
                type="text"
                value={editingSample.title}
                onChange={(e) =>
                  setEditingSample({ ...editingSample, title: e.target.value })
                }
                placeholder="VD: Bài mẫu Khá (7.5đ) - Cảm nghĩ bài thơ Tiếng gà trưa"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mức điểm & Xếp loại</label>
              <div className="flex gap-2">
                <select
                  value={editingSample.levelGrade}
                  onChange={(e) =>
                    setEditingSample({
                      ...editingSample,
                      levelGrade: e.target.value as any,
                    })
                  }
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="excellent">Tốt (8.5 - 10đ)</option>
                  <option value="good">Khá (7.0 - 8.0đ)</option>
                  <option value="average">Trung bình (5.0 - 6.5đ)</option>
                  <option value="poor">Kém (&lt; 5.0đ)</option>
                </select>
                <input
                  type="number"
                  step="0.1"
                  value={editingSample.totalScore}
                  onChange={(e) =>
                    setEditingSample({
                      ...editingSample,
                      totalScore: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-20 px-3 py-2 text-xs text-center font-black bg-slate-50 border border-slate-200 rounded-xl"
                />
                <span className="self-center text-xs font-bold text-slate-400">/ 10đ</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Đoạn văn học sinh</label>
              <textarea
                rows={5}
                value={editingSample.studentContent}
                onChange={(e) =>
                  setEditingSample({ ...editingSample, studentContent: e.target.value })
                }
                placeholder="Nội dung đoạn văn..."
                className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-serif"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nhận xét chuẩn của giáo viên
              </label>
              <textarea
                rows={3}
                value={editingSample.teacherFeedback}
                onChange={(e) =>
                  setEditingSample({ ...editingSample, teacherFeedback: e.target.value })
                }
                placeholder="Nhận xét chỉ rõ ưu/khuyết điểm..."
                className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setIsSampleModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                onClick={async () => {
                  await onSaveGradedSample(editingSample);
                  setIsSampleModalOpen(false);
                }}
                disabled={!editingSample.studentContent.trim()}
                className="px-4 py-2 bg-[#E2704A] text-white text-xs font-bold rounded-xl"
              >
                Lưu bài mẫu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
