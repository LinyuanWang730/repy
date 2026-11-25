/**
 * 「在 Repy 继续」：把这次编排写成一份桌面版认得的 JSON。
 *
 * 文件里同时放两样东西：
 *   records —— 一条能直接记进复盘的训练记录（桌面版导入预览读这个）
 *   draft   —— 还没保存的编排（桌面版「第二步继续」读这个）
 * 所以电脑上既能直接存进复盘，也能接着改重量。
 */
const { isCardio } = require('./pool');
const { textFromItems, todayKey, clampEffort } = require('./util');

const KIND = 'repyneo-handoff';

function cleanLoad(load, action) {
  if (isCardio(action)) {
    return {
      spec: String(load.spec || ''),
      pace: String(load.pace || ''),
      paceUnit: String(load.paceUnit || 'km/h'),
      extra: String(load.extra || '')
    };
  }
  return {
    weight: String(load.weight || ''),
    eachSide: Boolean(load.eachSide),
    sets: Number(load.sets) || 1,
    setsExplicit: Boolean(load.setsExplicit),
    repMode: load.repMode === 'custom' ? 'custom' : 'same',
    sameRep: String(load.sameRep || ''),
    reps: Array.isArray(load.reps) ? load.reps.map(item => String(item || '')) : [],
    target: String(load.target || '')
  };
}

function cleanItems(selected, pool) {
  const out = [];
  (selected || []).forEach(entry => {
    const action = (pool || []).find(item => item.id === entry.actionId);
    if (!action) return;
    out.push({
      actionId: action.id,
      name: action.name,
      group: action.group,
      type: action.type || 'strength',
      isKey: Boolean(entry.isKey),
      note: String(entry.note || ''),
      loads: (entry.loads || []).map(load => cleanLoad(load, action))
    });
  });
  return out;
}

/**
 * @param {Object} options {selected, effort, date, pool, version}
 * @returns {Object} 可以直接 JSON.stringify 的对象
 */
function buildPayload(options) {
  const opts = options || {};
  const date = opts.date || todayKey();
  const effort = clampEffort(opts.effort);
  const items = cleanItems(opts.selected, opts.pool);
  const now = Date.now();
  const record = {
    id: `rec-${now.toString(36)}`,
    savedAt: now,
    savedDate: date,
    effort,
    text: textFromItems(items),
    items: items.map(item => JSON.parse(JSON.stringify(item)))
  };
  return {
    app: 'fitness-log-generator',
    kind: KIND,
    schema: 1,
    from: 'RepyNeo',
    version: opts.version || '1.0.3',
    exportedAt: new Date(now).toISOString(),
    date,
    effort,
    records: items.length ? { [date]: [record] } : {},
    draft: { date, effort, items }
  };
}

function fileNameFor(date) {
  return `repyneo-${date || todayKey()}.json`;
}

/** 写到小程序的用户目录，返回文件路径 */
function writePayload(payload) {
  const name = fileNameFor(payload && payload.date);
  const path = `${wx.env.USER_DATA_PATH}/${name}`;
  wx.getFileSystemManager().writeFileSync(path, JSON.stringify(payload, null, 2), 'utf8');
  return { path, name };
}

/** 打开微信的转发面板，把文件发给「文件传输助手」，电脑上就能存下来 */
function shareFile(path, name) {
  return new Promise((resolve, reject) => {
    if (typeof wx.shareFileMessage !== 'function') {
      reject(new Error('当前微信版本不支持发送文件'));
      return;
    }
    wx.shareFileMessage({
      filePath: path,
      fileName: name,
      success: resolve,
      fail: reject
    });
  });
}

module.exports = {
  KIND,
  buildPayload,
  fileNameFor,
  writePayload,
  shareFile
};
