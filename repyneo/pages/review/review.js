const store = require('../../utils/store');
const cal = require('../../utils/calendar');
const { PACE_UNITS, groupColor, groupTint } = require('../../utils/pool');
const {
  todayKey,
  parseDate,
  formatClock,
  formatLoad,
  effortInfo,
  clampEffort,
  textFromItems
} = require('../../utils/util');

const DAY_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const GROUP_FILTERS = ['全部', '胸', '背', '腿', '肩', '手臂', '腹/核心', '有氧'];

/** 从训练起点算「健身已经多少天」，含起点当天 */
function sinceDaysFrom(startDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startDate || ''))) return 0;
  const start = parseDate(startDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
  return diff > 0 ? diff : 0;
}

function itemKeyOf(item) {
  return item.actionId || `${item.name}|${item.group}`;
}

function emptyStrengthLoad() {
  return { weight: '', eachSide: false, sets: 3, repMode: 'same', sameRep: '', reps: ['', '', ''], target: '12' };
}

function emptyCardioLoad() {
  return { spec: '', pace: '', paceUnit: 'km/h', extra: '' };
}

/** 同一个动作的多条重量并成一组，参照桌面版 groupRecordItems */
function groupItems(items, pool) {
  const groups = [];
  const index = new Map();
  (items || []).forEach((item, position) => {
    const key = itemKeyOf(item);
    let hit = index.get(key);
    if (!hit) {
      hit = { key, firstIndex: position, entries: [] };
      index.set(key, hit);
      groups.push(hit);
    }
    hit.entries.push({ item, index: position });
  });
  return groups.map(group => {
    const first = group.entries[0].item;
    const action = pool.find(item => item.id === first.actionId);
    const cardio = first.type === 'cardio';
    const rows = group.entries.map(entry => ({
      index: entry.index,
      text: (entry.item.loads || []).map(formatLoad).filter(Boolean).join(' ＋ ')
        || (cardio ? '未填规格' : '未填重量'),
      note: String(entry.item.note || '')
    }));
    return {
      key: group.key,
      firstIndex: group.firstIndex,
      name: first.name,
      group: first.group,
      color: action ? action.color : groupColor(first.group),
      tint: action ? action.tint : groupTint(first.group),
      cardio,
      isKey: group.entries.some(entry => entry.item.isKey),
      rows
    };
  });
}

