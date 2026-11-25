/**
 * 本地存储：动作池、一周安排、设置、当前编排、记录、趋势。
 * 键名和桌面版保持一致（fitness-log-*），以后想互认数据不用再翻译一遍。
 */
const { BASE_ACTIONS, isCardio, groupColor, groupTint } = require('./pool');
const { dateKey, clampEffort } = require('./util');

const KEYS = {
  draft: 'fitness-log-v1',
  records: 'fitness-log-records-v2',
  custom: 'fitness-log-custom-actions-v1',
  plan: 'fitness-log-week-plan-v1',
  settings: 'fitness-log-settings-v1',
  hidden: 'fitness-log-hidden-actions-v1',
  trend: 'fitness-log-trend-v1',
  backfill: 'fitness-log-backfill-v1'
};

const DEFAULT_SETTINGS = {
  autoClearOnSave: false,
  autoAddAfterCreate: true,
  backfillPrompt: true,
  startDate: '',
  setsPresets: [1, 2, 3, 4],
  repsPresets: [6, 8, 12],
  manualTrainDays: null,
  manualTrainDaysAt: ''
};

/** 桌面版默认的七天安排，第一次打开就照这份来 */
const DEFAULT_PLAN = {
  1: { name: '上肢 A · 卧推重', items: ['bench', 'seated-row', 'lat-pulldown', 'incline-lateral', 'reverse-pec', 'triceps-pushdown'] },
  2: { name: '篮球课', items: ['basketball'] },
  3: { name: '下肢 A · 哈克深蹲重', items: ['hack-squat', 'adductor', 'leg-curl', 'calf-raise'] },
  4: { name: '上肢 B · 直臂下压重', items: ['straight-arm', 'incline-db', 'chest-row', 'cable-lateral', 'face-pull', 'db-curl', 'hammer-curl'] },
  5: { name: '下肢 B · 腿举重', items: ['leg-press', 'bulgarian', 'leg-curl', 'leg-extension', 'crunch'] },
  6: { name: '', items: [] },
  0: { name: '', items: [] }
};

function read(key, fallback) {
  try {
    const value = wx.getStorageSync(key);
    if (value === '' || value === undefined || value === null) return fallback;
    return value;
  } catch (err) {
    return fallback;
  }
}

function write(key, value) {
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (err) {
    return false;
  }
}

function ensureStore() {
  const seeded = read('fitness-log-seeded', false);
  if (seeded) return;
  write(KEYS.plan, DEFAULT_PLAN);
  write(KEYS.settings, DEFAULT_SETTINGS);
  write('fitness-log-seeded', true);
}

/* ---------- 动作池 ---------- */

function customActions() {
  const list = read(KEYS.custom, []);
  return Array.isArray(list) ? list : [];
}

function hiddenIds() {
  const list = read(KEYS.hidden, []);
  return Array.isArray(list) ? list : [];
}

/** 动作池：自带（去掉删过的）+ 自建，每个都带上颜色，wxml 里直接用 */
function actionList() {
  const hidden = new Set(hiddenIds());
  const custom = customActions();
  return BASE_ACTIONS
    .filter(action => !hidden.has(action.id))
    .concat(custom)
    .map(action => ({
      id: action.id,
      name: action.name,
      aliases: action.aliases || '',
      group: action.group,
      type: action.type || 'strength',
      common: Boolean(action.common),
      priority: action.priority || 99,
      custom: Boolean(action.custom),
      cardio: isCardio(action),
      color: groupColor(action.group),
      tint: groupTint(action.group)
    }));
}

function findAction(id, list) {
  const pool = list || actionList();
  return pool.find(action => action.id === id) || null;
}

function addCustomAction(name, group, aliases) {
  const id = `custom-${Date.now().toString(36)}`;
  const list = customActions();
  list.push({ id, name, aliases: aliases || '', group, latest: '', priority: 99, custom: true });
  write(KEYS.custom, list);
  return id;
}

function removeAction(id) {
  const list = customActions();
  const customHit = list.filter(item => item.id === id);
  if (customHit.length) {
    write(KEYS.custom, list.filter(item => item.id !== id));
  } else {
    const hidden = hiddenIds();
    if (hidden.indexOf(id) < 0) hidden.push(id);
    write(KEYS.hidden, hidden);
  }
  prunePlan();
  pruneDraft();
}

function restoreBuiltin() {
  write(KEYS.hidden, []);
}

/* ---------- 一周安排 ---------- */

function loadPlan() {
  const raw = read(KEYS.plan, null);
  const pool = new Set(actionList().map(action => action.id));
  const out = {};
  for (let day = 0; day < 7; day += 1) {
    const preset = DEFAULT_PLAN[day] || { name: '', items: [] };
    const hit = raw && raw[day];
    if (hit && Array.isArray(hit.items)) {
      out[day] = { name: String(hit.name || ''), items: hit.items.filter(id => pool.has(id)) };
    } else if (Array.isArray(hit)) {
      out[day] = { name: '', items: hit.filter(id => pool.has(id)) };
    } else {
      out[day] = { name: preset.name, items: preset.items.filter(id => pool.has(id)) };
    }
  }
  return out;
}

function savePlan(plan) {
  write(KEYS.plan, plan);
}

function prunePlan() {
  const plan = loadPlan();
  savePlan(plan);
  return plan;
}

/* ---------- 设置 ---------- */

