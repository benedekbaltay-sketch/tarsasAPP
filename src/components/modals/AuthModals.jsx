import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, KeyRound, CheckCircle2, AlertCircle, HelpCircle, Lock, Mail, Phone, ExternalLink } from 'lucide-react';

// 1. Forgot Password Modal
export function ForgotPasswordModal({ isOpen, onClose, onOpenResetWithToken }) {
  const { state, t } = useApp();
  const [email, setEmail] = useState('');
  const [simulatedLink, setSimulatedLink] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    const token = Math.random().toString(36).substring(2, 10);
    const link = `${window.location.origin}${window.location.pathname}?reset_token=${token}&email=${encodeURIComponent(email.trim().toLowerCase())}`;
    setSimulatedLink(link);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(simulatedLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDirectReset = () => {
    const params = new URL(simulatedLink).searchParams;
    const emailParam = params.get('email');
    const tokenParam = params.get('reset_token');
    onClose();
    onOpenResetWithToken(emailParam, tokenParam);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md p-6 overflow-hidden space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#1E3A8A]" />
            <h3 className="text-base font-bold text-gray-900">{t.forgot_password_title}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!simulatedLink ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-gray-500 leading-relaxed">
              Add meg a regisztrált e-mail címedet, és generálunk egy jelszó-visszaállító hivatkozást.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{t.email}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pelda@email.com"
                required
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af]"
              >
                {t.send_reset_link}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>A visszaállító hivatkozás sikeresen elkészült! Demo módban közvetlenül használhatod az alábbi linket:</span>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl break-all font-mono text-[11px] text-gray-700">
              {simulatedLink}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                {copied ? "Másolva!" : "Link másolása"}
              </button>
              <button
                type="button"
                onClick={handleDirectReset}
                className="flex-1 py-2 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] flex items-center justify-center gap-1"
              >
                <span>Megnyitás</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 2. Reset Password Modal (with token)
export function ResetPasswordModal({ isOpen, email, token, onClose }) {
  const { state, t, showToast } = useApp();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword.length < 4) {
      setErrorMsg("A jelszónak legalább 4 karakter hosszúnak kell lennie.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("A két jelszó nem egyezik meg.");
      return;
    }

    // Save updated password in users
    const users = state.users || [];
    const updatedUsers = users.map(u => {
      if (u.email && u.email.toLowerCase() === email.toLowerCase()) {
        return { ...u, pass: newPassword, password: newPassword };
      }
      return u;
    });

    state.users = updatedUsers;
    localStorage.setItem("tarsashaz_state", JSON.stringify(state));

    showToast("Jelszó sikeresen frissítve! Most már beléphetsz az új jelszavaddal.");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md p-6 overflow-hidden space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#1E3A8A]" />
            <h3 className="text-base font-bold text-gray-900">{t.reset_password_title}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

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
              placeholder="••••••••"
              required
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
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
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af]"
            >
              {t.save_new_password}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 3. Change Password Modal
export function ChangePasswordModal({ isOpen, onClose }) {
  const { t, changePassword } = useApp();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword.length < 4) {
      setErrorMsg("Az új jelszónak legalább 4 karakter hosszúnak kell lennie.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Az új jelszavak nem egyeznek.");
      return;
    }

    const res = changePassword(oldPassword, newPassword);
    if (!res.success) {
      setErrorMsg(res.error);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md p-6 overflow-hidden space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#1E3A8A]" />
            <h3 className="text-base font-bold text-gray-900">{t.change_password_title}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t.old_password_label}</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t.new_password_label}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
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
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af]"
            >
              {t.save_password_btn}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
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