Page({
  data: {
    date: todayKey(),
    days: 0,
    count: 0,
    sinceDays: '—',
    records: [],
    hasRecords: false,

    calTitle: '',
    calWeek: [],
    calCells: [],

    /* 补记录（同桌面版：模式 + 选中的日期） */
    backfillArmed: false,
    backfillDate: '',
    backfillTip: '有色块的日子留了记录，点一下看那天的训练',

    paceUnits: PACE_UNITS,

    /* 换动作弹窗 */
    swapOpen: false,
    swapRec: '',
    swapIndex: -1,
    swapSearch: '',
    swapFilter: '全部',
    swapTabs: GROUP_FILTERS.map(key => ({ key, active: key === '全部' })),
    swapItems: [],

    /* 改重量弹窗 */
    leOpen: false,
    leRec: '',
    leIndex: -1,
    leName: '',
    leCardio: false,
    leNote: '',
    leLoads: []
  },

  onLoad() {
    this.calCursor = cal.monthStart();
    this.pool = store.actionList();
    this.loadView(getApp().globalData.jumpDate || todayKey());
  },

  onShow() {
    this.pool = store.actionList();
    const jump = getApp().globalData.jumpDate;
    if (jump) {
      getApp().globalData.jumpDate = '';
      this.loadView(jump);
    } else {
      this.loadView(this.data.date);
    }
  },

  noop() {},

  /* ---------- 页面渲染 ---------- */

  loadView(key) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : todayKey();
    const db = store.loadRecords();
    const list = Array.isArray(db[date]) ? db[date] : [];
    const records = list.map(rec => {
      const level = clampEffort(rec.effort);
      const info = effortInfo(level);
      return {
        id: rec.id,
        time: formatClock(rec.savedAt),
        effort: level,
        effortName: info ? info.name : '',
        effortColor: info ? info.color : '',
        groups: groupItems(rec.items, this.pool)
      };
    });
    let days = 0;
    let count = 0;
    Object.keys(db).forEach(day => {
      const group = Array.isArray(db[day]) ? db[day] : [];
      if (!group.length) return;
      days += 1;
      count += group.length;
    });
    const startDate = store.loadSettings().startDate;
    this.setData({
      date,
      records,
      hasRecords: records.length > 0,
      days,
      count,
      sinceDays: sinceDaysFrom(startDate) || '—'
    });
    this.renderCalendar();
  },

  /** 改一条保存过的记录：改完重拼 text 并落盘 */
  mutateRecord(recId, mutator) {
    const db = store.loadRecords();
    const list = Array.isArray(db[this.data.date]) ? db[this.data.date] : null;
    const rec = list ? list.find(item => item.id === recId) : null;
    if (!rec || !Array.isArray(rec.items)) return null;
    const done = mutator(rec);
    rec.text = textFromItems(rec.items);
    store.saveRecords(db);
    return done === undefined ? rec : done;
  },

  /* ---------- 月历 ---------- */

  renderCalendar() {
    const view = cal.buildMonth(this.calCursor, store.loadRecords());
    const backfill = store.loadBackfill();
    const cells = view.cells.map(cell => Object.assign({}, cell, {
      sel: !cell.empty && cell.key === this.data.date,
      /* 补记录模式：没记录的日子染成浅绿，选中的那天画个圈 */
      canFill: backfill.armed && !cell.empty && !cell.hasRecord && cell.key !== this.data.date,
      isTarget: backfill.armed && Boolean(backfill.date) && cell.key === backfill.date
    }));
    this.setData({
      calTitle: view.title,
      calWeek: view.week,
      calCells: cells,
      backfillArmed: backfill.armed,
      backfillDate: backfill.date,
      backfillTip: backfill.armed
        ? (backfill.date ? '补记录模式 · 点任意一天可以改' : '补记录模式 · 点日历里任意一天，带着那天去撰写')
        : '有色块的日子留了记录，点一下看那天的训练'
    });
  },

  shiftMonth(event) {
    this.calCursor = cal.shiftMonth(this.calCursor, Number(event.currentTarget.dataset.dir));
    this.renderCalendar();
  },

  pickDay(event) {
    const key = event.currentTarget.dataset.key;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
    const backfill = store.loadBackfill();
    if (backfill.armed) {
      /* 记下这一天，带着它回撰写；保存时会写进这天而不是今天 */
      store.saveBackfill({ armed: true, date: key });
      getApp().globalData.jumpDate = key;
      this.loadView(key);
      wx.switchTab({ url: '/pages/write/write' });
      return;
    }
    this.loadView(key);
  },

  /* ---------- 补记录（同桌面版 startBackfill / cancelBackfill） ---------- */

  toggleBackfill() {
    const cur = store.loadBackfill();
    if (cur.armed) {
      store.clearBackfill();
      this.renderCalendar();
      wx.showToast({ title: '已退出补记录', icon: 'none' });
      return;
    }
    store.saveBackfill({ armed: true, date: '' });
    this.renderCalendar();
    /* 设置里可以关掉说明窗，关掉后直接选日期（同桌面版 setBackfillPrompt） */
    if (store.loadSettings().backfillPrompt !== false) {
      wx.showModal({
        title: '可以补记录了',
        content: '日历里没有记录的日子会变绿。点其中任意一天，就会带着那一天回到「撰写」；编排好点「保存本次训练」，这天就补上了。',
        showCancel: false,
        confirmText: '知道了'
      });
    }
  },

  goToday() {
    this.calCursor = cal.monthStart();
    this.loadView(todayKey());
  },

  /* ---------- 起点日 ---------- */

  pickStart(event) {
    const value = event.detail.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const settings = store.loadSettings();
    settings.startDate = value;
    store.saveSettings(settings);
    this.setData({ sinceDays: sinceDaysFrom(value) || '—' });
    wx.showToast({ title: '起点日已更新', icon: 'success' });
  },

  /* ---------- 记录级 ---------- */

  deleteRecord(event) {
    const id = event.currentTarget.dataset.id;
    wx.showModal({
      title: '删掉这条记录',
      content: '只删这一条，别的记录和当前编排都不动。',
      confirmText: '删除',
      confirmColor: '#df4c43',
      success: res => {
        if (!res.confirm) return;
        store.removeRecord(this.data.date, id);
        this.loadView(this.data.date);
        wx.showToast({ title: '已删除', icon: 'success' });
      }
    });
  },

  /** 删掉记录里的一个动作；删空了整条记录一起消失（和桌面版一致） */
  deleteRecordItem(event) {
    const recId = event.currentTarget.dataset.rec;
    const index = Number(event.currentTarget.dataset.index);
    wx.showModal({
      title: '删掉这个动作',
      content: '这个动作连它的重量组次一起从这条记录里去掉。',
      confirmText: '删除',
      confirmColor: '#df4c43',
      success: res => {
        if (!res.confirm) return;
        const db = store.loadRecords();
        const list = Array.isArray(db[this.data.date]) ? db[this.data.date] : null;
        const rec = list ? list.find(item => item.id === recId) : null;
        if (!rec || !Array.isArray(rec.items) || !rec.items[index]) return;
        const removed = rec.items.splice(index, 1)[0];
        if (!rec.items.length) {
          store.removeRecord(this.data.date, recId);
        } else {
          rec.text = textFromItems(rec.items);
          store.saveRecords(db);
        }
        this.loadView(this.data.date);
        wx.showToast({ title: `已删掉「${removed.name}」`, icon: 'none' });
      }
    });
  },

  /* ---------- 关键重量（和桌面版同款） ---------- */

  askRecordKey(event) {
    const recId = event.currentTarget.dataset.rec;
    const index = Number(event.currentTarget.dataset.index);
    wx.showActionSheet({
      alertText: '标成关键重量',
      itemList: ['只标记', '标记并提到最前'],
      success: res => {
        this.applyRecordKey(recId, index, res.tapIndex === 1);
      }
    });
  },

  applyRecordKey(recId, index, toTop) {
    const done = this.mutateRecord(recId, rec => {
      const picked = rec.items[index];
      if (!picked) return;
      const key = itemKeyOf(picked);
      rec.items.forEach(item => {
        if (itemKeyOf(item) === key) item.isKey = true;
      });
      if (toTop) {
        const moved = rec.items.filter(item => itemKeyOf(item) === key);
        const rest = rec.items.filter(item => itemKeyOf(item) !== key);
        let at = 0;
        rest.forEach((item, position) => {
          if (item.isKey) at = position + 1;
        });
        rec.items = rest.slice(0, at).concat(moved, rest.slice(at));
      }
    });
    if (!done) return;
    this.loadView(this.data.date);
    wx.showToast({ title: toTop ? '已标为关键重量并提到最前' : '已标为关键重量', icon: 'none' });
  },

  clearRecordKey(event) {
    const recId = event.currentTarget.dataset.rec;
    const index = Number(event.currentTarget.dataset.index);
    const done = this.mutateRecord(recId, rec => {
      const picked = rec.items[index];
      if (!picked) return;
      const key = itemKeyOf(picked);
      rec.items.forEach(item => {
        if (itemKeyOf(item) === key) item.isKey = false;
      });
    });
    if (!done) return;
    this.loadView(this.data.date);
    wx.showToast({ title: '已取消关键重量', icon: 'none' });
  },

  /* ---------- 换动作弹窗 ---------- */

  openSwap(event) {
    const recId = event.currentTarget.dataset.rec;
    const index = Number(event.currentTarget.dataset.index);
    this.setData({
      swapOpen: true,
      swapRec: recId,
      swapIndex: index,
      swapSearch: '',
      swapFilter: '全部',
      swapTabs: GROUP_FILTERS.map(key => ({ key, active: key === '全部' })),
      swapItems: this.swapView('', '全部')
    });
  },

  swapView(search, filter) {
    const keyword = String(search || '').trim().toLowerCase();
    return this.pool
      .filter(action => {
        if (filter !== '全部' && action.group !== filter) return false;
        if (!keyword) return true;
        return `${action.name} ${action.aliases}`.toLowerCase().indexOf(keyword) >= 0;
      })
      .map(action => ({
        id: action.id,
        name: action.name,
        group: action.group,
        cardio: action.cardio
      }));
  },

  closeSwap() {
    this.setData({ swapOpen: false, swapRec: '', swapIndex: -1 });
  },

  inputSwapSearch(event) {
    this.setData({ swapSearch: event.detail.value, swapItems: this.swapView(event.detail.value, this.data.swapFilter) });
  },

  setSwapFilter(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({
      swapFilter: key,
      swapTabs: GROUP_FILTERS.map(item => ({ key: item, active: item === key })),
      swapItems: this.swapView(this.data.swapSearch, key)
    });
  },

  pickSwap(event) {
    const id = event.currentTarget.dataset.id;
    const action = this.pool.find(item => item.id === id);
    const recId = this.data.swapRec;
    const index = this.data.swapIndex;
    if (!action || !recId || index < 0) return;
    this.mutateRecord(recId, rec => {
      const item = rec.items[index];
      if (!item) return;
      const wasCardio = item.type === 'cardio';
      item.actionId = action.id;
      item.name = action.name;
      item.group = action.group;
      item.type = action.cardio ? 'cardio' : 'strength';
      /* 力量换成有氧（或反过来），原来的重量组次对不上，重置一条 */
      if (wasCardio !== action.cardio) {
        item.loads = [action.cardio ? emptyCardioLoad() : emptyStrengthLoad()];
      }
    });
    this.closeSwap();
    this.loadView(this.data.date);
    wx.showToast({ title: `已换成「${action.name}」`, icon: 'none' });
  },

  /* ---------- 改重量 / 组次 / 备注弹窗 ---------- */

  openLoadEdit(event) {
    const recId = event.currentTarget.dataset.rec;
    const index = Number(event.currentTarget.dataset.index);
    const db = store.loadRecords();
    const list = Array.isArray(db[this.data.date]) ? db[this.data.date] : null;
    const rec = list ? list.find(item => item.id === recId) : null;
    const item = rec && Array.isArray(rec.items) ? rec.items[index] : null;
    if (!item) return;
    const cardio = item.type === 'cardio';
    const loads = (Array.isArray(item.loads) ? item.loads : []).map(load => cardio
      ? {
        spec: String(load.spec || ''),
        pace: String(load.pace || ''),
        paceUnit: PACE_UNITS.indexOf(load.paceUnit) >= 0 ? load.paceUnit : 'km/h',
        extra: String(load.extra || '')
      }
      : {
        weight: String(load.weight || ''),
        eachSide: Boolean(load.eachSide),
        sets: Math.max(1, Math.floor(Number(load.sets) || 3)),
        repMode: load.repMode === 'custom' ? 'custom' : 'same',
        sameRep: String(load.sameRep || ''),
        reps: (Array.isArray(load.reps) ? load.reps : []).map(value => String(value || '')),
        target: load.target || '12'
      });
    if (!loads.length) loads.push(cardio ? emptyCardioLoad() : emptyStrengthLoad());
    this.leState = { recId, index, cardio, note: String(item.note || ''), loads };
    this.setData({
      leOpen: true,
      leRec: recId,
      leIndex: index,
      leName: item.name,
      leCardio: cardio,
      leNote: this.leState.note,
      leLoads: this.leState.loads.map(load => Object.assign({}, load, { reps: load.reps.slice() }))
    });
  },

  closeLoadEdit() {
    this.leState = null;
    this.setData({ leOpen: false, leRec: '', leIndex: -1, leLoads: [] });
  },

  /* 文本输入：只改内存，不重绘，免得光标被顶掉 */
  leInput(event) {
    const state = this.leState;
    if (!state) return;
    const field = event.currentTarget.dataset.field;
    const block = Number(event.currentTarget.dataset.block);
    const load = state.loads[block];
    if (!load) return;
    if (field === 'weight') load.weight = event.detail.value;
    else if (field === 'sameRep') {
      load.sameRep = event.detail.value;
      load.reps = load.reps.map(() => event.detail.value);
    } else if (field === 'rep') load.reps[Number(event.currentTarget.dataset.rep)] = event.detail.value;
    else if (field === 'spec') load.spec = event.detail.value;
    else if (field === 'pace') load.pace = event.detail.value;
    else if (field === 'extra') load.extra = event.detail.value;
  },

  leNoteInput(event) {
    if (this.leState) this.leState.note = event.detail.value;
  },

  leEachSide(event) {
    const state = this.leState;
    if (!state) return;
    const load = state.loads[Number(event.currentTarget.dataset.block)];
    if (!load) return;
    load.eachSide = !load.eachSide;
    this.setData({ leLoads: state.loads.map(item => Object.assign({}, item, { reps: item.reps.slice() })) });
  },

  leSetsStep(event) {
    const state = this.leState;
    if (!state) return;
    const load = state.loads[Number(event.currentTarget.dataset.block)];
    if (!load) return;
    const next = Math.max(1, Math.min(20, (Number(load.sets) || 3) + Number(event.currentTarget.dataset.dir)));
    load.sets = next;
    load.reps = Array.from({ length: next }, (_, index) => load.reps[index] || '');
    this.setData({ leLoads: state.loads.map(item => Object.assign({}, item, { reps: item.reps.slice() })) });
  },

  leRepMode(event) {
    const state = this.leState;
    if (!state) return;
    const load = state.loads[Number(event.currentTarget.dataset.block)];
    if (!load) return;
    if (load.repMode === 'custom') {
      load.repMode = 'same';
      load.sameRep = load.sameRep || load.reps[0] || '';
      load.reps = Array.from({ length: load.sets }, () => load.sameRep);
    } else {
      load.repMode = 'custom';
      load.reps = Array.from({ length: load.sets }, (_, index) => load.reps[index] || load.sameRep || '');
    }
    this.setData({ leLoads: state.loads.map(item => Object.assign({}, item, { reps: item.reps.slice() })) });
  },

  leUnit(event) {
    const state = this.leState;
    if (!state) return;
    const load = state.loads[Number(event.currentTarget.dataset.block)];
    if (!load) return;
    load.paceUnit = event.currentTarget.dataset.unit;
    this.setData({ leLoads: state.loads.map(item => Object.assign({}, item, { reps: item.reps.slice() })) });
  },

  saveLoadEdit() {
    const state = this.leState;
    if (!state) return;
    this.mutateRecord(state.recId, rec => {
      const item = rec.items[state.index];
      if (!item) return;
      item.loads = state.loads.map(load => state.cardio
        ? {
          spec: String(load.spec || '').trim(),
          pace: String(load.pace || '').trim(),
          paceUnit: PACE_UNITS.indexOf(load.paceUnit) >= 0 ? load.paceUnit : 'km/h',
          extra: String(load.extra || '').trim()
        }
        : (() => {
          const sets = Math.max(0, Math.min(20, Math.floor(Number(load.sets) || 0)));
          return {
            weight: String(load.weight || '').trim(),
            eachSide: Boolean(load.eachSide),
            sets,
            setsExplicit: sets > 0,
            repMode: load.repMode === 'custom' ? 'custom' : 'same',
            sameRep: String(load.sameRep || '').trim(),
            reps: Array.from({ length: sets }, (_, k) => String((load.reps || [])[k] || '').trim()),
            target: load.target || '12'
          };
        })());
      item.note = String(state.note || '').trim();
    });
    this.closeLoadEdit();
    this.loadView(this.data.date);
    wx.showToast({ title: `「${this.data.leName}」已更新`, icon: 'none' });
  }
});
