/**
 * 从桌面版 src/index.html 抄一份动作池到小程序里。
 * 两边的 actionId 必须一模一样，JSON 互传才对得上，所以这里不手抄，直接抽。
 *
 * 用法：node scripts/gen-repyneo-pool.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "src", "index.html"), "utf8");

function slice(startMarker) {
  const start = html.indexOf(startMarker);
  if (start < 0) throw new Error(`找不到 ${startMarker}`);
  const end = html.indexOf("\n  ];", start);
  if (end < 0) throw new Error(`${startMarker} 没找到结尾`);
  return html.slice(start, end + 5);
}

const groups = (() => {
  const start = html.indexOf("const GROUPS = {");
  const end = html.indexOf("\n  };", start);
  if (start < 0 || end < 0) throw new Error("找不到 GROUPS");
  return html.slice(start, end + 5);
})();

const actions = slice("const BASE_ACTIONS = [");

const out = `/**
 * Repy 动作池 —— 由 scripts/gen-repyneo-pool.js 从桌面版 src/index.html 生成，不要手改。
 * actionId 与桌面版完全一致，两边互传的 JSON 才对得上动作和趋势。
 */

${groups}

${actions}

const isCardio = action => Boolean(action && action.type === 'cardio');

const GROUP_ORDER = Object.keys(GROUPS).sort((a, b) => GROUPS[a].order - GROUPS[b].order);

const PACE_UNITS = ['m/s', 'km/m', 'km/h'];

/** 部位名 → 颜色，查不到就给个中性的 */
function groupColor(group) {
  return (GROUPS[group] && GROUPS[group].color) || '#93aabd';
}

/** 部位名 → 浅色底（高透明度纯色块，和桌面版一个路子） */
function groupTint(group) {
  const color = groupColor(group);
  return hexToRgba(color, 0.16);
}

function hexToRgba(hex, alpha) {
  const value = String(hex || '').replace('#', '');
  const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value;
  const num = parseInt(full || '93aabd', 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return \`rgba(\${r}, \${g}, \${b}, \${alpha})\`;
}

module.exports = {
  GROUPS,
  BASE_ACTIONS,
  GROUP_ORDER,
  PACE_UNITS,
  isCardio,
  groupColor,
  groupTint
};
`;

const target = path.join(ROOT, "repyneo", "utils", "pool.js");
fs.writeFileSync(target, out, "utf8");
console.log("wrote", target, out.length, "chars");