function loadSettings() {
  const raw = read(KEYS.settings, null) || {};
  const cleanPresets = (list, fallback) => {
    const seen = new Set();
    const out = [];
    (Array.isArray(list) ? list : []).forEach(item => {
      const num = Math.floor(Number(item));
      if (!Number.isFinite(num) || num < 1 || num > 99 || seen.has(num)) return;
      seen.add(num);
      if (out.length < 4) out.push(num);
    });
    return out.length ? out : fallback.slice();
  };
  const manual = Math.floor(Number(raw.manualTrainDays));
  return {
    autoClearOnSave: Boolean(raw.autoClearOnSave),
    autoAddAfterCreate: raw.autoAddAfterCreate !== false,
    backfillPrompt: raw.backfillPrompt !== false,
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.startDate || '')) ? raw.startDate : '',
    setsPresets: cleanPresets(raw.setsPresets, DEFAULT_SETTINGS.setsPresets),
    repsPresets: cleanPresets(raw.repsPresets, DEFAULT_SETTINGS.repsPresets),
    manualTrainDays: Number.isFinite(manual) && manual >= 0 ? manual : null,
    manualTrainDaysAt: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.manualTrainDaysAt || '')) ? raw.manualTrainDaysAt : ''
  };
}

function saveSettings(settings) {
  write(KEYS.settings, settings);
}

/* ---------- 当前编排 ---------- */

function loadDraft() {
  const raw = read(KEYS.draft, null) || {};
  const selected = Array.isArray(raw.selected) ? raw.selected : [];
  return {
    activeDay: Number.isInteger(raw.activeDay) ? raw.activeDay : new Date().getDay(),
    activeGroup: raw.activeGroup || '全部',
    effort: clampEffort(raw.effort),
    selected
  };
}

function saveDraft(draft) {
  write(KEYS.draft, {
    v: 1,
    activeDay: draft.activeDay,
    activeGroup: draft.activeGroup,
    effort: draft.effort,
    selected: draft.selected
  });
}

/** 动作被删掉后，编排里那一行也一起清掉 */
function pruneDraft() {
  const draft = loadDraft();
  const pool = new Set(actionList().map(action => action.id));
  const before = draft.selected.length;
  draft.selected = draft.selected.filter(entry => pool.has(entry.actionId));
  if (draft.selected.length !== before) saveDraft(draft);
  return draft;
}

/* ---------- 记录 ---------- */

function loadRecords() {
  const raw = read(KEYS.records, {});
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function saveRecords(db) {
  write(KEYS.records, db);
}

function addRecord(record) {
  const db = loadRecords();
  const key = record.savedDate;
  if (!Array.isArray(db[key])) db[key] = [];
  db[key].unshift(record);
  saveRecords(db);
  return db;
}

function removeRecord(key, id) {
  const db = loadRecords();
  if (Array.isArray(db[key])) {
    db[key] = db[key].filter(rec => rec.id !== id);
    if (!db[key].length) delete db[key];
  }
  saveRecords(db);
  return db;
}

function recordStats() {
  const db = loadRecords();
  let count = 0;
  let days = 0;
  Object.keys(db).forEach(key => {
    const list = Array.isArray(db[key]) ? db[key] : [];
    if (!list.length) return;
    count += list.length;
    days += 1;
  });
  return { count, days };
}

/* ---------- 补记录（键名和桌面版 BACKFILL_KEY 一致） ---------- */

function loadBackfill() {
  const raw = read(KEYS.backfill, null);
  if (!raw) return { armed: false, date: '' };
  if (typeof raw === 'string') {
    return /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? { armed: true, date: raw }
      : { armed: raw === 'armed', date: '' };
  }
  if (typeof raw === 'object') {
    return {
      armed: Boolean(raw.armed),
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.date || '')) ? raw.date : ''
    };
  }
  return { armed: false, date: '' };
}

function saveBackfill(state) {
  const armed = Boolean(state && state.armed);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String((state && state.date) || '')) ? state.date : '';
  if (!armed) {
    try { wx.removeStorageSync(KEYS.backfill); } catch (err) { /* 清不掉就算了 */ }
    return { armed: false, date: '' };
  }
  write(KEYS.backfill, { armed: true, date });
  return { armed: true, date };
}

function clearBackfill() {
  return saveBackfill({ armed: false, date: '' });
}

/* ---------- 趋势 ---------- */

function loadTrend() {
  const raw = read(KEYS.trend, null) || {};
  const list = Array.isArray(raw.list) ? raw.list.filter(id => typeof id === 'string') : [];
  /* 默认一个都不追，用户在趋势页自己「添加动作」 */
  return { list };
}

function saveTrend(trend) {
  write(KEYS.trend, trend);
}

module.exports = {
  KEYS,
  DEFAULT_SETTINGS,
  DEFAULT_PLAN,
  ensureStore,
  read,
  write,
  actionList,
  findAction,
  customActions,
  hiddenIds,
  addCustomAction,
  removeAction,
  restoreBuiltin,
  loadPlan,
  savePlan,
  loadSettings,
  saveSettings,
  loadDraft,
  saveDraft,
  pruneDraft,
  loadRecords,
  saveRecords,
  addRecord,
  removeRecord,
  recordStats,
  loadBackfill,
  saveBackfill,
  clearBackfill,
  loadTrend,
  saveTrend
};
