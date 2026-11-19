import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { getFirebaseInstance } from '../../constants/firebaseConfig';
import { sendPasswordResetEmail, confirmPasswordReset } from 'firebase/auth';
import { X, KeyRound, CheckCircle2, AlertCircle, HelpCircle, Lock, Mail, Phone } from 'lucide-react';

// 1. Forgot Password Modal
export function ForgotPasswordModal({ isOpen, onClose }) {
  const { state, t } = useApp();
  const isEn = state?.currentLang === 'en';
  const [email, setEmail] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = (email || '').trim().toLowerCase();
    if (!trimmed) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const { auth } = getFirebaseInstance();
      if (auth) {
        const actionCodeSettings = {
          url: `${window.location.origin}/`,
          handleCodeInApp: true
        };
        try {
          await sendPasswordResetEmail(auth, trimmed, actionCodeSettings);
        } catch (settingsErr) {
          if (settingsErr.code === 'auth/user-not-found') {
            // Prevent email enumeration: report generic success state
            setIsSent(true);
            return;
          }
          console.warn("sendPasswordResetEmail with actionCodeSettings fallback:", settingsErr.message);
          await sendPasswordResetEmail(auth, trimmed);
        }
      }
      setIsSent(true);
    } catch (err) {
      console.warn("sendPasswordResetEmail error:", err.code);
      if (err.code === 'auth/user-not-found') {
        // Prevent account/email enumeration by displaying the same confirmation screen
        setIsSent(true);
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg(isEn ? "Please enter a valid email address." : "Kérjük, adj meg egy érvényes e-mail címet.");
      } else {
        setErrorMsg(isEn ? "An error occurred while sending the email. Please try again later." : "Hiba történt a kiküldés során. Kérjük, próbáld újra később.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setEmail('');
    setIsSent(false);
    setErrorMsg('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md p-6 overflow-hidden space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#1E3A8A]" />
            <h3 className="text-base font-bold text-gray-900">{t.forgot_password_title}</h3>
          </div>
          <button onClick={handleReset} className="p-1 rounded text-gray-400 hover:text-gray-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isSent ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-gray-500 leading-relaxed">
              {isEn
                ? "Enter your registered email address and we will send an official password reset link to your inbox."
                : "Add meg a regisztrált e-mail címedet, és a rendszer egy hivatalos jelszó-visszaállító hivatkozást küld a postafiókodba."}
            </p>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{t.email}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isEn ? "name@example.com" : "pelda@email.com"}
                required
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all shadow-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-3.5 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] disabled:opacity-50 cursor-pointer shadow-xs transition-all"
              >
                {loading ? (isEn ? "Sending..." : "Küldés folyamatban...") : t.send_reset_link}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2.5">
              <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-emerald-900">
                {isEn ? "Password Reset Request Sent" : "Jelszó-visszaállítási kérelem elküldve"}
              </h4>
              <p className="text-xs text-emerald-800 leading-relaxed">
                {isEn
                  ? <>If an account exists for <strong>{email}</strong>, a password reset link has been sent. Please open your inbox and follow the link to set a new password.</>
                  : <>Ha a(z) <strong>{email}</strong> cím szerepel a rendszerünkben, elküldtük a jelszó-visszaállító hivatkozást. Kérjük, nyisd meg a leveleződet, és kattints a levélben lévő hivatkozásra az új jelszó megadásához!</>}
              </p>
              <p className="text-[11px] text-emerald-600 font-medium">
                {isEn
                  ? "(If you don't see it within a few minutes, please check your Spam or Promotions folder.)"
                  : "(Ha nem találod a levelet pár percen belül, kérjük, ellenőrizd a Spam / Promóciók mappát is.)"}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2.5 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] cursor-pointer shadow-xs transition-all"
              >
                {t.close || (isEn ? "OK, Close" : "Rendben, bezárás")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 2. Reset Password Modal (opened strictly via the secure email link action code)
export function ResetPasswordModal({ isOpen, email, oobCode, initialError, onClose }) {
  const { state, t, showToast } = useApp();
  const isEn = state?.currentLang === 'en';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(initialError || '');

  useEffect(() => {
    if (initialError) setErrorMsg(initialError);
  }, [initialError]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword.length < 10) {
      setErrorMsg(
        isEn
          ? "The new password must be at least 10 characters long."
          : "A biztonságos jelszónak legalább 10 karakter hosszúnak kell lennie."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg(isEn ? "The passwords do not match." : "A két jelszó nem egyezik meg.");
      return;
    }

    setLoading(true);
    try {
      const { auth } = getFirebaseInstance();
      if (!auth || !oobCode) {
        setErrorMsg(
          isEn
            ? "Invalid or missing password reset code."
            : "Érvénytelen vagy hiányzó jelszó-visszaállító kód."
        );
        return;
      }

      // Reset password strictly in Firebase Authentication (never persist plaintext passwords in DB/localStorage)
      await confirmPasswordReset(auth, oobCode, newPassword);

      try {
        if (email) localStorage.setItem("tarsashaz_last_email", email.trim().toLowerCase());
      } catch (e) {}

      showToast(
        isEn
          ? "Password successfully updated! You can now sign in with your new password."
          : "Jelszó sikeresen megváltoztatva! Most már bejelentkezhetsz az új jelszavaddal."
      );
      onClose();
    } catch (err) {
      console.warn("confirmPasswordReset error:", err.code);
      if (err.code === 'auth/expired-action-code') {
        setErrorMsg(
          isEn
            ? "The password reset link has expired. Please request a new link on the login page."
            : "A jelszó-visszaállító hivatkozás lejárt. Kérjük, igényelj új hivatkozást a bejelentkezés oldalon!"
        );
      } else if (err.code === 'auth/invalid-action-code') {
        setErrorMsg(
          isEn
            ? "This link is invalid or has already been used."
            : "A hivatkozás érvénytelen vagy már fel lett használva."
        );
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg(
          isEn
            ? "The password is too weak. Please enter a stronger password (at least 10 characters)."
            : "A megadott jelszó túl gyenge. Kérjük, adj meg egy erősebb jelszót (legalább 10 karakter)!"
        );
      } else {
        setErrorMsg(
          isEn
            ? "An error occurred while saving your password. Please try again later."
            : "Hiba történt a jelszó mentése során. Kérjük, próbáld újra később."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md p-6 overflow-hidden space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#1E3A8A]" />
            <h3 className="text-base font-bold text-gray-900">{t.reset_password_title}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {initialError ? (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900 mb-1">
                  {isEn ? "Invalid or expired link" : "Érvénytelen vagy lejárt hivatkozás"}
                </p>
                <p className="leading-relaxed">{initialError}</p>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] cursor-pointer shadow-xs transition-all"
              >
                {t.close || (isEn ? "Close" : "Bezárás")}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              {isEn
                ? <>Set a new password for <strong>{email}</strong>:</>
                : <>Új jelszó megadása a(z) <strong>{email}</strong> fiókhoz:</>}
            </p>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t.new_password_label}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={isEn ? "At least 10 characters" : "Legalább 10 karakter"}
                  required
                  minLength={10}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t.new_password_confirm_label}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  minLength={10}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all shadow-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] disabled:opacity-50 cursor-pointer shadow-xs transition-all"
                >
                  {loading ? (isEn ? "Saving..." : "Mentés folyamatban...") : t.save_new_password}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// 3. Change Password Modal (Requires current password re-authentication + min 10 chars)
export function ChangePasswordModal({ isOpen, onClose }) {
  const { state, t, changePassword } = useApp();
  const isEn = state?.currentLang === 'en';
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!currentPassword) {
      setErrorMsg(
        isEn
          ? "Please enter your current password to verify your identity."
          : "Kérjük, add meg a jelenlegi jelszavadat a személyazonosságod megerősítéséhez."
      );
      return;
    }

    if (newPassword.length < 10) {
      setErrorMsg(
        isEn
          ? "The new password must be at least 10 characters long."
          : "Az új jelszónak legalább 10 karakter hosszúnak kell lennie."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg(isEn ? "The passwords do not match." : "A két új jelszó nem egyezik meg.");
      return;
    }

    setLoading(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (!res.success) {
        setErrorMsg(res.error);
      } else {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md p-6 overflow-hidden space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#1E3A8A]" />
            <h3 className="text-base font-bold text-gray-900">{t.change_password_title}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed">
          {isEn
            ? "For your security, verify your current password and enter a new password of at least 10 characters."
            : "A biztonságod érdekében add meg a jelenlegi jelszavadat, majd kétszer az új, legalább 10 karakteres jelszavadat."}
        </p>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {t.current_password_label || (isEn ? "Current Password" : "Jelenlegi jelszó")}
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoFocus
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t.new_password_label}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={isEn ? "At least 10 characters" : "Legalább 10 karakter"}
              required
              minLength={10}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t.new_password_confirm_label}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••"
              required
              minLength={10}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all shadow-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] disabled:opacity-50 cursor-pointer shadow-xs transition-all"
            >
              {loading ? (isEn ? "Saving..." : "Mentés...") : t.save_password_btn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 4. Help & Contact Modal (Zero hardcoded personal PII; dynamically reads authenticated building rep info if signed in)
export function HelpModal({ isOpen, onClose }) {
  const { state, t } = useApp();
  const isEn = state?.currentLang === 'en';
  if (!isOpen) return null;

  const currentBuilding = state?.currentUser
    ? (state.buildings || []).find(b => b.id === state.currentBuildingId) || (state.buildings || [])[0]
    : null;
  const repName = currentBuilding?.repName || '';
  const repPhone = currentBuilding?.phone || '';
  const repEmail = currentBuilding?.email || '';
  const hasRepContact = Boolean(repName || repPhone || repEmail);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md p-6 overflow-hidden space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#1E3A8A]" />
            <h3 className="text-base font-bold text-gray-900">{t.help_title}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs text-gray-600">
          <p className="leading-relaxed">
            {isEn
              ? <>The <strong>Condominium Management Portal</strong> helps residents and common representatives transparently track common charges, renovation fund contributions, balances, and official condominium documents.</>
              : <>A <strong>Társasházkezelő Portál</strong> a társasházak lakói és közös képviselete számára készült, hogy a közös költség és felújítási alap befizetései, egyenlegei és dokumentumai mindig átláthatóak legyenek.</>}
          </p>

          {hasRepContact ? (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
              <h4 className="font-bold text-gray-900 text-sm">
                {isEn ? "Common Representative:" : "Közös Képviselet:"}
              </h4>
              {repName && <div className="font-semibold text-gray-800">{repName}</div>}
              {repPhone && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-3.5 h-3.5 text-[#1E3A8A]" />
                  <a href={`tel:${repPhone.replace(/\s+/g, '')}`} className="hover:underline font-mono">{repPhone}</a>
                </div>
              )}
              {repEmail && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="w-3.5 h-3.5 text-[#1E3A8A]" />
                  <a href={`mailto:${repEmail}`} className="hover:underline">{repEmail}</a>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5">
              <h4 className="font-bold text-gray-900 text-sm">
                {isEn ? "Need help signing in?" : "Segítségre van szükséged a belépéshez?"}
              </h4>
              <p className="text-gray-600 leading-relaxed">
                {isEn
                  ? "Use the 'Forgot password' link on the login screen to reset your password via email, or contact your condominium's Common Representative."
                  : "Elfelejtett jelszó esetén használd a bejelentkezési képernyő 'Elfelejtett jelszó' funkcióját, vagy vedd fel a kapcsolatot a társasházad közös képviseletével."}
              </p>
            </div>
          )}

          <p className="text-[11px] text-gray-400 leading-relaxed">
            {isEn
              ? "If you experience login issues or need an account provisioned for your apartment, please contact your building's Common Representative."
              : "Ha belépési problémát tapasztalsz vagy új lakói hozzáférésre van szükséged, kérjük, fordulj a társasház közös képviseletéhez."}
          </p>
        </div>

        <div className="flex justify-end pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] cursor-pointer"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
