import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Mail, Lock, Eye, AlertCircle, CheckCircle2, KeyRound, HelpCircle, LogIn, Building2, User } from 'lucide-react';

export function LoginView({ onOpenForgotPassword, onOpenHelp }) {
  const { state, t, login, quickLogin, toggleLanguage } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const isHu = state.currentLang === 'hu' || !state.currentLang;

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    const res = login(email, password, rememberMe);
    if (!res.success) {
      setErrorMsg(res.error || t.login_error);
    }
  };

  const adminUser = (state.users || []).find(u => u.role === 'admin') || {
    id: "admin",
    name: "Baltay Benedek",
    email: "benedek.baltay@gmail.com",
    role: "admin"
  };

  const residentUsers = (state.users || []).filter(u => u.role === 'Owner');

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col items-center justify-center p-4 sm:p-6 md:p-10">
      
      {/* Top Language Bar */}
      <div className="w-full max-w-md flex justify-end mb-4">
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 shadow-sm transition-all"
        >
          <img
            src={isHu ? "https://flagcdn.com/gb.svg" : "https://flagcdn.com/hu.svg"}
            alt={isHu ? "EN" : "HU"}
            className="w-4 h-3 rounded-xs object-cover"
          />
          <span>{isHu ? "English" : "Magyar"}</span>
        </button>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-xl p-7 sm:p-9 animate-fadeIn">
        
        {/* Header */}
        <div className="text-center mb-7">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-[#1E3A8A] flex items-center justify-center text-white shadow-lg shadow-blue-900/30">
              <Building2 className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 font-display m-0">
              {t.login_title}
            </h2>
          </div>
          <p className="text-sm text-gray-500 font-medium">
            {t.login_subtitle} &bull; Batyu utca 21.
          </p>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2.5 animate-shake">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              {t.login_username_label}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pelda@email.com"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all shadow-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              {t.login_password_label}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-11 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all shadow-xs"
              />
              <button
                type="button"
                onMouseDown={() => setShowPassword(true)}
                onMouseUp={() => setShowPassword(false)}
                onMouseLeave={() => setShowPassword(false)}
                onTouchStart={() => setShowPassword(true)}
                onTouchEnd={() => setShowPassword(false)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
                title="Jelszó mutatása nyomva tartáskor"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-[#1E3A8A] focus:ring-[#1E3A8A] cursor-pointer"
              />
              <span>{t.remember_me}</span>
            </label>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#1E3A8A] hover:bg-[#1e40af] text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-[0.99] cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>{t.login_title}</span>
          </button>
        </form>

        {/* Footer links */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-semibold">
          <button
            type="button"
            onClick={onOpenForgotPassword}
            className="text-[#1E3A8A] hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{t.forgot_password}</span>
          </button>
          <button
            type="button"
            onClick={onOpenHelp}
            className="text-gray-500 hover:text-gray-800 flex items-center gap-1.5 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{t.help_nav}</span>
          </button>
        </div>
      </div>

      {/* Quick Login Demo Section */}
      <div className="w-full max-w-md mt-6 bg-white/70 backdrop-blur-sm border border-gray-200/80 rounded-2xl p-5 shadow-sm">
        <div className="mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
            <span>{t.quick_login_title}</span>
          </h4>
          <p className="text-xs text-gray-500">
            {t.quick_login_desc}
          </p>
        </div>

        {/* Representative */}
        <div className="mb-3">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
            {t.management}
          </span>
          <button
            onClick={() => quickLogin(adminUser)}
            className="w-full flex items-center justify-between p-2.5 rounded-xl border border-blue-200/70 bg-blue-50/50 hover:bg-blue-100/70 text-left transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#1E3A8A] text-white flex items-center justify-center font-bold text-xs">
                KK
              </div>
              <div>
                <div className="text-xs font-bold text-gray-900">{adminUser.name}</div>
                <div className="text-[11px] text-gray-500">{t.rep_role}</div>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-600 text-white">
              Admin
            </span>
          </button>
        </div>

        {/* Residents */}
        <div>
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
            {t.residents}
          </span>
          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {residentUsers.map((user) => (
              <button
                key={user.id || user.flatNum}
                onClick={() => quickLogin(user)}
                className="flex items-center gap-2 p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-left transition-all"
              >
                <div className="w-6 h-6 rounded-md bg-gray-100 text-gray-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  {user.flatNum}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-gray-800 truncate">{user.name}</div>
                  <div className="text-[10px] text-gray-400 truncate">{user.flatNum}. lakás</div>
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
