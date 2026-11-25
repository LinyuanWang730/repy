const store = require('../../utils/store');
const { formatDateCn } = require('../../utils/util');

const MAX_TRACKED = 4;

function weightOf(load) {
  const num = parseFloat(String((load && load.weight) || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(num) ? num : 0;
}

Page({
  data: {
    tracked: [],
    hasRecords: false,
    pickerOpen: false,
    pickerItems: [],
    pickerCount: 0
  },

  onLoad() {
    this.build();
  },

  onShow() {
    this.build();
  },

  noop() {},

  build() {
    const trend = store.loadTrend();
    const pool = store.actionList();
    const db = store.loadRecords();
    const dates = Object.keys(db).sort();
    let hasRecords = false;
    const tracked = trend.list.map(id => {
      const action = pool.find(item => item.id === id);
      const raw = [];
      dates.forEach(date => {
        const list = Array.isArray(db[date]) ? db[date] : [];
        list.forEach(rec => {
          (rec.items || []).forEach(item => {
            if (item.actionId !== id) return;
            const loads = Array.isArray(item.loads) ? item.loads : [];
            const best = loads.reduce((max, load) => Math.max(max, weightOf(load)), 0);
            if (best > 0) raw.push({ date, value: best });
          });
        });
      });
      const points = raw.slice(-8);
      const max = points.reduce((m, point) => Math.max(m, point.value), 0);
      if (points.length) hasRecords = true;
      return {
        id,
        name: action ? action.name : id,
        group: action ? action.group : '',
        color: action ? action.color : '#93aabd',
        tint: action ? action.tint : 'rgba(147,170,189,.16)',
        count: points.length,
        best: max ? `${max}` : '—',
        latest: points.length ? `${points[points.length - 1].value}` : '—',
        points: points.map(point => ({
          date: formatDateCn(point.date).slice(5),
          value: point.value
        }))
      };
    });
    this.setData({ tracked, hasRecords }, () => {
      tracked.forEach(tr => {
        if (tr.points.length) this.drawChart(tr);
      });
    });
  },

  /* ---------- 折线统计图 ---------- */

  drawChart(tr) {
    const query = wx.createSelectorQuery().in(this);
    query.select(`#chart-${tr.id}`).fields({ node: true, size: true }).exec(res => {
      const hit = res && res[0];
      if (!hit || !hit.node) return;
      const canvas = hit.node;
      const ctx = canvas.getContext('2d');
      const info = wx.getSystemInfoSync();
      const dpr = info.pixelRatio || 2;
      const width = hit.width;
      const height = hit.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      const pts = tr.points;
      const padL = 44;
      const padR = 16;
      const padT = 30;
      const padB = 30;
      const w = width - padL - padR;
      const h = height - padT - padB;
      if (w <= 0 || h <= 0) return;
      const maxV = pts.reduce((m, p) => Math.max(m, p.value), 0) || 1;
      const xAt = index => padL + (pts.length === 1 ? w / 2 : (index / (pts.length - 1)) * w);
      const yAt = value => padT + h - (value / maxV) * h;

      ctx.clearRect(0, 0, width, height);

      /* 横向网格 + 纵轴读数 */
      ctx.strokeStyle = '#c9dce9';
      ctx.fillStyle = '#7a95ac';
      ctx.lineWidth = 1;
      ctx.font = '16px sans-serif';
      [0, 0.5, 1].forEach(ratio => {
        const gy = padT + h * ratio;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(padL, gy);
        ctx.lineTo(width - padR, gy);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillText(String(Math.round(maxV * (1 - ratio))), 6, gy + 5);
      });

      /* 折线 */
      ctx.strokeStyle = tr.color;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      pts.forEach((point, index) => {
        if (index === 0) ctx.moveTo(xAt(index), yAt(point.value));
        else ctx.lineTo(xAt(index), yAt(point.value));
      });
      ctx.stroke();

      /* 数据点 + 读数 + 日期 */
      ctx.textAlign = 'center';
      pts.forEach((point, index) => {
        const px = xAt(index);
        const py = yAt(point.value);
        ctx.fillStyle = tr.color;
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#173a5e';
        ctx.font = 'bold 17px sans-serif';
        ctx.fillText(String(point.value), px, py - 12);
        ctx.fillStyle = '#7a95ac';
        ctx.font = '15px sans-serif';
        ctx.fillText(point.date, px, height - 8);
      });
      ctx.textAlign = 'left';
    });
  },

  /* ---------- 添加 / 删除追踪动作 ---------- */

  openPicker() {
    const chosen = store.loadTrend().list;
    const items = store.actionList()
      .filter(action => !action.cardio)
      .map(action => Object.assign({}, action, { picked: chosen.indexOf(action.id) >= 0 }));
    this.setData({
      pickerOpen: true,
      pickerItems: items,
      pickerCount: chosen.length
    });
  },

  closePicker() {
    this.setData({ pickerOpen: false });
  },

  togglePick(event) {
    const id = event.currentTarget.dataset.id;
    const items = this.data.pickerItems.map(item => {
      if (item.id !== id) return item;
      return Object.assign({}, item, { picked: !item.picked });
    });
    const count = items.filter(item => item.picked).length;
    if (count > MAX_TRACKED) {
      wx.showToast({ title: `最多追 ${MAX_TRACKED} 个动作`, icon: 'none' });
      return;
    }
    this.setData({ pickerItems: items, pickerCount: count });
  },

  savePicker() {
    const list = this.data.pickerItems.filter(item => item.picked).map(item => item.id);
    store.saveTrend({ list });
    this.setData({ pickerOpen: false });
    this.build();
    if (!list.length) wx.showToast({ title: '已清空追踪', icon: 'none' });
  },

  removeTracked(event) {
    const id = event.currentTarget.dataset.id;
    const rest = store.loadTrend().list.filter(item => item !== id);
    store.saveTrend({ list: rest });
    this.build();
  }
});
