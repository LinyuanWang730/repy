/**
 * 日期、编号、评级和展示文案。
 * 文案拼装规则和桌面版逐条对齐——同一次训练，两边写出来要是同一句话。
 */
const { PACE_UNITS } = require('./pool');

const EFFORT_STAGES = [
  { from: 1, to: 3, name: '轻松', color: '#7fc48f' },
  { from: 4, to: 6, name: '尚可', color: '#9a89d8' },
  { from: 7, to: 8, name: '艰难', color: '#cd7d95' },
  { from: 9, to: 10, name: '极限', color: '#b0614a' }
];

let uidCounter = 0;
function uid(prefix) {
  uidCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${uidCounter}`;
}

function pad2(num) {
  return String(num).padStart(2, '0');
}

function dateKey(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayKey() {
  return dateKey(new Date());
}

function parseDate(key) {
  const [y, m, d] = String(key || '').split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

function formatClock(stamp) {
  const d = new Date(stamp || Date.now());
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDateCn(key) {
  if (!key) return '';
  const [y, m, d] = String(key).split('-');
  return `${y}.${m}.${d}`;
}

function clampEffort(value) {
  const num = Math.floor(Number(value));
  return num >= 1 && num <= 10 ? num : 0;
}

function effortInfo(value) {
  const level = clampEffort(value);
  if (!level) return null;
  const stage = EFFORT_STAGES.find(item => level >= item.from && level <= item.to) || EFFORT_STAGES[0];
  return { level, name: stage.name, color: stage.color, stage: EFFORT_STAGES.indexOf(stage) + 1 };
}

function normalizeWeight(value) {
  const weight = String(value || '').trim();
  if (!weight) return '';
  if (/kg$/i.test(weight)) return weight.replace(/kg$/i, 'KG');
  if (/分钟|KM|公里|大卡|个$|组$/i.test(weight)) return weight;
  return `${weight}KG`;
}

function formatScheme(load) {
  const sets = Math.max(0, Math.floor(Number(load.sets) || 0));
  if (!sets) return '';
  if (load.repMode === 'same') {
    const rep = String(load.sameRep || '').trim();
    return `${sets} × ${rep || load.target || '12'}`;
  }
  const fallback = String(load.target || '12');
  const reps = (load.reps || []).slice(0, sets).map(value => String(value || '').trim() || fallback);
  if (new Set(reps).size === 1) return `${sets} × ${reps[0]}`;
  return `${sets} 组：${reps.join(' / ')}`;
}

function formatSeg(seg) {
  const spec = String(seg.spec || '').trim();
  const pace = String(seg.pace || '').trim();
  const extra = String(seg.extra || '').trim();
  const unit = PACE_UNITS.indexOf(seg.paceUnit) >= 0 ? seg.paceUnit : 'km/h';
  let core = spec;
  if (pace) core = core ? `${core} @ ${pace} ${unit}` : `${pace} ${unit}`;
  if (extra) core = core ? `${core}（${extra}）` : `（${extra}）`;
  return core;
}

function formatLoad(load) {
  if (!load) return '';
  if (load.spec !== undefined) return formatSeg(load);
  let weight = normalizeWeight(load.weight);
  if (weight && load.eachSide) weight = `各 ${weight.replace(/^各\s*/, '')}`;
  const scheme = formatScheme(load);
  if (!weight && !scheme) return '';
  if (!scheme) return weight;
  return weight ? `${weight}（${scheme}）` : `（${scheme}）`;
}

/** 一条动作 → 一行字：「杠铃卧推 60KG（4 × 6）｜备注：…」 */
function lineFor(item) {
  const loads = (item.loads || []).map(formatLoad).filter(Boolean);
  const name = `${item.name}${item.isKey ? '（关键重量）' : ''}`;
  const note = String(item.note || '').trim();
  let line = name;
  if (!loads.length) {
    if (!note) return line;
  } else {
    const separator = loads[0].startsWith('（') ? '' : ' ';
    line = `${name}${separator}${loads.join(' + ')}`.trim();
  }
  return note ? `${line} ｜备注：${note}` : line;
}

/** 一组动作 → 可复制的整段文字；关键重量排在前面，和桌面版一致 */
function textFromItems(items) {
  const list = items || [];
  const keys = list.filter(item => item.isKey);
  const normal = list.filter(item => !item.isKey);
  return keys.concat(normal).map(lineFor).join('\n');
}

module.exports = {
  EFFORT_STAGES,
  uid,
  pad2,
  dateKey,
  todayKey,
  parseDate,
  formatClock,
  formatDateCn,
  clampEffort,
  effortInfo,
  normalizeWeight,
  formatScheme,
  formatSeg,
  formatLoad,
  lineFor,
  textFromItems
};
