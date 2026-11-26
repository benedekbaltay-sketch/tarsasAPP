import { evaluateSzvbCompliance } from './szvb.js';
import { evaluateEconomicAuditorCompliance } from './economicAuditor.js';
import { canUserManageBuilding } from './teamPermissions.js';

export const ALERT_ID_SZVB_STATUTORY_25 = 'szvb_statutory_25';
export const ALERT_ID_AUDITOR_STATUTORY_50_10M = 'auditor_statutory_50_10m';

/**
 * Check whether a specific alert ID has been dismissed on a building.
 */
export function isBuildingAlertDismissed(building, alertId) {
  if (!building || !alertId) return false;
  const dismissed = building.dismissedAlerts;
  if (Array.isArray(dismissed)) {
    return dismissed.includes(alertId);
  }
  if (dismissed && typeof dismissed === 'object') {
    return Boolean(dismissed[alertId]);
  }
  return false;
}

/**
 * Pure helper to mark an alert ID as dismissed on a target building inside a buildings array.
 */
export function dismissBuildingAlertInList(buildings = [], buildingId, alertId) {
  if (!buildingId || !alertId) return buildings;
  return (buildings || []).map((b) => {
    if (!b || b.id !== buildingId) return b;
    const prev = Array.isArray(b.dismissedAlerts)
      ? b.dismissedAlerts
      : (b.dismissedAlerts && typeof b.dismissedAlerts === 'object'
          ? Object.keys(b.dismissedAlerts).filter((k) => b.dismissedAlerts[k])
          : []);
    if (prev.includes(alertId)) return b;
    return {
      ...b,
      dismissedAlerts: [...prev, alertId],
    };
  });
}

/**
 * Extensible building alert evaluator.
 * Returns active (non-dismissed) actionable alerts for a condominium building.
 * Each alert declares its target drawer menu item (`targetMenu`) and target tab (`targetTab`)
 * so the UI can display a clean red notification trail:
 *   Portfolio building badge (with count) -> Header 3-line menu dot -> Drawer item dot -> Tab dot -> Dismissible banner
 *
 * Strictly gated to managing KK / staff users when `user` is supplied (never shown to regular residents/viewers/SZVB).
 */
export function getBuildingAlerts(
  building,
  { user = null, organizations = [], buildings = [], includeDismissed = false } = {}
) {
  if (!building || building.archived === true) return [];

  if (user) {
    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    if (!isAdmin) return [];
    const canManage = canUserManageBuilding(user, building, organizations, buildings);
    if (!canManage) return [];
  }

  const alerts = [];

  // Alert 1: Statutory SZVB requirement over 25 distinct HRSZ units (Tht. 51. §)
  const szvbCompliance = evaluateSzvbCompliance(building);
  if (
    szvbCompliance.showWarning &&
    (includeDismissed || !isBuildingAlertDismissed(building, ALERT_ID_SZVB_STATUTORY_25))
  ) {
    alerts.push({
      id: ALERT_ID_SZVB_STATUTORY_25,
      targetMenu: 'building-settings',
      targetTab: 'general',
      severity: 'warning',
      dismissible: true,
      titleHu: '25 albetét feletti SZVB kötelezettség (Tht. 51. §)',
      titleEn: 'Statutory SZVB Requirement (Over 25 Units)',
      messageHu: `A társasházban jelenleg ${szvbCompliance.albetetCount} külön helyrajzi számú albetét szerepel (25 felett). A társasházi törvény (Tht. 51. §) alapján legalább 3 SZVB-tagot (1 elnök + 2 tag) szükséges választani. Jelenleg ${szvbCompliance.totalSzvbCount} fő van kijelölve.`,
      messageEn: `This condominium has ${szvbCompliance.albetetCount} distinct parcelled units (over 25). Under the Hungarian Condominium Act (Tht. § 51), at least 3 SZVB members (1 Chairperson + 2 Members) should be elected. Currently ${szvbCompliance.totalSzvbCount} assigned.`,
      meta: szvbCompliance,
    });
  }

  // Alert 2: Statutory Economic Auditor requirement over 50 units OR >10M HUF annual turnover (Tht. 51/A. §)
  const auditorCompliance = evaluateEconomicAuditorCompliance(building);
  if (
    auditorCompliance.showWarning &&
    (includeDismissed || !isBuildingAlertDismissed(building, ALERT_ID_AUDITOR_STATUTORY_50_10M))
  ) {
    alerts.push({
      id: ALERT_ID_AUDITOR_STATUTORY_50_10M,
      targetMenu: 'building-settings',
      targetTab: 'general',
      severity: 'warning',
      dismissible: true,
      titleHu: 'Gazdasági ellenőrzést segítő személy kötelező (Tht. 51/A. §)',
      titleEn: 'Financial Auditor Required (Tht. § 51/A)',
      messageHu: `A Társasházi törvény (Tht. 51/A. §) alapján kötelező gazdasági ellenőrzést segítő személyt (regisztrált mérlegképes könyvelőt vagy okleveles könyvvizsgálót) igénybe venni, mert ${auditorCompliance.triggerReasonHu}. Kérjük, jelölj ki belsős vagy külsős szakembert alább — vagy ha az SZVB valamelyik tagja rendelkezik ilyen képesítéssel, jelöld meg a neve mellett a „Gazdasági ellenőr” gombbal!`,
      messageEn: `Under the Hungarian Condominium Act (Tht. § 51/A), appointing a Financial Auditor (registered accountant or certified auditor) is mandatory because ${auditorCompliance.triggerReasonEn}. Please appoint an internal or external auditor below — or if an SZVB member holds this qualification, mark them using the "Financial Auditor" button next to their name.`,
      meta: auditorCompliance,
    });
  }

  return alerts;
}
