const store = require('../../utils/store');
const handoff = require('../../utils/handoff');
const { EFFORT_STAGES, todayKey } = require('../../utils/util');

const DAY_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const GROUPS = ['胸', '背', '腿', '肩', '手臂', '腹/核心', '有氧'];
const GROUP_FILTERS = ['全部'].concat(GROUPS);

function parsePresets(text, fallback) {
  const list = String(text || '')
    .split(/[,，\s]+/)
    .map(item => Math.floor(Number(item)))
    .filter(num => Number.isFinite(num) && num >= 1 && num <= 99);
  const unique = Array.from(new Set(list)).slice(0, 4);
  return unique.length ? unique : fallback.slice();
}

/* 判重：同一条记录出门再回来，编号或保存时刻总有一个对得上 */
function recordSigns(rec) {
  const signs = [];
  if (rec && typeof rec.id === 'string' && rec.id) signs.push(`id:${rec.id}`);
  const stamp = Number(rec && rec.savedAt);
  if (Number.isFinite(stamp) && stamp > 0) signs.push(`t:${Math.round(stamp)}`);
  return signs;
}

function findSameRecord(db, rec) {
  const signs = recordSigns(rec);
  if (!signs.length) return null;
  const keys = Object.keys(db);
  for (let k = 0; k < keys.length; k += 1) {
    const list = Array.isArray(db[keys[k]]) ? db[keys[k]] : [];
    for (let i = 0; i < list.length; i += 1) {
      const other = recordSigns(list[i]);
      if (other.some(sign => signs.indexOf(sign) >= 0)) return { key: keys[k], rec: list[i] };
    }
  }
  return null;
}

