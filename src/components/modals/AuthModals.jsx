import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { getFirebaseInstance } from '../../constants/firebaseConfig';
import { sendPasswordResetEmail, confirmPasswordReset } from 'firebase/auth';
import { X, KeyRound, CheckCircle2, AlertCircle, HelpCircle, Lock, Mail, Phone, ExternalLink, ShieldCheck } from 'lucide-react';

// 1. Forgot Password Modal
export function ForgotPasswordModal({ isOpen, onClose }) {
  const { state, t } = useApp();
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
          console.warn("sendPasswordResetEmail with actionCodeSettings fallback:", settingsErr.message);
          await sendPasswordResetEmail(auth, trimmed);
        }
      }
      setIsSent(true);
    } catch (err) {
      console.warn("sendPasswordResetEmail error:", err.code, err.message);
      if (err.code === 'auth/user-not-found') {
        setErrorMsg("Ezzel az e-mail címmel nem található regisztrált fiók.");
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg("Kérjük, adj meg egy érvényes e-mail címet.");
      } else {
        setErrorMsg("Hiba történt a kiküldés során. Kérjük, próbáld újra később.");
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
              Add meg a regisztrált e-mail címedet, és a rendszer egy hivatalos jelszó-visszaállító hivatkozást küld a postafiókodba.
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
                placeholder="pelda@email.com"
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
                {loading ? "Küldés folyamatban..." : t.send_reset_link}
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
                A visszaállító e-mail elküldve!
              </h4>
              <p className="text-xs text-emerald-800 leading-relaxed">
                A jelszó-visszaállító hivatkozást sikeresen elküldtük a(z) <strong>{email}</strong> címre. Kérjük, nyisd meg a leveleződet, és kattints a levélben lévő hivatkozásra az új jelszó megadásához!
              </p>
              <p className="text-[11px] text-emerald-600 font-medium">
                (Ha nem találod a levelet pár percen belül, kérjük, ellenőrizd a Spam / Promóciók mappát is.)
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2.5 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] cursor-pointer shadow-xs transition-all"
              >
                {t.close || "Rendben, bezárás"}
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
  const { t, showToast, persistState } = useApp();
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

    if (newPassword.length < 6) {
      setErrorMsg("A biztonságos jelszónak legalább 6 karakter hosszúnak kell lennie.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("A két jelszó nem egyezik meg.");
      return;
    }

    setLoading(true);
    try {
      const { auth } = getFirebaseInstance();
      if (auth && oobCode) {
        await confirmPasswordReset(auth, oobCode, newPassword);
      }

      if (persistState) {
        persistState(s => {
          const targetEmail = (email || '').toLowerCase().trim();
          const updatedUsers = (s.users || []).map(u => {
            const uEmail = (u.email || '').toLowerCase().trim();
            if (uEmail === targetEmail || (targetEmail.startsWith("benedek.baltay") && uEmail.startsWith("benedek.baltay"))) {
              return { ...u, pass: newPassword, password: newPassword };
            }
            return u;
          });
          const updatedBuildings = (s.buildings || []).map(b => {
            if (b.flats) {
              b.flats = b.flats.map(f => {
                const fEmail = (f.email || '').toLowerCase().trim();
                if (fEmail === targetEmail) {
                  return { ...f, pass: newPassword, password: newPassword };
                }
                return f;
              });
            }
            return b;
          });
          return {
            ...s,
            users: updatedUsers,
            buildings: updatedBuildings
          };
        }, true);
      }

      try {
        if (email) localStorage.setItem("tarsashaz_last_email", email.trim().toLowerCase());
      } catch (e) {}

      showToast("Jelszó sikeresen megváltoztatva! Most már bejelentkezhetsz az új jelszavaddal.");
      onClose();
    } catch (err) {
      console.warn("confirmPasswordReset error:", err.code, err.message);
      if (err.code === 'auth/expired-action-code') {
        setErrorMsg("A jelszó-visszaállító hivatkozás lejárt. Kérjük, igényelj új hivatkozást a bejelentkezés oldalon!");
      } else if (err.code === 'auth/invalid-action-code') {
        setErrorMsg("A hivatkozás érvénytelen vagy már fel lett használva.");
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg("A megadott jelszó túl gyenge. Kérjük, adj meg egy erősebb jelszót (legalább 6 karakter)!");
      } else {
        setErrorMsg("Hiba történt a jelszó mentése során. Kérjük, próbáld újra később.");
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
                <p className="font-semibold text-red-900 mb-1">Érvénytelen vagy lejárt hivatkozás</p>
                <p className="leading-relaxed">{initialError}</p>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] cursor-pointer shadow-xs transition-all"
              >
                {t.close || "Bezárás"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              Új jelszó megadása a(z) <strong>{email}</strong> fiókhoz:
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
                  placeholder="Legalább 6 karakter"
                  required
                  minLength={6}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t.new_password_confirm_label}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
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
                  {loading ? "Mentés folyamatban..." : t.save_new_password}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// 3. Change Password Modal (Bejelentkezett fióknál csak az új jelszót kell 2x megadni)
export function ChangePasswordModal({ isOpen, onClose }) {
  const { state, t, changePassword } = useApp();
  const isEn = state?.currentLang === 'en';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword.length < 4) {
      setErrorMsg(isEn ? "The new password must be at least 4 characters long." : "Az új jelszónak legalább 4 karakter hosszúnak kell lennie.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg(isEn ? "The passwords do not match." : "A két új jelszó nem egyezik meg.");
      return;
    }

    setLoading(true);
    try {
      const res = await changePassword(newPassword);
      if (!res.success) {
        setErrorMsg(res.error);
      } else {
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
            ? "Enter your new password twice to update it. You do not need to enter your current password." 
            : "Add meg kétszer az új jelszavadat a módosításhoz. A jelenlegi régi jelszó megadása nem szükséges."}
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
              placeholder="••••••••"
              required
              autoFocus
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t.new_password_confirm_label}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
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

// 4. Help & Contact Modal
export function HelpModal({ isOpen, onClose }) {
  const { t } = useApp();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md p-6 overflow-hidden space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#1E3A8A]" />
            <h3 className="text-base font-bold text-gray-900">{t.help_title}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs text-gray-600">
          <p className="leading-relaxed">
            A <strong>Társasházkezelő Portál</strong> a Batyu utca 21. társasház lakói és közös képviselete számára készült, hogy a közös költség és felújítási alap befizetései, egyenlegei és dokumentumai mindig átláthatóak legyenek.
          </p>

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
            <h4 className="font-bold text-gray-900 text-sm">Közös Képviselet:</h4>
            <div className="font-semibold text-gray-800">Baltay Benedek</div>
            <div className="flex items-center gap-2 text-gray-600">
              <Phone className="w-3.5 h-3.5 text-[#1E3A8A]" />
              <a href="tel:+36203971253" className="hover:underline font-mono">+36 20 397 1253</a>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Mail className="w-3.5 h-3.5 text-[#1E3A8A]" />
              <a href="mailto:benedek.baltay@gmail.com" className="hover:underline">benedek.baltay@gmail.com</a>
            </div>
          </div>

          <p className="text-[11px] text-gray-400 leading-relaxed">
            Ha elfelejtette a jelszavát vagy belépési problémát tapasztal, kérjük vegye fel a kapcsolatot a közös képviselettel a fenti elérhetőségeken!
          </p>
        </div>

        <div className="flex justify-end pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af]"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
