const store = require('../../utils/store');
const handoff = require('../../utils/handoff');
const { PACE_UNITS } = require('../../utils/pool');
const {
  EFFORT_STAGES,
  uid,
  todayKey,
  clampEffort,
  effortInfo,
  textFromItems
} = require('../../utils/util');

const DAY_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function emptyLoad(action) {
  if (action && action.cardio) {
    return { uid: uid('seg'), spec: '', pace: '', paceUnit: 'km/h', extra: '' };
  }
  return {
    uid: uid('load'),
    weight: '',
    eachSide: false,
    sets: 3,
    setsExplicit: false,
    repMode: 'same',
    sameRep: '',
    reps: ['', '', ''],
    target: '12'
  };
}

Page({
  data: {
    botLine: '你好，我是RepyNeo。\n选动作、定组次、保存复制。',

    /* 补记录：从复盘页带过来的那一天 */
    backfillDate: '',
    backfillLabel: '',

    dayTabs: [],
    planName: '',
    planItems: [],
    planEmpty: true,
    poolOpen: false,
    search: '',
    groupTabs: [],
    activeGroup: '全部',
    poolItems: [],
    selected: [],
    selectedCount: 0,
    summary: '0 个动作 · 0 组',
    effort: 0,
    effortName: '',
    effortStatus: '点一根柱子，给这次训练留个感受',
    effortLevels: [],
    effortStages: EFFORT_STAGES,
    preview: '先从上方选择动作。',
    setsPresets: [1, 2, 3, 4],
    repsPresets: [6, 8, 12],
    paceUnits: PACE_UNITS,

    noteOpen: false,
    noteUid: '',
    noteText: '',

    addOpen: false,
    addName: '',
    addGroup: '胸',
    addGroups: ['胸', '背', '腿', '肩', '手臂', '腹/核心', '有氧'],

    /* 改一周安排：七天 drafts，和桌面版同一套 */
    planEditOpen: false,
    planEditDay: 1,
    planEditLabel: '周一',
    planEditName: '',
    planEditFilter: '全部',
    planEditSearch: '',
    planEditTabs: [],
    planEditGroupTabs: [],
    planEditItems: [],
    planEditPicked: [],
    planEditPickedCount: 0,
    planCopyOpen: false,
    planCopyMenu: []
  },

  onLoad() {
    const draft = store.loadDraft();
    const settings = store.loadSettings();
    this.settings = settings;
    this.pool = store.actionList();
    this.plan = store.loadPlan();
    this.state = {
      activeDay: draft.activeDay,
      activeGroup: '全部',
      effort: draft.effort,
      selected: draft.selected.map(entry => this.decorateEntry(Object.assign({ loads: [] }, entry)))
    };
    this.syncAll();
    this.syncBackfill();
  },

  onShow() {
    this.settings = store.loadSettings();
    this.pool = store.actionList();
    this.plan = store.loadPlan();
    this.syncAll();
    this.syncBackfill();
  },

  /* ---------- 补记录提示条（同桌面版 backfill-bar） ---------- */

  syncBackfill() {
    const state = store.loadBackfill();
    const date = state.armed ? state.date : '';
    this.setData({
      backfillDate: date,
      backfillLabel: date ? this.backfillLabelOf(date) : ''
    });
  },

  backfillLabelOf(key) {
    const [year, month, day] = String(key).split('-').map(Number);
    return `${year} 年 ${month} 月 ${day} 日`;
  },

  cancelBackfill() {
    store.clearBackfill();
    this.syncBackfill();
    wx.showToast({ title: '已取消补记', icon: 'none' });
  },

  /* ---------- 数据加工 ---------- */

  noop() {},

  decorateEntry(entry) {
    const action = this.pool.find(item => item.id === entry.actionId);
    return Object.assign({}, entry, {
      action,
      name: action ? action.name : entry.actionId,
      group: action ? action.group : '',
      color: action ? action.color : '#93aabd',
      tint: action ? action.tint : 'rgba(147,170,189,.16)',
      cardio: action ? action.cardio : false
    });
  },

  /* 渲染用副本：把 action 信息摊平，wxml 里就不用查表 */
  renderEntry(entry) {
    const action = entry.action || {};
    return {
      uid: entry.uid,
      actionId: entry.actionId,
      name: action.name || entry.actionId,
      group: action.group || '',
      color: action.color || '#93aabd',
      tint: action.tint || 'rgba(147,170,189,.16)',
      cardio: Boolean(action.cardio),
      isKey: Boolean(entry.isKey),
      note: entry.note || '',
      loads: (entry.loads || []).map(load => ({
        uid: load.uid,
        weight: load.weight || '',
        eachSide: Boolean(load.eachSide),
        sets: load.sets || 3,
        setsExplicit: Boolean(load.setsExplicit),
        repMode: load.repMode === 'custom' ? 'custom' : 'same',
        sameRep: load.sameRep || '',
        reps: (load.reps || []).slice(),
        target: load.target || '12',
        spec: load.spec || '',
        pace: load.pace || '',
        paceUnit: load.paceUnit || 'km/h',
        extra: load.extra || ''
      }))
    };
  },

  previewText() {
    if (!this.state.selected.length) return '先从上方选择动作。';
    const items = this.state.selected.map(entry => ({
      name: entry.name,
      isKey: entry.isKey,
      note: entry.note,
      loads: entry.loads
    }));
    return textFromItems(items);
  },

  summaryText() {
    let sets = 0;
    this.state.selected.forEach(entry => {
      if (entry.cardio) return;
      entry.loads.forEach(load => {
        sets += Math.max(0, Number(load.sets) || 0);
      });
    });
    return `${this.state.selected.length} 个动作 · ${sets} 组`;
  },

  effortView() {
    const current = clampEffort(this.state.effort);
    const info = effortInfo(current);
    return {
      levels: Array.from({ length: 10 }, (_, index) => {
        const level = index + 1;
        const stage = EFFORT_STAGES.find(item => level >= item.from && level <= item.to) || EFFORT_STAGES[0];
        return {
          level,
          color: stage.color,
          height: 64 + (index / 9) * 140,
          on: level === current
        };
      }),
      name: (info || {}).name || '',
      status: info ? `这次是「${info.name}」· ${current} 级` : '点一根柱子，给这次训练留个感受'
    };
  },

  dayTabsView() {
    return DAY_ORDER.map(day => {
      const plan = this.plan[day] || { items: [] };
      return {
        day,
        label: DAY_LABEL[day].replace('周', ''),
        count: plan.items.length,
        active: day === this.state.activeDay
      };
    });
  },

  planView() {
    const day = this.state.activeDay;
    const plan = this.plan[day] || { name: '', items: [] };
    const chosen = new Set(this.state.selected.map(entry => entry.actionId));
    return {
      planName: plan.name || (plan.items.length ? `${DAY_LABEL[day]}的安排` : '今天没有安排，完全休息'),
      planEmpty: plan.items.length === 0,
      items: plan.items.map(id => {
        const action = this.pool.find(item => item.id === id);
        if (!action) return null;
        return {
          id: action.id,
          name: action.name,
          group: action.group,
          color: action.color,
          tint: action.tint,
          cardio: action.cardio,
          picked: chosen.has(action.id)
        };
      }).filter(Boolean)
    };
  },

  groupTabsView() {
    const tabs = [{ key: '全部', label: '全部' }];
    ['胸', '背', '腿', '肩', '手臂', '腹/核心', '有氧'].forEach(group => {
      tabs.push({ key: group, label: group });
    });
    const active = this.data.activeGroup;
    return tabs.map(tab => Object.assign({}, tab, { active: tab.key === active }));
  },

  poolView() {
    const keyword = String(this.data.search || '').trim().toLowerCase();
    const group = this.data.activeGroup;
    const chosen = new Set(this.state.selected.map(entry => entry.actionId));
    const list = this.pool.filter(action => {
      if (group !== '全部' && action.group !== group) return false;
      if (!keyword) return true;
      const hay = `${action.name} ${action.aliases}`.toLowerCase();
      return hay.indexOf(keyword) >= 0;
    });
    return list.map(action => ({
      id: action.id,
      name: action.name,
      aliases: action.aliases,
      group: action.group,
      color: action.color,
      tint: action.tint,
      cardio: action.cardio,
      picked: chosen.has(action.id)
    }));
  },

  syncAll() {
    const effort = this.effortView();
    const plan = this.planView();
    this.setData({
      dayTabs: this.dayTabsView(),
      planName: plan.planName,
      planEmpty: plan.planEmpty,
      planItems: plan.items,
      groupTabs: this.groupTabsView(),
      poolItems: this.poolView(),
      selected: this.state.selected.map(entry => this.renderEntry(entry)),
      selectedCount: this.state.selected.length,
      summary: this.summaryText(),
      effort: clampEffort(this.state.effort),
      effortName: effort.name,
      effortStatus: effort.status,
      effortLevels: effort.levels,
      preview: this.previewText(),
      setsPresets: this.settings.setsPresets,
      repsPresets: this.settings.repsPresets
    });
    this.persist();
  },

  refreshText() {
    this.setData({
      selectedCount: this.state.selected.length,
      summary: this.summaryText(),
      preview: this.previewText()
    });
    this.persist();
  },

  persist() {
    store.saveDraft({
      activeDay: this.state.activeDay,
      effort: this.state.effort,
      selected: this.state.selected.map(entry => ({
        uid: entry.uid,
        actionId: entry.actionId,
        isKey: entry.isKey,
        note: entry.note,
        loads: entry.loads
      }))
    });
  },

  /* ---------- 第一步：选动作 ---------- */

  setDay(event) {
    const day = Number(event.currentTarget.dataset.day);
    this.state.activeDay = day;
    this.syncAll();
  },

  addAction(event) {
    const id = event.currentTarget.dataset.id;
    if (this.state.selected.some(entry => entry.actionId === id)) {
      /* 第一次点按选中，再次点按取消 */
      this.state.selected = this.state.selected.filter(entry => entry.actionId !== id);
      this.syncAll();
      return;
    }
    const action = this.pool.find(item => item.id === id);
    if (!action) return;
    this.state.selected.push({
      uid: uid('action'),
      actionId: id,
      action,
      name: action.name,
      group: action.group,
      color: action.color,
      tint: action.tint,
      cardio: action.cardio,
      isKey: false,
      note: '',
      loads: [emptyLoad(action)]
    });
    this.syncAll();
    wx.vibrateShort({ type: 'light' });
  },

  togglePool() {
    this.setData({ poolOpen: !this.data.poolOpen });
  },

  inputSearch(event) {
    this.setData({ search: event.detail.value, poolItems: this.poolViewWith(event.detail.value, this.data.activeGroup) });
  },

  poolViewWith(search, group) {
    const keyword = String(search || '').trim().toLowerCase();
    const chosen = new Set(this.state.selected.map(entry => entry.actionId));
    return this.pool
      .filter(action => {
        if (group !== '全部' && action.group !== group) return false;
        if (!keyword) return true;
        return `${action.name} ${action.aliases}`.toLowerCase().indexOf(keyword) >= 0;
      })
      .map(action => ({
        id: action.id,
        name: action.name,
        aliases: action.aliases,
        group: action.group,
        color: action.color,
        tint: action.tint,
        cardio: action.cardio,
        picked: chosen.has(action.id)
      }));
  },

  setGroup(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({
      activeGroup: key,
      groupTabs: this.groupTabsViewWith(key),
      poolItems: this.poolViewWith(this.data.search, key)
    });
  },

  groupTabsViewWith(activeKey) {
    return this.groupTabsView().map(tab => Object.assign({}, tab, { active: tab.key === activeKey }));
  },

  /* ---------- 第二步：编排 ---------- */

  removeAction(event) {
    const uidValue = event.currentTarget.dataset.uid;
    this.state.selected = this.state.selected.filter(entry => entry.uid !== uidValue);
    this.syncAll();
  },

  moveAction(event) {
    const uidValue = event.currentTarget.dataset.uid;
    const dir = Number(event.currentTarget.dataset.dir);
    const index = this.state.selected.findIndex(entry => entry.uid === uidValue);
    const next = index + dir;
    if (index < 0 || next < 0 || next >= this.state.selected.length) return;
    const list = this.state.selected;
    const temp = list[index];
    list[index] = list[next];
    list[next] = temp;
    this.syncAll();
  },

  clearAll() {
    if (!this.state.selected.length) return;
    wx.showModal({
      title: '清空编排',
      content: '把当前编排里的动作全部去掉？已经保存的记录不受影响。',
      confirmText: '清空',
      confirmColor: '#df4c43',
      success: res => {
        if (!res.confirm) return;
        this.state.selected = [];
        this.state.effort = 0;
        this.syncAll();
      }
    });
  },

  toggleKey(event) {
    const uidValue = event.currentTarget.dataset.uid;
    const entry = this.state.selected.find(item => item.uid === uidValue);
    if (!entry) return;
    entry.isKey = !entry.isKey;
    if (entry.isKey) {
      /* 关键重量排到最前：插在最后一个关键动作后面，剩下的顺序不动（和桌面版一致） */
      const rest = this.state.selected.filter(item => item !== entry);
      let at = 0;
      rest.forEach((item, index) => {
        if (item.isKey) at = index + 1;
      });
      this.state.selected = rest.slice(0, at).concat([entry], rest.slice(at));
      wx.showToast({ title: '已标为关键重量，排到最前', icon: 'none' });
    } else {
      wx.showToast({ title: '已取消关键重量', icon: 'none' });
    }
    this.syncAll();
  },

  /* 备注 */
  openNote(event) {
    const uidValue = event.currentTarget.dataset.uid;
    const entry = this.state.selected.find(item => item.uid === uidValue);
    if (!entry) return;
    this.setData({ noteOpen: true, noteUid: uidValue, noteText: entry.note || '' });
  },

  inputNote(event) {
    this.setData({ noteText: event.detail.value });
  },

  saveNote() {
    const entry = this.state.selected.find(item => item.uid === this.data.noteUid);
    if (entry) entry.note = String(this.data.noteText || '').trim();
    this.setData({ noteOpen: false, noteUid: '', noteText: '' });
    this.syncAll();
  },

  closeNote() {
    this.setData({ noteOpen: false, noteUid: '', noteText: '' });
  },

  /* 负荷：重量 / 组数 / 每组 */
  findLoad(actionUid, loadUid) {
    const entry = this.state.selected.find(item => item.uid === actionUid);
    if (!entry) return null;
    const load = entry.loads.find(item => item.uid === loadUid);
    return load ? { entry, load } : null;
  },

  inputWeight(event) {
    const hit = this.findLoad(event.currentTarget.dataset.uid, event.currentTarget.dataset.load);
    if (!hit) return;
    hit.load.weight = event.detail.value;
    this.refreshText();
  },

  inputSameRep(event) {
    const hit = this.findLoad(event.currentTarget.dataset.uid, event.currentTarget.dataset.load);
    if (!hit) return;
    hit.load.sameRep = event.detail.value;
    hit.load.reps = hit.load.reps.map(() => event.detail.value);
    this.refreshText();
  },

  inputRep(event) {
    const hit = this.findLoad(event.currentTarget.dataset.uid, event.currentTarget.dataset.load);
    if (!hit) return;
    const index = Number(event.currentTarget.dataset.index);
    hit.load.reps[index] = event.detail.value;
    this.refreshText();
  },

  inputSpec(event) {
    const hit = this.findLoad(event.currentTarget.dataset.uid, event.currentTarget.dataset.load);
    if (!hit) return;
    hit.load.spec = event.detail.value;
    this.refreshText();
  },

  inputPace(event) {
    const hit = this.findLoad(event.currentTarget.dataset.uid, event.currentTarget.dataset.load);
    if (!hit) return;
    hit.load.pace = event.detail.value;
    this.refreshText();
  },

  inputExtra(event) {
    const hit = this.findLoad(event.currentTarget.dataset.uid, event.currentTarget.dataset.load);
    if (!hit) return;
    hit.load.extra = event.detail.value;
    this.refreshText();
  },

  setPaceUnit(event) {
    const hit = this.findLoad(event.currentTarget.dataset.uid, event.currentTarget.dataset.load);
    if (!hit) return;
    hit.load.paceUnit = event.currentTarget.dataset.unit;
    this.refreshText();
    this.syncAll();
  },

  toggleEachSide(event) {
    const hit = this.findLoad(event.currentTarget.dataset.uid, event.currentTarget.dataset.load);
    if (!hit) return;
    hit.load.eachSide = !hit.load.eachSide;
    this.syncAll();
  },

  setSets(event) {
    const hit = this.findLoad(event.currentTarget.dataset.uid, event.currentTarget.dataset.load);
    if (!hit) return;
    const next = Math.max(1, Math.min(12, (Number(hit.load.sets) || 3) + Number(event.currentTarget.dataset.dir)));
    hit.load.sets = next;
    hit.load.setsExplicit = true;
    hit.load.reps = Array.from({ length: next }, (_, index) => hit.load.reps[index] || '');
    this.syncAll();
  },

  applySetsPreset(event) {
    const hit = this.findLoad(event.currentTarget.dataset.uid, event.currentTarget.dataset.load);
    if (!hit) return;
    const next = Number(event.currentTarget.dataset.value);
    hit.load.sets = next;
    hit.load.setsExplicit = true;
    hit.load.reps = Array.from({ length: next }, (_, index) => hit.load.reps[index] || '');
    this.syncAll();
  },

  applyRepsPreset(event) {
    const hit = this.findLoad(event.currentTarget.dataset.uid, event.currentTarget.dataset.load);
    if (!hit) return;
    const value = String(event.currentTarget.dataset.value);
    if (hit.load.repMode === 'custom') {
      hit.load.reps = hit.load.reps.map(() => value);
    } else {
      hit.load.sameRep = value;
      hit.load.reps = hit.load.reps.map(() => value);
    }
    this.refreshText();
    this.syncAll();
  },

  toggleRepMode(event) {
    const hit = this.findLoad(event.currentTarget.dataset.uid, event.currentTarget.dataset.load);
    if (!hit) return;
    const load = hit.load;
    if (load.repMode === 'custom') {
      load.repMode = 'same';
      load.sameRep = load.sameRep || load.reps[0] || '';
      load.reps = Array.from({ length: load.sets }, () => load.sameRep);
    } else {
      load.repMode = 'custom';
      load.reps = Array.from({ length: load.sets }, (_, index) => load.reps[index] || load.sameRep || '');
    }
    this.syncAll();
  },

  /* 一个动作可以有多组重量：新加的一组沿用上一条的组数、预选次数，重量重新填（同桌面版 addLoad） */
  addLoad(event) {
    const uidValue = event.currentTarget.dataset.uid;
    const entry = this.state.selected.find(item => item.uid === uidValue);
    if (!entry || entry.cardio) return;
    const prev = entry.loads[entry.loads.length - 1];
    const sets = Math.max(1, Number(prev && prev.sets) || 3);
    const loadUid = uid('load');
    entry.loads.push({
      uid: loadUid,
      weight: '',
      eachSide: false,
      sets,
      setsExplicit: Boolean(prev && prev.setsExplicit),
      repMode: 'same',
      sameRep: '',
      reps: Array.from({ length: sets }, () => ''),
      target: (prev && prev.target) || '12'
    });
    this.syncAll();
    wx.vibrateShort({ type: 'light' });
    this.scrollToLoad(loadUid);
  },

  removeLoad(event) {
    const hit = this.findLoad(event.currentTarget.dataset.uid, event.currentTarget.dataset.load);
    if (!hit) return;
    if (hit.entry.loads.length <= 1) {
      wx.showToast({ title: '至少留一组', icon: 'none' });
      return;
    }
    hit.entry.loads = hit.entry.loads.filter(load => load.uid !== hit.load.uid);
    this.syncAll();
  },

  /* 新加的一组接在卡片末尾，位置低于当前视口时把它带进来 */
  scrollToLoad(loadUid) {
    wx.nextTick(() => {
      wx.createSelectorQuery()
        .in(this)
        .select(`#load-${loadUid}`)
        .boundingClientRect()
        .selectViewport()
        .scrollOffset()
        .exec(res => {
          const rect = res && res[0];
          const scroll = res && res[1];
          if (!rect || !scroll) return;
          const viewport = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).windowHeight;
          const over = rect.bottom + 24 - viewport;
          if (over > 0) {
            wx.pageScrollTo({ scrollTop: scroll.scrollTop + over, duration: 200 });
          }
        });
    });
  },

  addSegment(event) {
    const uidValue = event.currentTarget.dataset.uid;
    const entry = this.state.selected.find(item => item.uid === uidValue);
    if (!entry) return;
    const prev = entry.loads[entry.loads.length - 1] || { paceUnit: 'km/h' };
    entry.loads.push({
      uid: uid('seg'),
      spec: '',
      pace: '',
      paceUnit: prev.paceUnit || 'km/h',
      extra: ''
    });
    this.syncAll();
  },

  removeSegment(event) {
    const hit = this.findLoad(event.currentTarget.dataset.uid, event.currentTarget.dataset.load);
    if (!hit) return;
    if (hit.entry.loads.length <= 1) {
      wx.showToast({ title: '至少留一段', icon: 'none' });
      return;
    }
    hit.entry.loads = hit.entry.loads.filter(load => load.uid !== hit.load.uid);
    this.syncAll();
  },

  /* ---------- plus：耗能评级 ---------- */

  setEffort(event) {
    const level = Number(event.currentTarget.dataset.level);
    this.state.effort = this.state.effort === level ? 0 : level;
    const view = this.effortView();
    this.setData({
      effort: clampEffort(this.state.effort),
      effortName: view.name,
      effortStatus: view.status,
      effortLevels: view.levels
    });
    this.persist();
  },

  /* ---------- 第三步：保存 / 复制 / 在 Repy 继续 ---------- */

  buildItems() {
    return this.state.selected.map(entry => ({
      actionId: entry.actionId,
      name: entry.name,
      group: entry.group,
      type: entry.cardio ? 'cardio' : 'strength',
      isKey: Boolean(entry.isKey),
      note: String(entry.note || ''),
      loads: entry.loads.map(load => (entry.cardio
        ? {
          spec: String(load.spec || ''),
          pace: String(load.pace || ''),
          paceUnit: load.paceUnit || 'km/h',
          extra: String(load.extra || '')
        }
        : {
          weight: String(load.weight || ''),
          eachSide: Boolean(load.eachSide),
          sets: Number(load.sets) || 1,
          setsExplicit: Boolean(load.setsExplicit),
          repMode: load.repMode === 'custom' ? 'custom' : 'same',
          sameRep: String(load.sameRep || ''),
          reps: (load.reps || []).map(value => String(value || '')),
          target: String(load.target || '')
        }))
    }));
  },

  saveRecord() {
    if (!this.state.selected.length) {
      wx.showToast({ title: '先选动作再保存', icon: 'none' });
      return;
    }
    const items = this.buildItems();
    const effort = clampEffort(this.state.effort);
    const now = Date.now();
    /* 补记录时写进选中的那天，而不是今天（同桌面版 saveCurrentRecord） */
    const backfill = store.loadBackfill();
    const backfillKey = backfill.armed && /^\d{4}-\d{2}-\d{2}$/.test(backfill.date) ? backfill.date : '';
    const key = backfillKey || todayKey();
    const record = {
      id: uid('rec'),
      savedAt: now,
      savedDate: key,
      backfill: Boolean(backfillKey),
      effort,
      text: textFromItems(items),
      items
    };
    store.addRecord(record);
    if (backfillKey) {
      store.clearBackfill();
      this.syncBackfill();
      getApp().globalData.jumpDate = key;
      const [, month, day] = key.split('-').map(Number);
      wx.showToast({ title: `${month} 月 ${day} 日的记录已补上`, icon: 'success' });
    } else {
      wx.showToast({ title: '已保存到复盘', icon: 'success' });
    }
    if (this.settings.autoClearOnSave) {
      this.state.selected = [];
      this.state.effort = 0;
      this.syncAll();
    } else {
      this.syncAll();
    }
  },

  copyText() {
    if (!this.state.selected.length) {
      wx.showToast({ title: '先选动作', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: this.previewText(),
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    });
  },

  /* 在 Repy 继续：写一份桌面版认得的 JSON，发给电脑 */
  continueInRepy() {
    if (!this.state.selected.length) {
      wx.showToast({ title: '先选动作', icon: 'none' });
      return;
    }
    const payload = handoff.buildPayload({
      selected: this.state.selected.map(entry => ({
        actionId: entry.actionId,
        isKey: entry.isKey,
        note: entry.note,
        loads: entry.loads
      })),
      effort: this.state.effort,
      pool: this.pool,
      version: getApp().globalData.version
    });
    let file;
    try {
      file = handoff.writePayload(payload);
    } catch (err) {
      wx.showToast({ title: '文件写不出来', icon: 'none' });
      return;
    }
    const items = payload.draft.items.length;
    wx.showActionSheet({
      alertText: `已生成 ${file.name}（${items} 个动作）`,
      itemList: ['发送到「文件传输助手」', '复制 JSON 内容'],
      success: res => {
        if (res.tapIndex === 0) {
          handoff
            .shareFile(file.path, file.name)
            .then(() => wx.showToast({ title: '发出去后，在电脑上拖进 Repy', icon: 'none' }))
            .catch(() => {
              wx.setClipboardData({
                data: JSON.stringify(payload, null, 2),
                success: () => wx.showToast({ title: '转发失败，JSON 已复制', icon: 'none' })
              });
            });
        } else {
          wx.setClipboardData({
            data: JSON.stringify(payload, null, 2),
            success: () => wx.showToast({ title: 'JSON 已复制', icon: 'success' })
          });
        }
      }
    });
  },

  /* ---------- 添加动作 ---------- */

  openAdd() {
    this.setData({ addOpen: true, addName: '', addGroup: '胸' });
  },

  closeAdd() {
    this.setData({ addOpen: false });
  },

  inputAddName(event) {
    this.setData({ addName: event.detail.value });
  },

  pickAddGroup(event) {
    this.setData({ addGroup: event.currentTarget.dataset.group });
  },

  submitAdd() {
    const name = String(this.data.addName || '').trim();
    if (!name) {
      wx.showToast({ title: '先给动作起个名字', icon: 'none' });
      return;
    }
    store.addCustomAction(name, this.data.addGroup, '');
    this.pool = store.actionList();
    this.setData({ addOpen: false });
    this.syncAll();
    wx.showToast({ title: '已加进动作池', icon: 'success' });
  },

  /* ---------- 改一周安排：七天 drafts，和桌面版同一套 ---------- */

  PLAN_FILTERS: ['全部', '胸', '背', '腿', '肩', '手臂', '腹/核心', '有氧'],

  openPlanEdit(day) {
    const target = Number.isInteger(day) ? day : this.state.activeDay;
    const drafts = {};
    for (let i = 0; i < 7; i += 1) {
      const hit = this.plan[i] || { name: '', items: [] };
      drafts[i] = { name: String(hit.name || ''), items: (hit.items || []).slice() };
    }
    this.planDrafts = drafts;
    this.planEditState = { day: target, filter: '全部', search: '', copyOpen: false };
    this.setData({ planEditOpen: true, planCopyOpen: false });
    this.renderPlanEdit();
  },

  planDraftDay() {
    return this.planDrafts[this.planEditState.day];
  },

  renderPlanEdit() {
    const st = this.planEditState;
    const draft = this.planDraftDay();
    const byId = new Map(this.pool.map(action => [action.id, action]));
    const pickedIds = draft.items.filter(id => byId.has(id));
    const dayTabs = DAY_ORDER.map(day => {
      const count = this.planDrafts[day].items.length;
      return {
        day,
        label: DAY_LABEL[day].replace('周', ''),
        count,
        active: day === st.day,
        isSet: count > 0
      };
    });
    const picked = pickedIds.map((id, index) => {
      const action = byId.get(id);
      return { id, name: action.name, tint: action.tint, index: index + 1 };
    });
    const keyword = String(st.search || '').trim().toLowerCase();
    const items = this.pool
      .filter(action => st.filter === '全部' || action.group === st.filter)
      .filter(action => !keyword || `${action.name} ${action.aliases}`.toLowerCase().indexOf(keyword) >= 0)
      .map(action => ({
        id: action.id,
        name: action.name,
        group: action.group,
        cardio: action.cardio,
        tint: action.tint,
        picked: pickedIds.indexOf(action.id) >= 0
      }));
    const copyMenu = st.copyOpen
      ? DAY_ORDER.map(day => {
        const count = this.planDrafts[day].items.length;
        const label = DAY_LABEL[day].replace('周', '');
        return { day, text: `${label}${count ? ` · ${count}` : ''}`, self: day === st.day };
      })
      : [];
    this.setData({
      planEditDay: st.day,
      planEditLabel: DAY_LABEL[st.day],
      planEditName: draft.name,
      planEditFilter: st.filter,
      planEditSearch: st.search,
      planEditTabs: dayTabs,
      planEditGroupTabs: this.PLAN_FILTERS.map(key => ({ key, active: key === st.filter })),
      planEditItems: items,
      planEditPicked: picked,
      planEditPickedCount: picked.length,
      planCopyOpen: st.copyOpen,
      planCopyMenu: copyMenu
    });
  },

  closePlanEdit() {
    this.setData({ planEditOpen: false, planCopyOpen: false });
    this.planDrafts = null;
    this.planEditState = null;
  },

  pickPlanDay(event) {
    if (!this.planEditState) return;
    this.planEditState.day = Number(event.currentTarget.dataset.day);
    this.planEditState.copyOpen = false;
    this.renderPlanEdit();
  },

  inputPlanName(event) {
    if (!this.planEditState) return;
    /* 只改草稿不重绘，免得输入框光标被顶掉；切天和保存时都会读草稿 */
    this.planDraftDay().name = event.detail.value;
  },

  setPlanFilter(event) {
    if (!this.planEditState) return;
    this.planEditState.filter = event.currentTarget.dataset.key;
    this.renderPlanEdit();
  },

  inputPlanSearch(event) {
    if (!this.planEditState) return;
    this.planEditState.search = event.detail.value;
    this.renderPlanEdit();
  },

  togglePlanItem(event) {
    if (!this.planEditState) return;
    const id = event.currentTarget.dataset.id;
    const draft = this.planDraftDay();
    const at = draft.items.indexOf(id);
    if (at >= 0) draft.items.splice(at, 1);
    else draft.items.push(id);
    this.renderPlanEdit();
  },

  removePlanPicked(event) {
    if (!this.planEditState) return;
    const id = event.currentTarget.dataset.id;
    const draft = this.planDraftDay();
    draft.items = draft.items.filter(item => item !== id);
    this.renderPlanEdit();
  },

  clearPlanPicked() {
    if (!this.planEditState) return;
    this.planDraftDay().items = [];
    this.renderPlanEdit();
    wx.showToast({ title: '这天的动作已清空', icon: 'none' });
  },

  togglePlanCopy() {
    if (!this.planEditState) return;
    this.planEditState.copyOpen = !this.planEditState.copyOpen;
    this.renderPlanEdit();
  },

  copyPlanFrom(event) {
    if (!this.planEditState) return;
    const day = Number(event.currentTarget.dataset.day);
    if (!Number.isInteger(day) || day === this.planEditState.day) return;
    /* 连名称带动作一起搬过来（同桌面版 copyPlanFrom） */
    const source = this.planDrafts[day];
    const target = this.planDraftDay();
    target.name = source.name;
    target.items = source.items.slice();
    this.planEditState.copyOpen = false;
    this.renderPlanEdit();
    wx.showToast({ title: `已照抄${DAY_LABEL[day]}的安排`, icon: 'none' });
  },

  savePlanEdit() {
    if (!this.planEditState) return;
    const valid = new Set(this.pool.map(action => action.id));
    const next = {};
    for (let i = 0; i < 7; i += 1) {
      const draft = this.planDrafts[i];
      next[i] = {
        name: String(draft.name || '').trim(),
        items: draft.items.filter(id => valid.has(id))
      };
    }
    store.savePlan(next);
    this.plan = store.loadPlan();
    const label = DAY_LABEL[this.planEditState.day];
    this.setData({ planEditOpen: false, planCopyOpen: false });
    this.planDrafts = null;
    this.planEditState = null;
    this.syncAll();
    wx.showToast({ title: `${label}的安排已保存`, icon: 'success' });
  }
});
