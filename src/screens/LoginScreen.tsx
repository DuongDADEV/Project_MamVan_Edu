import React, { useState } from 'react';
import { Role } from '../types.ts';
import { AuthSession } from '../services/types.ts';
import { authService } from '../services/index.ts';
import { MamMuc } from '../components/MamMuc.tsx';
import { BrandFullLogo, BrandWordmark } from '../components/MamVanLogo.tsx';
import {
  GraduationCap,
  Users,
  BookOpen,
  Lock,
  User,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Shield,
  AlertCircle,
} from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (session: AuthSession) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [selectedRole, setSelectedRole] = useState<Role>('student');
  const [username, setUsername] = useState('hs001');
  const [password, setPassword] = useState('123456');
  const [errorMsg, setErrorMsg] = useState('');
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setErrorMsg('');
    setShowComingSoon(false);
    if (role === 'admin') {
      setUsername('admin');
      setPassword('123456');
    } else if (role === 'teacher') {
      setUsername('gv001');
      setPassword('123456');
    } else if (role === 'student') {
      setUsername('hs001');
      setPassword('123456');
    } else {
      setShowComingSoon(true);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (selectedRole === 'parent') {
      setShowComingSoon(true);
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.signIn(selectedRole, username, password);
      if (res.success && res.session) {
        onLoginSuccess(res.session);
      } else {
        setErrorMsg(
          res.error ||
            'Hệ thống chưa nhận diện được thông tin đăng nhập này. Bạn vui lòng kiểm tra lại nhé!'
        );
      }
    } catch (err: any) {
      setErrorMsg('Đã xảy ra lỗi khi đăng nhập: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoAccount = (u: string, p = '123456', r: Role = 'student') => {
    setUsername(u);
    setPassword(p);
    setSelectedRole(r);
    setErrorMsg('');
    setShowComingSoon(false);
  };

  return (
    <div className="min-h-screen edtech-dot-bg flex flex-col items-center justify-center p-4 sm:p-6 text-[#1E1B4B]">
      {/* KHUNG ĐĂNG NHẬP CHÍNH */}
      <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-10 shadow-xl shadow-indigo-950/5 relative overflow-hidden border border-slate-100">
        {/* Nền trang trí gradient góc trên */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-bl from-indigo-500/10 via-purple-500/5 to-transparent rounded-bl-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-cyan-400/10 to-transparent rounded-tr-full pointer-events-none" />

        {/* LOGO THƯƠNG HIỆU MẦM VĂN ĐẦY ĐỦ */}
        <div className="text-center mb-6 relative z-10 flex flex-col items-center">
          <BrandFullLogo widthClass="w-[180px] sm:w-[220px] md:w-[240px]" />
          <p className="text-xs sm:text-sm font-medium text-[#367345] mt-1">
            Nuôi dưỡng tình yêu văn học – Lớp 7
          </p>
        </div>

        {/* MÀN HÌNH "SẮP RA MẮT" CHO PHỤ HUYNH */}
        {showComingSoon ? (
          <div className="text-center py-6 animate-[fadeIn_0.3s_ease] relative z-10">
            <MamMuc mood="waiting" size="lg" className="mx-auto mb-4" />
            <BrandWordmark
              size="md"
              align="center"
              showSlogan={true}
              sloganText="Nền tảng học Ngữ văn lớp 7"
              className="mb-3 mx-auto"
            />
            <h2 className="text-xl font-extrabold text-[#1E1B4B] mb-2">
              Giao diện Phụ huynh đang được hoàn thiện
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6 max-w-sm mx-auto">
              Không gian quản lý dành riêng cho phụ huynh để đồng hành cùng con sẽ chính thức mở trong bản phát hành tới. Mời bạn trải nghiệm góc Thầy/Cô hoặc góc Học sinh!
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => handleRoleSelect('student')}
                className="px-5 py-2.5 rounded-2xl gradient-primary text-white font-bold text-xs shadow-md shadow-indigo-500/25 hover:brightness-105 transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Góc Học sinh</span>
              </button>
              <button
                onClick={() => handleRoleSelect('teacher')}
                className="px-5 py-2.5 rounded-2xl bg-[#8B5CF6] text-white font-bold text-xs shadow-md shadow-purple-500/25 hover:brightness-105 transition-all flex items-center gap-2"
              >
                <GraduationCap className="w-4 h-4" />
                <span>Góc Giáo viên</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="relative z-10">
            {/* 4 THẺ CHỌN VAI TRÒ */}
            <div className="mb-6">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2.5">
                Chọn vai trò của bạn:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* 1. Học sinh */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect('student')}
                  className={`p-2.5 rounded-2xl border text-center transition-all ${
                    selectedRole === 'student'
                      ? 'border-[#4F46E5] bg-gradient-to-b from-indigo-50 to-white text-[#4F46E5] font-bold shadow-sm shadow-indigo-500/10'
                      : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100 hover:text-[#1E1B4B]'
                  }`}
                >
                  <BookOpen
                    className={`w-4 h-4 mx-auto mb-1 ${
                      selectedRole === 'student' ? 'text-[#4F46E5]' : 'text-slate-500'
                    }`}
                  />
                  <span className="text-xs block">Học sinh</span>
                </button>

                {/* 2. Giáo viên */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect('teacher')}
                  className={`p-2.5 rounded-2xl border text-center transition-all ${
                    selectedRole === 'teacher'
                      ? 'border-[#8B5CF6] bg-gradient-to-b from-purple-50 to-white text-[#8B5CF6] font-bold shadow-sm shadow-purple-500/10'
                      : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100 hover:text-[#1E1B4B]'
                  }`}
                >
                  <GraduationCap
                    className={`w-4 h-4 mx-auto mb-1 ${
                      selectedRole === 'teacher' ? 'text-[#8B5CF6]' : 'text-slate-500'
                    }`}
                  />
                  <span className="text-xs block">Giáo viên</span>
                </button>

                {/* 3. Phụ huynh */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect('parent')}
                  className={`p-2.5 rounded-2xl border text-center transition-all ${
                    selectedRole === 'parent'
                      ? 'border-[#22D3EE] bg-gradient-to-b from-cyan-50 to-white text-cyan-700 font-bold shadow-sm shadow-cyan-500/10'
                      : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100 hover:text-[#1E1B4B]'
                  }`}
                >
                  <Users
                    className={`w-4 h-4 mx-auto mb-1 ${
                      selectedRole === 'parent' ? 'text-cyan-600' : 'text-slate-500'
                    }`}
                  />
                  <span className="text-xs block">Phụ huynh</span>
                </button>

                {/* 4. Quản trị viên (Admin) */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect('admin')}
                  className={`p-2.5 rounded-2xl border text-center transition-all ${
                    selectedRole === 'admin'
                      ? 'border-[#7C3AED] bg-gradient-to-b from-purple-50 to-white text-[#7C3AED] font-bold shadow-sm shadow-purple-500/10'
                      : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100 hover:text-[#1E1B4B]'
                  }`}
                >
                  <Shield
                    className={`w-4 h-4 mx-auto mb-1 ${
                      selectedRole === 'admin' ? 'text-[#7C3AED]' : 'text-slate-500'
                    }`}
                  />
                  <span className="text-xs block">Admin</span>
                </button>
              </div>
            </div>

            {/* FORM ĐĂNG NHẬP */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  {selectedRole === 'admin'
                    ? 'Tài khoản Quản trị viên'
                    : selectedRole === 'teacher'
                    ? 'Tài khoản giáo viên'
                    : 'Tài khoản học sinh'}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={
                      selectedRole === 'admin'
                        ? 'Ví dụ: admin'
                        : selectedRole === 'teacher'
                        ? 'Ví dụ: gv001'
                        : 'Ví dụ: hs001 hoặc anhnm27'
                    }
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-100 outline-none text-sm text-[#1E1B4B] font-medium transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mặc định: 123456"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-100 outline-none text-sm text-[#1E1B4B] font-medium transition-all"
                  />
                </div>
              </div>

              {/* Thông báo lỗi nếu có */}
              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 leading-relaxed font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Nút đăng nhập chính */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-2xl gradient-primary text-white font-bold text-sm shadow-md shadow-indigo-500/25 hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>
                  {isLoading
                    ? 'Đang xác thực...'
                    : selectedRole === 'admin'
                    ? 'Vào Cổng Quản Trị Hệ Thống'
                    : selectedRole === 'teacher'
                    ? 'Vào không gian giáo viên'
                    : 'Vào không gian học tập'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* TÀI KHOẢN DEMO GỢI Ý BẤM-ĐỂ-ĐIỀN */}
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold mb-3">
                <Sparkles className="w-3.5 h-3.5 text-[#FBBF24]" />
                <span>Tài khoản demo sẵn có (Bấm để điền nhanh):</span>
              </div>

              {selectedRole === 'admin' ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => fillDemoAccount('admin', '123456', 'admin')}
                    className="w-full p-3 rounded-2xl border border-[#7C3AED] bg-purple-50/60 shadow-xs text-left transition-all text-xs"
                  >
                    <p className="font-bold text-[#1E1B4B] flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-[#7C3AED]" />
                        <span>admin</span>
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-[#7C3AED] font-semibold">
                        Quản trị viên Hệ thống
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Quản lý tài khoản giáo viên toàn hệ thống (MK: 123456)
                    </p>
                  </button>
                </div>
              ) : selectedRole === 'teacher' ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => fillDemoAccount('gv001', '123456', 'teacher')}
                    className={`w-full p-3 rounded-2xl border text-left transition-all text-xs ${
                      username === 'gv001'
                        ? 'border-[#8B5CF6] bg-purple-50/60 shadow-xs'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <p className="font-bold text-[#1E1B4B] flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-[#8B5CF6]" />
                        <span>gv001</span>
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-[#8B5CF6] font-semibold">
                        Giáo viên 7A2, 7A3
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Thầy Nguyễn Văn An • THCS Giấy & Mực (MK: 123456)
                    </p>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => fillDemoAccount('hs001', '123456', 'student')}
                    className={`p-3 rounded-2xl border text-left transition-all text-xs ${
                      username === 'hs001'
                        ? 'border-[#4F46E5] bg-indigo-50/60 shadow-xs'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <p className="font-bold text-[#1E1B4B] flex items-center justify-between">
                      <span>hs001</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-[#4F46E5] font-semibold">
                        Đã học
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 truncate">
                      Nguyễn Minh Anh
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => fillDemoAccount('hs002', '123456', 'student')}
                    className={`p-3 rounded-2xl border text-left transition-all text-xs ${
                      username === 'hs002'
                        ? 'border-[#4F46E5] bg-indigo-50/60 shadow-xs'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <p className="font-bold text-[#1E1B4B] flex items-center justify-between">
                      <span>hs002</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">
                        Mới
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 truncate">
                      Trần Gia Bảo
                    </p>
                  </button>
                </div>
              )}

              {/* Lối tắt Admin khi đang ở tab học sinh/giáo viên */}
              {selectedRole !== 'admin' && (
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-100">
                  <span>Cổng Quản trị viên:</span>
                  <button
                    type="button"
                    onClick={() => handleRoleSelect('admin')}
                    className="font-bold text-[#7C3AED] hover:underline flex items-center gap-1"
                  >
                    <Shield className="w-3.5 h-3.5 text-[#7C3AED]" />
                    <span>Đăng nhập Admin (admin/123456)</span>
                  </button>
                </div>
              )}

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 mt-4 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Mật khẩu mặc định tài khoản mẫu: 123456</span>
              </div>

              <div className="flex flex-col items-center justify-center gap-0.5 mt-5 pt-4 border-t border-slate-100">
                <BrandWordmark size="xs" align="center" showSlogan={false} />
                <span className="text-[10px] text-slate-400 font-medium">
                  Đồng hành cùng học sinh và thầy cô lớp 7
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

