import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Mail, Lock, Eye, AlertCircle, KeyRound, HelpCircle, LogIn, Building2, RefreshCw, Users, CheckCircle2, Send } from 'lucide-react';
import { FlagIcon } from '../components/FlagIcon';

export function LoginView({
  onOpenForgotPassword,
  onOpenHelp,
  pendingInviteToken = '',
  prefilledEmail = '',
  passwordJustSet = false,
}) {
  const { state, t, login, toggleLanguage, resendTeamInviteEmail } = useApp();
  const [email, setEmail] = useState(() => {
    if (prefilledEmail) return prefilledEmail;
    try {
      return localStorage.getItem("tarsashaz_last_email") || '';
    } catch (e) {
      return '';
    }
  });
  const [resendingInviteEmail, setResendingInviteEmail] = useState(false);

  useEffect(() => {
    if (prefilledEmail) {
      setEmail(prefilledEmail);
      try {
        localStorage.setItem("tarsashaz_last_email", prefilledEmail.trim().toLowerCase());
      } catch {}
    }
  }, [prefilledEmail]);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(() => {
    try {
      return parseInt(sessionStorage.getItem("tarsashaz_failed_attempts") || "0", 10);
    } catch (e) {
      return 0;
    }
  });
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  useEffect(() => {
    let timer = null;
    if (lockoutSeconds > 0) {
      timer = setInterval(() => {
        setLockoutSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [lockoutSeconds]);

  const isHu = state.currentLang === 'hu' || !state.currentLang;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lockoutSeconds > 0 || isSubmitting) return;
    setErrorMsg('');
    try {
      if (email) localStorage.setItem("tarsashaz_last_email", email.trim().toLowerCase());
    } catch (err) {}
    setIsSubmitting(true);
    try {
      const res = await login(email, password, rememberMe);
      if (!res.success) {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        try {
          sessionStorage.setItem("tarsashaz_failed_attempts", String(nextAttempts));
        } catch (e) {}

        if (nextAttempts >= 5) {
          setLockoutSeconds(30);
          const limitMsg = (t.login_rate_limit_exceeded || "Túl sok sikertelen próbálkozás. Biztonsági okokból kérjük várj {seconds} másodpercet.").replace('{seconds}', '30');
          setErrorMsg(limitMsg);
        } else {
          setErrorMsg(res.error || t.login_error);
        }
      } else {
        setFailedAttempts(0);
        try {
          sessionStorage.removeItem("tarsashaz_failed_attempts");
        } catch (e) {}
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col items-center justify-center p-4 sm:p-6 md:p-10">
      
      {/* Top Language Bar */}
      <div className="w-full max-w-md flex justify-end mb-4">
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 shadow-xs transition-all hover:border-gray-300 cursor-pointer"
        >
          <FlagIcon
            country={isHu ? "gb" : "hu"}
            className="w-5 h-3.5 rounded-[2px] shadow-2xs border border-black/15"
          />
          <span>{isHu ? "English" : "Magyar"}</span>
        </button>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-xl p-7 sm:p-9 animate-fadeIn">
        
        {/* Header */}
        <div className="text-center mb-7">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-13 h-13 rounded-2xl bg-[#1E3A8A] flex items-center justify-center text-white shadow-lg shadow-blue-900/30">
              <Building2 className="w-6.5 h-6.5" />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 font-display m-0">
              {t.login_title}
            </h2>
          </div>
          <p className="text-sm text-gray-500 font-medium">
            {t.login_subtitle}
          </p>
        </div>

        {/* Password Successfully Set Banner (redirected after colleague sets password!) */}
        {passwordJustSet && (
          <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-medium flex items-start gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600 mt-0.5" />
            <div>
              <div className="font-bold">
                {t.team_password_set_login_title || (isHu ? "Jelszavad sikeresen beállítva!" : "Your password has been set!")}
              </div>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                {t.team_password_set_login_desc || (isHu ? "Most már bejelentkezhetsz az e-mail címeddel és az imént megadott jelszóval." : "You can now sign in below using your email address and your newly created password.")}
              </p>
            </div>
          </div>
        )}

        {/* Team Invitation Welcome Banner */}
        {pendingInviteToken && !passwordJustSet && (
          <div className="mb-5 p-3.5 bg-blue-50 border border-blue-200 text-[#1E3A8A] rounded-xl text-xs font-medium flex items-start gap-2.5 animate-fadeIn">
            <Users className="w-4 h-4 flex-shrink-0 text-[#1E3A8A] mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <div className="font-bold">
                {t.team_invite_login_title || (isHu ? "Meghívót kaptál társasház-kezelői csapatba!" : "You've been invited to a property management team!")}
              </div>
              <p className="text-[11px] text-blue-900/80">
                {t.team_invite_login_desc || (isHu ? "Jelentkezz be a meghívott e-mail címeddel, és a hozzád rendelt társasházak automatikusan aktiválódnak." : "Sign in with your invited email address to automatically activate access to your assigned condominiums.")}
              </p>
              {resendTeamInviteEmail && (
                <button
                  type="button"
                  disabled={resendingInviteEmail || !email.trim()}
                  onClick={async () => {
                    setResendingInviteEmail(true);
                    try {
                      await resendTeamInviteEmail(email, pendingInviteToken);
                    } finally {
                      setResendingInviteEmail(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-blue-100/70 border border-blue-200 text-[#1E3A8A] font-bold text-[11px] cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <Send className="w-3 h-3" />
                  <span>
                    {resendingInviteEmail
                      ? (isHu ? "Küldés..." : "Sending...")
                      : (t.team_invite_need_password_btn || (isHu ? "Még nincs jelszavad? Jelszóbeállító e-mail küldése" : "Need a password? Send password setup email"))}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

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
                onChange={(e) => {
                  setEmail(e.target.value);
                  try {
                    localStorage.setItem("tarsashaz_last_email", e.target.value);
                  } catch (err) {}
                }}
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

          <div className="space-y-1 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-700">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-[#1E3A8A] focus:ring-[#1E3A8A] cursor-pointer"
              />
              <span className="font-semibold">{t.remember_me || (isEn ? 'Remember me on this device' : 'Emlékezzen rám ezen a számítógépen')}</span>
            </label>
            <p className="text-[11px] text-gray-500 pl-6 leading-tight">
              {isEn
                ? 'Keep unchecked to sign into multiple accounts simultaneously in separate tabs.'
                : 'Hagyd kikapcsolva, ha egyszerre több különböző fiókba szeretnél belépni más-más böngészőfülön.'}
            </p>
          </div>

          <button
            type="submit"
            disabled={lockoutSeconds > 0 || isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#1E3A8A] hover:bg-[#1e40af] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-[0.99] cursor-pointer"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            <span>
              {lockoutSeconds > 0
                ? (isHu ? `Várakozás (${lockoutSeconds} mp)...` : `Please wait (${lockoutSeconds}s)...`)
                : isSubmitting
                ? t.logging_in
                : t.login_title}
            </span>
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

    </div>
  );
}
