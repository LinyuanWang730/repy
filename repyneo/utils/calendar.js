/**
 * 日历弹窗共用逻辑：复盘 / 趋势 / 设置三页都用它，
 * 免得同一套月份格子在四个页面里抄四遍。
 */
const { pad2, todayKey, effortInfo, clampEffort } = require('./util');

const WEEK = ['一', '二', '三', '四', '五', '六', '日'];

function monthStart(date) {
  const d = date ? new Date(date.getTime()) : new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function shiftMonth(cursor, delta) {
  return new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
}

/** 返回 { title, cursorKey, week, cells }，cells 里 empty 的格子只用来占位 */
function buildMonth(cursor, records) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const db = records || {};
  const today = todayKey();
  const cells = [];
  for (let i = 0; i < offset; i += 1) {
    cells.push({ key: `pad-${i}`, empty: true });
  }
  for (let day = 1; day <= days; day += 1) {
    const key = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    const list = Array.isArray(db[key]) ? db[key] : [];
    const info = effortInfo(clampEffort(list.length ? list[0].effort : 0));
    cells.push({
      key,
      empty: false,
      day,
      hasRecord: list.length > 0,
      tint: info ? info.color : '#8fd3f4',
      isToday: key === today
    });
  }
  return {
    title: `${year} 年 ${month + 1} 月`,
    cursorKey: `${year}-${pad2(month + 1)}`,
    week: WEEK,
    cells
  };
}

module.exports = { monthStart, shiftMonth, buildMonth };