Page({
  data: {
    version: '1.0.3',
    autoClearOnSave: false,
    autoAddAfterCreate: true,
    backfillPrompt: true,
    setsText: '',
    repsText: '',
    startDate: '',
    effortStages: EFFORT_STAGES,

    planDays: [],

    /* 导入判重：发现同一条记录时，问保留还是覆盖 */
    dupOpen: false,
    dupCount: 0,
    dupTotal: 0,

    /* 改一周安排弹窗：七天草稿，就地编辑不跳页 */
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
    planCopyMenu: [],

    customList: [],
    hiddenCount: 0,
    addOpen: false,
    addName: '',
    addGroup: '胸',
    addGroups: GROUPS,

    /* 弹窗筛选：全部 + 各部位 */
    manageOpen: false,
    manageFilter: '全部',
    manageTabs: GROUP_FILTERS.map(key => ({ key, active: key === '全部' })),
    manageItems: []
  },

  onLoad() {
    this.loadAll();
  },

  onShow() {
    this.loadAll();
  },

  noop() {},

  loadAll() {
    const settings = store.loadSettings();
    const plan = store.loadPlan();
    const pool = store.actionList();
    const planDays = DAY_ORDER.map(day => {
      const hit = plan[day] || { name: '', items: [] };
      return {
        day,
        label: DAY_LABEL[day],
        name: hit.name || (hit.items.length ? '有安排' : '休息'),
        count: hit.items.length,
        names: hit.items
          .map(id => pool.find(action => action.id === id))
          .filter(Boolean)
          .slice(0, 3)
          .map(action => action.name)
          .join('、')
      };
    });
    const customList = store.customActions().map(action => ({
      id: action.id,
      name: action.name,
      group: action.group
    }));
    /* 编辑器要用的动作池与安排快照 */
    this.pool = pool;
    this.plan = plan;
    if (this.planEditState && this.planDrafts) {
      this.renderPlanEdit();
    }
    this.setData({
      version: getApp().globalData.version,
      autoClearOnSave: settings.autoClearOnSave,
      autoAddAfterCreate: settings.autoAddAfterCreate,
      backfillPrompt: settings.backfillPrompt,
      setsText: settings.setsPresets.join('、'),
      repsText: settings.repsPresets.join('、'),
      startDate: settings.startDate,
      planDays,
      customList,
      hiddenCount: store.hiddenIds().length
    });
  },

  /* ---------- 操作习惯 ---------- */

  toggleSetting(event) {
    const key = event.currentTarget.dataset.key;
    const settings = store.loadSettings();
    settings[key] = event.detail.value;
    store.saveSettings(settings);
    this.setData({ [key]: settings[key] });
  },

  inputSets(event) {
    this.setData({ setsText: event.detail.value });
  },

  inputReps(event) {
    this.setData({ repsText: event.detail.value });
  },

  saveSets() {
    const settings = store.loadSettings();
    settings.setsPresets = parsePresets(this.data.setsText, [1, 2, 3, 4]);
    store.saveSettings(settings);
    this.setData({ setsText: settings.setsPresets.join('、') });
    wx.showToast({ title: '组数预设已保存', icon: 'success' });
  },

  saveReps() {
    const settings = store.loadSettings();
    settings.repsPresets = parsePresets(this.data.repsText, [6, 8, 12]);
    store.saveSettings(settings);
    this.setData({ repsText: settings.repsPresets.join('、') });
    wx.showToast({ title: '次数预设已保存', icon: 'success' });
  },

  pickStartDate(event) {
    const settings = store.loadSettings();
    settings.startDate = event.detail.value;
    store.saveSettings(settings);
    this.setData({ startDate: settings.startDate });
  },

  clearStartDate() {
    const settings = store.loadSettings();
    settings.startDate = '';
    store.saveSettings(settings);
    this.setData({ startDate: '' });
  },

  /* ---------- 改一周安排：就在设置页编辑，七天草稿 ---------- */

  PLAN_FILTERS: ['全部', '胸', '背', '腿', '肩', '手臂', '腹/核心', '有氧'],

  openPlanEdit(event) {
    const day = Number(event.currentTarget.dataset.day);
    const drafts = {};
    for (let i = 0; i < 7; i += 1) {
      const hit = this.plan[i] || { name: '', items: [] };
      drafts[i] = { name: String(hit.name || ''), items: (hit.items || []).slice() };
    }
    this.planDrafts = drafts;
    this.planEditState = { day, filter: '全部', search: '', copyOpen: false };
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
    /* 连名称带动作一起搬过来 */
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
    const label = DAY_LABEL[this.planEditState.day];
    this.setData({ planEditOpen: false, planCopyOpen: false });
    this.planDrafts = null;
    this.planEditState = null;
    this.loadAll();
    wx.showToast({ title: `${label}的安排已保存`, icon: 'success' });
  },

  /* ---------- 编辑动作 ---------- */

  removeAction(event) {
    const id = event.currentTarget.dataset.id;
    wx.showModal({
      title: '从动作池里去掉',
      content: '已经保存的记录不受影响；正在编排里的这一行也会一起清掉。',
      confirmText: '去掉',
      confirmColor: '#df4c43',
      success: res => {
        if (!res.confirm) return;
        store.removeAction(id);
        this.loadAll();
      }
    });
  },

  restoreBuiltin() {
    store.restoreBuiltin();
    this.loadAll();
    wx.showToast({ title: '自带动作都回来了', icon: 'success' });
  },

  /* ---------- 删除自带动作弹窗 ---------- */

  openManage() {
    this.setData({
      manageOpen: true,
      manageFilter: '全部',
      manageTabs: GROUP_FILTERS.map(key => ({ key, active: key === '全部' })),
      manageItems: this.manageView('全部')
    });
  },

  manageView(filter) {
    return store.actionList()
      .filter(action => !action.custom)
      .filter(action => filter === '全部' || action.group === filter)
      .map(action => ({
        id: action.id,
        name: action.name,
        group: action.group,
        cardio: action.cardio
      }));
  },

  closeManage() {
    this.setData({ manageOpen: false });
  },

  setManageFilter(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({
      manageFilter: key,
      manageTabs: GROUP_FILTERS.map(item => ({ key: item, active: item === key })),
      manageItems: this.manageView(key)
    });
  },

  removePoolAction(event) {
    const id = event.currentTarget.dataset.id;
    const action = store.actionList().find(item => item.id === id);
    if (!action) return;
    wx.showModal({
      title: `删掉「${action.name}」`,
      content: '自带动作会先收起来，想找回时点「恢复自带动作」就行；已经保存的记录不受影响。',
      confirmText: '删除',
      confirmColor: '#df4c43',
      success: res => {
        if (!res.confirm) return;
        store.removeAction(id);
        this.loadAll();
        this.setData({ manageItems: this.manageView(this.data.manageFilter) });
        wx.showToast({ title: `已删掉「${action.name}」`, icon: 'none' });
      }
    });
  },

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
    this.setData({ addOpen: false });
    this.loadAll();
    wx.showToast({ title: '已加进动作池', icon: 'success' });
  },

  /* ---------- 导入 / 导出偏好 ---------- */

  exportPrefs() {
    const settings = store.loadSettings();
    const payload = {
      app: 'fitness-log-generator',
      kind: 'repyneo-prefs',
      schema: 1,
      from: 'RepyNeo',
      version: getApp().globalData.version,
      exportedAt: new Date().toISOString(),
      plan: store.loadPlan(),
      customActions: store.customActions(),
      hiddenActions: store.hiddenIds(),
      settings: {
        autoClearOnSave: settings.autoClearOnSave,
        autoAddAfterCreate: settings.autoAddAfterCreate,
        backfillPrompt: settings.backfillPrompt,
        startDate: settings.startDate,
        setsPresets: settings.setsPresets,
        repsPresets: settings.repsPresets
      }
    };
    const name = `repyneo-prefs-${todayKey()}.json`;
    const path = `${wx.env.USER_DATA_PATH}/${name}`;
    let written = true;
    try {
      wx.getFileSystemManager().writeFileSync(path, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
      written = false;
    }
    if (!written) {
      wx.setClipboardData({
        data: JSON.stringify(payload, null, 2),
        success: () => wx.showToast({ title: '写文件失败，JSON 已复制', icon: 'none' })
      });
      return;
    }
    const parts = [];
    if (payload.plan) parts.push('一周安排');
    if (payload.customActions.length) parts.push(`自建动作 ${payload.customActions.length} 个`);
    handoff
      .shareFile(path, name)
      .then(() => wx.showToast({ title: '发到文件传输助手后，电脑上存下来就能用', icon: 'none' }))
      .catch(() => {
        wx.setClipboardData({
          data: JSON.stringify(payload, null, 2),
          success: () => wx.showToast({ title: '转发失败，JSON 已复制', icon: 'none' })
        });
      });
  },

  importPrefs() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: res => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file || !file.path) {
          wx.showToast({ title: '没选到文件', icon: 'none' });
          return;
        }
        wx.getFileSystemManager().readFile({
          filePath: file.path,
          encoding: 'utf8',
          success: readRes => this.applyPrefs(String(readRes.data || '')),
          fail: () => wx.showToast({ title: '文件读不出来', icon: 'none' })
        });
      }
    });
  },

  applyPrefs(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      wx.showToast({ title: '不是合法的 JSON', icon: 'none' });
      return;
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      wx.showToast({ title: '这份文件不是偏好包', icon: 'none' });
      return;
    }
    if (data.kind && data.kind !== 'repyneo-prefs') {
      wx.showToast({ title: '这份 JSON 不是偏好包', icon: 'none' });
      return;
    }
    const parts = [];
    if (data.plan && typeof data.plan === 'object' && !Array.isArray(data.plan)) {
      store.savePlan(data.plan);
      parts.push('一周安排');
    }
    if (Array.isArray(data.customActions)) {
      const incoming = data.customActions.filter(item =>
        item && typeof item.id === 'string' && typeof item.name === 'string' && GROUPS.indexOf(item.group) >= 0);
      /* 以前是整体替换：手机上独有的自建动作会被这份文件抹掉。改成合并，只补没有的 */
      const mine = store.customActions();
      const byId = new Set(mine.map(item => item.id));
      const byName = new Set(mine.map(item => `${item.name}|${item.group}`));
      let added = 0;
      incoming.forEach(item => {
        const sign = `${item.name}|${item.group}`;
        /* 手机和电脑各建过一次同名同部位的动作：认作同一个，不再多出一份 */
        if (byId.has(item.id) || byName.has(sign)) return;
        byId.add(item.id);
        byName.add(sign);
        mine.push({
          id: item.id,
          name: item.name,
          aliases: typeof item.aliases === 'string' ? item.aliases : '',
          group: item.group,
          latest: '',
          priority: Number(item.priority) || 99,
          custom: true
        });
        added += 1;
      });
      if (added) {
        store.write(store.KEYS.custom, mine);
        parts.push(`自建动作 ${added} 个`);
      } else if (incoming.length) {
        parts.push(`自建动作 ${incoming.length} 个都已有`);
      }
    }
    if (Array.isArray(data.hiddenActions)) {
      const mineHidden = new Set(store.hiddenIds());
      let addedHidden = 0;
      data.hiddenActions.forEach(id => {
        if (typeof id !== 'string' || mineHidden.has(id)) return;
        mineHidden.add(id);
        addedHidden += 1;
      });
      if (addedHidden) {
        store.write(store.KEYS.hidden, Array.from(mineHidden));
        parts.push(`隐藏动作 ${addedHidden} 个`);
      }
    }
    if (data.settings && typeof data.settings === 'object') {
      const settings = store.loadSettings();
      ['autoClearOnSave', 'autoAddAfterCreate', 'backfillPrompt', 'startDate', 'setsPresets', 'repsPresets'].forEach(key => {
        if (data.settings[key] !== undefined) settings[key] = data.settings[key];
      });
      store.saveSettings(settings);
      parts.push('设置');
    }
    if (!parts.length) {
      wx.showToast({ title: '这份包里没有能导入的东西', icon: 'none' });
      return;
    }
    store.pruneDraft();
    this.loadAll();
    wx.showToast({ title: `已导入：${parts.join('、')}`, icon: 'none' });
  },

  /* ---------- 记录：导出 / 导入 / 清空 ---------- */

  exportRecords() {
    const db = store.loadRecords();
    if (!Object.keys(db).length) {
      wx.showToast({ title: '还没有记录可导出', icon: 'none' });
      return;
    }
    const payload = {
      app: 'fitness-log-generator',
      kind: 'repyneo-records',
      schema: 1,
      from: 'RepyNeo',
      version: getApp().globalData.version,
      exportedAt: new Date().toISOString(),
      records: db
    };
    const name = `repyneo-records-${todayKey()}.json`;
    const path = `${wx.env.USER_DATA_PATH}/${name}`;
    let written = true;
    try {
      wx.getFileSystemManager().writeFileSync(path, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
      written = false;
    }
    if (!written) {
      wx.setClipboardData({
        data: JSON.stringify(payload, null, 2),
        success: () => wx.showToast({ title: '写文件失败，JSON 已复制', icon: 'none' })
      });
      return;
    }
    handoff
      .shareFile(path, name)
      .then(() => wx.showToast({ title: '发到文件传输助手后，电脑上存下来就能用', icon: 'none' }))
      .catch(() => {
        wx.setClipboardData({
          data: JSON.stringify(payload, null, 2),
          success: () => wx.showToast({ title: '转发失败，JSON 已复制', icon: 'none' })
        });
      });
  },

  importRecords() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: res => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file || !file.path) {
          wx.showToast({ title: '没选到文件', icon: 'none' });
          return;
        }
        wx.getFileSystemManager().readFile({
          filePath: file.path,
          encoding: 'utf8',
          success: readRes => this.applyRecords(String(readRes.data || '')),
          fail: () => wx.showToast({ title: '文件读不出来', icon: 'none' })
        });
      }
    });
  },

  applyRecords(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      wx.showToast({ title: '不是合法的 JSON', icon: 'none' });
      return;
    }
    const records = data && !Array.isArray(data) && typeof data === 'object'
      ? (data.records && typeof data.records === 'object' && !Array.isArray(data.records) ? data.records : null)
      : (data && typeof data === 'object' && Object.keys(data).some(key => /^\d{4}-\d{2}-\d{2}$/.test(key)) ? data : null);
    if (!records) {
      wx.showToast({ title: '这份文件里没有训练记录', icon: 'none' });
      return;
    }
    const incoming = [];
    Object.keys(records).forEach(key => {
      (Array.isArray(records[key]) ? records[key] : []).forEach(rec => {
        if (!rec || typeof rec !== 'object' || !rec.id) return;
        incoming.push({ key, rec });
      });
    });
    if (!incoming.length) {
      wx.showToast({ title: '这份文件里没有训练记录', icon: 'none' });
      return;
    }
    const db = store.loadRecords();
    const dup = incoming.filter(item => findSameRecord(db, item.rec)).length;
    if (dup) {
      /* 先问一句，别自作主张。暂存起来，等用户点了再落盘 */
      this.dupPending = { incoming, dup, total: incoming.length };
      this.setData({ dupOpen: true, dupCount: dup, dupTotal: incoming.length });
      return;
    }
    this.writeRecords(incoming, 'keep');
  },

  /* keep = 保留我这边的；over = 用文件里的覆盖（内容换新，本地编号留着） */
  writeRecords(incoming, policy) {
    const db = store.loadRecords();
    /* 快照：判重只看导进来之前的样子，同一次导入里的新记录不互相挤 */
    const before = {};
    Object.keys(db).forEach(key => {
      before[key] = Array.isArray(db[key]) ? db[key].slice() : [];
    });
    let added = 0;
    let replaced = 0;
    let skipped = 0;
    const days = new Set();
    incoming.forEach(item => {
      const hit = findSameRecord(before, item.rec);
      if (!hit) {
        if (!Array.isArray(db[item.key])) db[item.key] = [];
        db[item.key].push(item.rec);
        added += 1;
        days.add(item.key);
        return;
      }
      if (policy !== 'over') {
        skipped += 1;
        return;
      }
      const list = Array.isArray(db[hit.key]) ? db[hit.key] : [];
      const at = list.findIndex(rec => rec && rec.id === (hit.rec && hit.rec.id));
      if (at < 0) {
        skipped += 1;
        return;
      }
      list[at] = Object.assign({}, item.rec, { id: (hit.rec && hit.rec.id) || item.rec.id, savedDate: hit.key });
      replaced += 1;
      days.add(hit.key);
    });
    if (added || replaced) store.saveRecords(db);
    if (!added && !replaced) {
      wx.showToast({ title: `${skipped} 条都已经在了`, icon: 'none' });
      return;
    }
    if (replaced) {
      wx.showToast({ title: `新增 ${added} 条，覆盖 ${replaced} 条`, icon: 'none' });
      return;
    }
    wx.showToast({ title: `已导入 ${added} 条记录（${days.size} 天）`, icon: 'none' });
  },

  dupKeep() {
    this.finishDup('keep');
  },

  dupOver() {
    this.finishDup('over');
  },

  cancelDup() {
    this.dupPending = null;
    this.setData({ dupOpen: false });
  },

  finishDup(policy) {
    const pending = this.dupPending;
    this.dupPending = null;
    this.setData({ dupOpen: false });
    if (!pending) return;
    this.writeRecords(pending.incoming, policy);
  },

  clearAllRecords() {
    const doClear = () => {
      wx.showModal({
        title: '最后确认一次',
        content: '真的要清空所有训练记录吗？这一步没有后悔药，建议先「导出记录」留一份。',
        confirmText: '全部清空',
        confirmColor: '#df4c43',
        success: res => {
          if (!res.confirm) return;
          store.saveRecords({});
          wx.showToast({ title: '记录已清空', icon: 'success' });
        }
      });
    };
    wx.showModal({
      title: '清空所有训练记录',
      content: '所有日子的记录都会被删掉，动作池和一周安排不受影响。确定要继续吗？',
      confirmText: '继续',
      confirmColor: '#df4c43',
      success: res => {
        if (res.confirm) doClear();
      }
    });
  }
});
