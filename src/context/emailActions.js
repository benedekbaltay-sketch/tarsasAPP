/**
 * Action creators for email communication, automated dunning rules, and outbox logs.
 */

import { DEFAULT_DUNNING_RULES } from '../utils/dunningRules.js';

export function createEmailActions(state, setState) {
  const saveEmailRule = (ruleData) => {
    if (!ruleData) return;
    setState((prev) => {
      const currentRules = Array.isArray(prev.emailRules) && prev.emailRules.length > 0 
        ? prev.emailRules 
        : JSON.parse(JSON.stringify(DEFAULT_DUNNING_RULES));
      const existingIdx = currentRules.findIndex((r) => r.id === ruleData.id);
      let updatedRules;
      if (existingIdx >= 0) {
        updatedRules = currentRules.map((r, idx) => (idx === existingIdx ? { ...r, ...ruleData, updatedAt: new Date().toISOString() } : r));
      } else {
        const newRule = {
          ...ruleData,
          id: ruleData.id || `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: new Date().toISOString()
        };
        updatedRules = [newRule, ...currentRules];
      }
      return {
        ...prev,
        emailRules: updatedRules,
        lastUpdated: Date.now(),
        revision: (prev.revision || 0) + 1
      };
    });
  };

  const deleteEmailRule = (ruleId) => {
    if (!ruleId) return;
    setState((prev) => {
      const currentRules = Array.isArray(prev.emailRules) ? prev.emailRules : [];
      return {
        ...prev,
        emailRules: currentRules.filter((r) => r.id !== ruleId),
        lastUpdated: Date.now(),
        revision: (prev.revision || 0) + 1
      };
    });
  };

  const toggleEmailRule = (ruleId) => {
    if (!ruleId) return;
    setState((prev) => {
      const currentRules = Array.isArray(prev.emailRules) && prev.emailRules.length > 0 
        ? prev.emailRules 
        : JSON.parse(JSON.stringify(DEFAULT_DUNNING_RULES));
      return {
        ...prev,
        emailRules: currentRules.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)),
        lastUpdated: Date.now(),
        revision: (prev.revision || 0) + 1
      };
    });
  };

  const queueOutboxItems = (items = []) => {
    if (!Array.isArray(items) || items.length === 0) return;
    setState((prev) => {
      const currentOutbox = Array.isArray(prev.emailOutbox) ? prev.emailOutbox : [];
      const newItems = items.map((it) => ({
        ...it,
        id: it.id || `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        status: it.status || 'simulated',
        queuedAt: new Date().toISOString()
      }));
      return {
        ...prev,
        emailOutbox: [...newItems, ...currentOutbox].slice(0, 500),
        lastUpdated: Date.now(),
        revision: (prev.revision || 0) + 1
      };
    });
  };

  const clearOutboxItems = () => {
    setState((prev) => ({
      ...prev,
      emailOutbox: [],
      lastUpdated: Date.now(),
      revision: (prev.revision || 0) + 1
    }));
  };

  return {
    saveEmailRule,
    deleteEmailRule,
    toggleEmailRule,
    queueOutboxItems,
    clearOutboxItems
  };
}
