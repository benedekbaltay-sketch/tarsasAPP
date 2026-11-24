import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Save, 
  Sparkles, 
  Calculator, 
  Calendar, 
  Clock, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  Eye, 
  Plus, 
  Copy, 
  Mail,
  ChevronRight,
  ShieldCheck,
  Shuffle
} from 'lucide-react';
import { MERGE_VARIABLES, evaluateFlatAgainstRule, generateSampleFlatPreview } from '../../utils/dunningRules.js';
import { formatCurrency } from '../../utils/finances.js';

export function EditEmailRuleModal({
  isOpen,
  rule, // null for new, or rule object to edit
  defaultBuildingId = 'all',
  onClose,
  onSave
}) {
  const { state, t } = useApp();
  const { buildings, currentLang, repProfile } = state;
  const isEn = currentLang === 'en';

  const [name, setName] = useState(String(rule?.name || rule?.nameEn || ''));
  const [buildingId, setBuildingId] = useState(rule?.buildingId || defaultBuildingId || 'all');
  const [targetAccount, setTargetAccount] = useState(rule?.targetAccount || 'per_account');
  const [conditionType, setConditionType] = useState(rule?.conditionType || 'months');
  const [monthThreshold, setMonthThreshold] = useState(rule?.monthThreshold !== undefined ? rule.monthThreshold : 1.0);
  const [maxMonthThreshold, setMaxMonthThreshold] = useState(rule?.maxMonthThreshold !== undefined && rule?.maxMonthThreshold !== null ? rule.maxMonthThreshold : '');
  const [minAmountHuf, setMinAmountHuf] = useState(rule?.minAmountHuf !== undefined ? rule.minAmountHuf : 10000);
  const [operator, setOperator] = useState(rule?.operator || 'OR');
  const [checkDayOfMonth, setCheckDayOfMonth] = useState(rule?.checkDayOfMonth || 15);
  const [cooldownDays, setCooldownDays] = useState(rule?.cooldownDays !== undefined ? rule.cooldownDays : 25);
  const [crossRuleCooldown, setCrossRuleCooldown] = useState(rule?.crossRuleCooldown !== undefined ? rule.crossRuleCooldown : true);
  const [templateSubject, setTemplateSubject] = useState(rule?.templateSubject || '');
  const [templateSubjectEn, setTemplateSubjectEn] = useState(rule?.templateSubjectEn || '');
  const [templateBody, setTemplateBody] = useState(rule?.templateBody || '');
  const [templateBodyEn, setTemplateBodyEn] = useState(rule?.templateBodyEn || '');
  const [enabled, setEnabled] = useState(rule?.enabled !== undefined ? rule.enabled : true);

  const [activeTab, setActiveTab] = useState('formula'); // 'formula' | 'template' | 'dryrun'
  const [sampleSeedIndex, setSampleSeedIndex] = useState(0);
  const [selectedUnitKey, setSelectedUnitKey] = useState(''); // `${bId}::${flatNum}`

  // Form constructed rule object for real-time preview
  const liveRule = useMemo(() => {
    return {
      id: rule?.id || 'rule-draft',
      name: name.trim() || (isEn ? 'Unnamed Rule' : 'Névtelen szabály'),
      nameEn: name.trim() || (isEn ? 'Unnamed Rule' : 'Névtelen szabály'),
      buildingId,
      targetAccount,
      conditionType,
      monthThreshold: Number(monthThreshold) || 1.0,
      maxMonthThreshold: maxMonthThreshold !== '' && !isNaN(Number(maxMonthThreshold)) ? Number(maxMonthThreshold) : null,
      minAmountHuf: Number(minAmountHuf) || 0,
      operator,
      checkDayOfMonth: Number(checkDayOfMonth) || 15,
      cooldownDays: Number(cooldownDays) || 25,
      crossRuleCooldown: Boolean(crossRuleCooldown),
      templateSubject,
      templateSubjectEn,
      templateBody,
      templateBodyEn,
      enabled
    };
  }, [rule, name, buildingId, targetAccount, conditionType, monthThreshold, maxMonthThreshold, minAmountHuf, operator, checkDayOfMonth, cooldownDays, crossRuleCooldown, templateSubject, templateSubjectEn, templateBody, templateBodyEn, enabled, isEn]);

  // Real-time realistic sample preview for any picked or random flat
  const samplePreview = useMemo(() => {
    if (!isOpen) return null;
    let targetFlatNum = undefined;
    let targetBuildingId = undefined;
    if (selectedUnitKey) {
      const parts = selectedUnitKey.split('::');
      if (parts.length === 2) {
        targetBuildingId = parts[0];
        targetFlatNum = parts[1];
      }
    }
    return generateSampleFlatPreview(liveRule, buildings || [], {
      buildingId: targetBuildingId || (buildingId !== 'all' ? buildingId : undefined),
      flatNum: targetFlatNum,
      seedIndex: sampleSeedIndex,
      isEn,
      repProfile
    });
  }, [isOpen, liveRule, buildings, buildingId, selectedUnitKey, sampleSeedIndex, isEn, repProfile]);

  if (!isOpen) return null;

  const handleInsertTag = (tag) => {
    setTemplateBody(prev => `${prev} {{${tag}}} `);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      ...liveRule,
      id: rule?.id || `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div 
        className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-scaleUp my-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center flex-shrink-0 shadow-2xs">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 font-display">
                {rule ? (isEn ? "Edit Automated Rule" : "Automatikus szabály szerkesztése") : (isEn ? "Create Automated Rule" : "Új automatikus szabály létrehozása")}
              </h3>
              <p className="text-xs text-gray-500">
                {isEn ? "Formula-based condition, timing, and dynamic template variables" : "Képletezhető feltételrendszer, időzítés és dinamikus levélsablon"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
            title={isEn ? "Close" : "Bezárás"}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-gray-100 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('formula')}
            className={`px-4 py-2 border-b-2 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'formula'
                ? 'border-[#1E3A8A] text-[#1E3A8A]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>{isEn ? "1. Conditions & Formula" : "1. Feltétel & Képlet"}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('template')}
            className={`px-4 py-2 border-b-2 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'template'
                ? 'border-[#1E3A8A] text-[#1E3A8A]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isEn ? "2. Email Template" : "2. E-mail Sablon"}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dryrun')}
            className={`px-4 py-2 border-b-2 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'dryrun'
                ? 'border-[#1E3A8A] text-[#1E3A8A]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{isEn ? "3. Preview" : "3. Előnézet"}</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {activeTab === 'formula' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Basic Rule Info */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {isEn ? "Rule Name" : "Szabály megnevezése"} *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isEn ? "e.g. 1-Month Friendly Balance Reminder" : "pl. 1 havi barátságos egyenleg-emlékeztető"}
                  className="w-full px-3.5 py-2.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-[#1E3A8A] font-semibold text-gray-900"
                />
              </div>

              {/* Scope & Target Account */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {isEn ? "Target Condominium" : "Érintett társasház hatóköre"}
                  </label>
                  <select
                    value={buildingId}
                    onChange={(e) => setBuildingId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-[#1E3A8A] font-medium"
                  >
                    <option value="all">{isEn ? "🌐 All Managed Condominiums" : "🌐 Minden kezelt társasház"}</option>
                    {(buildings || []).map(b => (
                      <option key={b.id} value={b.id}>
                        🏢 {b.officialName || b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {isEn ? "Target Account / Balance" : "Érintett számla / Tartozás típusa"}
                  </label>
                  <select
                    value={targetAccount}
                    onChange={(e) => setTargetAccount(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-[#1E3A8A] font-medium"
                  >
                    <option value="per_account">{isEn ? "⚡ Per-Account Separate Arrears (Operating & Renovation independently)" : "⚡ Alszámlánkénti külön vizsgálat (KK és FA függetlenül)"}</option>
                    <option value="total">{isEn ? "Σ Total Arrears (Operating + Renovation + Custom net sum)" : "Σ Összesített hátralék (KK + FA + Egyedi nettó)"}</option>
                    <option value="KK">{isEn ? "Operating / Common Cost Arrears (KK only)" : "Közös Költség elmaradás (csak KK)"}</option>
                    <option value="FA">{isEn ? "Renovation Fund Arrears (FA only)" : "Felújítási Alap elmaradás (csak FA)"}</option>
                  </select>
                </div>
              </div>

              {/* Formula & Condition Selector */}
              <div className="bg-blue-50/50 border border-blue-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1E3A8A]">
                  <Calculator className="w-4 h-4 text-[#1E3A8A]" />
                  <span>{isEn ? "Trigger Formula & Arrears Thresholds" : "Feltételi képlet és küszöbértékek"}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">
                      {isEn ? "Condition Mode" : "Feltétel számítási módja"}
                    </label>
                    <select
                      value={conditionType}
                      onChange={(e) => setConditionType(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-blue-200 rounded-xl bg-white focus:outline-none font-semibold text-gray-800"
                    >
                      <option value="months">{isEn ? "Number of unpaid months" : "Elmaradt havi díjak száma"}</option>
                      <option value="amount">{isEn ? "Minimum debt in HUF" : "Minimum hátralék összeg (Ft)"}</option>
                      <option value="combined">{isEn ? "Combined (Months & Amount)" : "Kombinált (Hónapok és Forint)"}</option>
                    </select>
                  </div>

                  {(conditionType === 'months' || conditionType === 'combined') && (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">
                          {isEn ? "Min. Unpaid Months (≥)" : "Min. elmaradás (≥ hó)"}
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={monthThreshold}
                          onChange={(e) => setMonthThreshold(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-blue-200 rounded-xl bg-white focus:outline-none font-bold text-gray-900"
                          placeholder="pl. 1.0"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">
                          {isEn ? "Max. Months (< optional)" : "Felső sáv (< hó, opcionális)"}
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={maxMonthThreshold}
                          onChange={(e) => setMaxMonthThreshold(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-blue-200 rounded-xl bg-white focus:outline-none font-bold text-gray-900"
                          placeholder={isEn ? "e.g. 2.0" : "pl. 2.0"}
                        />
                      </div>
                    </>
                  )}

                  {(conditionType === 'amount' || conditionType === 'combined') && (
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">
                        {isEn ? "Min. Debt Amount (HUF)" : "Minimum tartozás összege (Ft)"}
                      </label>
                      <input
                        type="number"
                        step="1000"
                        min="1000"
                        value={minAmountHuf}
                        onChange={(e) => setMinAmountHuf(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-blue-200 rounded-xl bg-white focus:outline-none font-bold text-gray-900"
                      />
                    </div>
                  )}

                  {conditionType === 'combined' && (
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">
                        {isEn ? "Logical Operator" : "Logikai művelet"}
                      </label>
                      <select
                        value={operator}
                        onChange={(e) => setOperator(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-blue-200 rounded-xl bg-white focus:outline-none font-bold text-gray-900"
                      >
                        <option value="OR">{isEn ? "VAGY (OR) – Either matches" : "VAGY (Bármelyik feltétel teljesül)"}</option>
                        <option value="AND">{isEn ? "ÉS (AND) – Both must match" : "ÉS (Mindkét feltételnek teljesülnie kell)"}</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-blue-900/80 bg-blue-100/50 p-2.5 rounded-xl flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-700 flex-shrink-0" />
                  <span>
                    <strong>{isEn ? "Active Formula:" : "Érvényes szabály:"}</strong>{' '}
                    {conditionType === 'months' && (
                      isEn
                        ? `Triggers when arrears are ≥ ${monthThreshold} months${maxMonthThreshold ? ` and < ${maxMonthThreshold} months` : ''}.`
                        : `Akkor küld értesítést, ha a lakás tartozása ≥ ${monthThreshold} havi díj${maxMonthThreshold ? ` és < ${maxMonthThreshold} havi díj (sávos kizárás)` : ''}.`
                    )}
                    {conditionType === 'amount' && (isEn ? `Triggers when flat arrears reach at least ${formatCurrency(minAmountHuf)}.` : `Akkor küld értesítést, ha a hátralék eléri a legalább ${formatCurrency(minAmountHuf)} összeget.`)}
                    {conditionType === 'combined' && (
                      isEn
                        ? `Triggers when debt is ≥ ${monthThreshold} months${maxMonthThreshold ? ` (< ${maxMonthThreshold})` : ''} ${operator} ≥ ${formatCurrency(minAmountHuf)}.`
                        : `Akkor küld, ha a hátralék ≥ ${monthThreshold} hó${maxMonthThreshold ? ` (< ${maxMonthThreshold})` : ''} ${operator === 'OR' ? 'VAGY' : 'ÉS'} ≥ ${formatCurrency(minAmountHuf)}.`
                    )}
                  </span>
                </div>
              </div>

              {/* Timing & Deduplication */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-500" />
                      <span>{t.comm_rule_check_day_label || (isEn ? "Monthly Dispatch Day (8:00 AM)" : "Havi kiküldés napja (reggel 8:00)")}</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={checkDayOfMonth}
                      onChange={(e) => setCheckDayOfMonth(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none font-bold"
                    />
                    <span className="text-[10px] text-gray-400 mt-0.5 block">
                      {t.comm_rule_check_day_hint || (isEn ? "Runs automatically on this day of the month at 8:00 AM" : "Minden hónap adott napján reggel 8:00-kor automatikusan fut")}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                      <span>{isEn ? "Cooldown / Re-send Guard" : "Türelmi idő (nap)"}</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="90"
                      value={cooldownDays}
                      onChange={(e) => setCooldownDays(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none font-bold"
                    />
                    <span className="text-[10px] text-gray-400 mt-0.5 block">
                      {isEn ? "Minimum days between notices" : "Két felszólítás közötti várakozási idő"}
                    </span>
                  </div>

                  <div className="flex flex-col justify-center">
                    <label className="block text-xs font-bold text-gray-700 mb-2">
                      {isEn ? "Rule Status" : "Szabály státusza"}
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                        className="w-4 h-4 text-[#1E3A8A] rounded border-gray-300 focus:ring-0"
                      />
                      <span className="text-xs font-bold text-gray-800">
                        {enabled ? (isEn ? "🟢 Active & Enabled" : "🟢 Aktív (Bekapcsolva)") : (isEn ? "⚪ Paused (Disabled)" : "⚪ Szüneteltetve (Kikapcsolva)")}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Cross-rule cooldown toggle */}
                <div className="pt-2 border-t border-gray-200/80">
                  <label className="inline-flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-gray-700 select-none">
                    <input
                      type="checkbox"
                      checked={crossRuleCooldown}
                      onChange={(e) => setCrossRuleCooldown(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-[#1E3A8A] focus:ring-[#1E3A8A]"
                    />
                    <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>
                      {isEn 
                        ? "🛡️ Cross-Rule Cooldown Protection: Do not send if this flat already received ANY dunning notice within cooldown period." 
                        : "🛡️ Kereszt-türelmi védelem: Ne küldjön, ha a lakás BÁRMELY MÁS felszólító szabályból kapott már levelet a türelmi időn belül."}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'template' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Dynamic Tag Injector Pills */}
              <div className="bg-blue-50/60 p-3.5 rounded-2xl border border-blue-200/70">
                <span className="text-[11px] font-bold text-blue-900 block mb-2">
                  {isEn ? "Click any merge tag below to insert into letter body:" : "Kattints bármelyik változóra a levél szövegébe való beszúráshoz:"}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {MERGE_VARIABLES.map(v => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => handleInsertTag(v.key)}
                      className="px-2 py-1 rounded-lg bg-white hover:bg-blue-100/70 text-[#1E3A8A] text-[10px] font-mono font-bold border border-blue-200 transition-all cursor-pointer shadow-2xs"
                      title={isEn ? v.labelEn : v.labelHu}
                    >
                      +{`{{${v.key}}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject Field */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {isEn ? "Email Subject Line" : "E-mail tárgysor"} *
                </label>
                <input
                  type="text"
                  required
                  value={templateSubject}
                  onChange={(e) => setTemplateSubject(e.target.value)}
                  placeholder="pl. Fizetési felszólítás: {{tarsashaz_neve}}, {{lakas_szam}}. lakás"
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:border-[#1E3A8A] font-semibold"
                />
              </div>

              {/* Body Textarea */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {isEn ? "Email Letter Body Template" : "E-mail levél törzsszövege (Sablon)"} *
                </label>
                <textarea
                  required
                  rows={10}
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-sans border border-gray-200 rounded-2xl bg-gray-50 focus:bg-white focus:outline-none focus:border-[#1E3A8A] leading-relaxed resize-y"
                  placeholder="Írd ide a felszólító levél szövegét a dinamikus {{változókkal}}..."
                />
              </div>
            </div>
          )}

          {activeTab === 'dryrun' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Top Toolbar: Switcher & Randomize */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-900 truncate flex items-center gap-2">
                      <span>{isEn ? "Realistic Email Preview" : "Valósághű e-mail előnézet"}</span>
                      {samplePreview?.isSimulated && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                          {isEn ? "Sample Debt Data" : "Minta hátralékadat"}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">
                      {isEn 
                        ? "See exactly how this notification arrives in the resident's email client" 
                        : "Nézd meg, hogyan jelenik meg a felszólító levél a lakó postaládájában"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {samplePreview?.allUnits && samplePreview.allUnits.length > 1 && (
                    <select
                      value={selectedUnitKey}
                      onChange={(e) => setSelectedUnitKey(e.target.value)}
                      className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-xl bg-white font-medium text-gray-700 focus:outline-none focus:border-[#1E3A8A] max-w-[190px] truncate"
                      title={isEn ? "Select specific flat" : "Konkrét lakás kiválasztása"}
                    >
                      <option value="">{isEn ? "🎲 Random flat" : "🎲 Véletlenszerű lakás"}</option>
                      {samplePreview.allUnits.map(u => (
                        <option key={`${u.buildingId}::${u.flatNum}`} value={`${u.buildingId}::${u.flatNum}`}>
                          {u.flatNum}. lakás ({u.ownerName})
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUnitKey('');
                      setSampleSeedIndex(prev => prev + 1);
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
                    title={isEn ? "Try another random flat" : "Másik véletlenszerű lakás kipróbálása"}
                  >
                    <Shuffle className="w-3.5 h-3.5 text-[#1E3A8A]" />
                    <span>{isEn ? "Random Flat" : "Másik lakás"}</span>
                  </button>
                </div>
              </div>

              {/* Email Client Envelope & Body */}
              {samplePreview ? (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Email Header / Envelope */}
                  <div className="p-4 sm:p-5 bg-gradient-to-b from-gray-50 to-white border-b border-gray-100 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-gray-500">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-semibold text-gray-400">{isEn ? "From:" : "Feladó:"}</span>
                        <span className="font-bold text-gray-800">
                          {samplePreview.context?.kepviselo_neve || (isEn ? "Property Management" : "Közös Képviselet")}
                        </span>
                        <span className="text-gray-400">&lt;{samplePreview.context?.kepviselo_email || "info@tarsasapp.hu"}&gt;</span>
                      </div>
                      <div className="text-gray-400 font-mono text-[10px]">
                        {new Date().toLocaleString(isEn ? 'en-GB' : 'hu-HU', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
                      <span className="font-semibold text-gray-400">{isEn ? "To:" : "Címzett:"}</span>
                      <span className="font-bold text-gray-800">{samplePreview.ownerName}</span>
                      <span className="text-gray-400">&lt;{samplePreview.ownerEmail || `${samplePreview.flatNum}@pelda.hu`}&gt;</span>
                      <span className="text-gray-300">•</span>
                      <span className="text-gray-600 font-medium">{samplePreview.buildingName} • {samplePreview.flatNum}. lakás</span>
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                        {isEn ? "Subject" : "Tárgy"}
                      </span>
                      <div className="text-sm sm:text-base font-extrabold text-gray-900 mt-0.5">
                        {samplePreview.renderedSubject || (isEn ? "(Empty Subject Line)" : "(Üres tárgysor)")}
                      </div>
                    </div>
                  </div>

                  {/* Email Letter Body */}
                  <div className="p-5 sm:p-6 bg-white">
                    <div className="bg-gray-50/60 rounded-xl p-5 border border-gray-100 text-xs sm:text-sm font-sans whitespace-pre-wrap text-gray-800 leading-relaxed max-h-[360px] overflow-y-auto font-normal">
                      {samplePreview.renderedBody || (isEn ? "(Empty Email Body)" : "(Üres levéltörzs)")}
                    </div>
                  </div>

                  {/* Envelope Footer Stats Badge */}
                  <div className="px-5 py-3 bg-gray-50/80 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                    <div className="flex flex-wrap items-center gap-4">
                      <span>
                        {isEn ? "Calculated Arrears:" : "Kiszámított hátralék:"} <strong className="text-red-600 font-display">{formatCurrency(-samplePreview.arrearsHuf)}</strong>
                      </span>
                      <span>
                        {isEn ? "Months overdue:" : "Elmaradt havi előírás:"} <strong className="text-gray-800">{samplePreview.arrearsMonths} hó</strong>
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 italic">
                      {isEn ? "Dynamic variables update automatically when edited in Tab 2." : "A változók automatikusan frissülnek a 2. E-mail Sablon fülön végzett módosításokkor."}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {isEn ? "Cancel" : "Mégse"}
            </button>

            <button
              type="submit"
              className="px-5 py-2 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isEn ? "Save Rule" : "Szabály mentése"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
