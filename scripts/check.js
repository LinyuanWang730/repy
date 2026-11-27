const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const OUT = path.join(__dirname, "..", "build");
const logs = [];
const snapshots = [];

/* 上一次自检留下的 profile 先清掉。清不掉（文件被别的 Electron 占着，
   或者本机把 rm 换成了「回收站删除」）就换一个新目录，别让整轮自检崩在主进程 */
let PROFILE = path.join(OUT, ".check-profile");
try {
  fs.rmSync(PROFILE, { recursive: true, force: true });
} catch (err) {
  PROFILE = path.join(OUT, `.check-profile-${Date.now()}`);
  console.warn("[check] profile 清理失败，改用临时目录：", err.message);
}
app.setPath("userData", PROFILE);

function shot(win, name) {
  return win.webContents.capturePage().then(img => {
    fs.writeFileSync(path.join(OUT, `check-${name}.png`), img.toPNG());
  });
}

// 只截一小块（侧栏字标这种），圆片放大看得清发光有没有被遮罩压掉
function shotCrop(win, name, rect) {
  return win.webContents.capturePage(rect).then(img => {
    fs.writeFileSync(path.join(OUT, `check-${name}.png`), img.toPNG());
  });
}

const wait = ms => new Promise(r => setTimeout(r, ms));

ipcMain.handle("app:info", () => ({
  ok: true,
  version: "2.1.3",
  isPackaged: false,
  dataDir: PROFILE,
  snapshotPath: path.join(PROFILE, "agent-snapshot.json"),
  apiOrigin: "http://127.0.0.1:47821",
  exePath: "C:\\check\\Repy.exe"
}));
ipcMain.handle("app:copy", () => true);
ipcMain.handle("app:openDataDir", () => ({ ok: true }));
ipcMain.handle("app:checkUpdate", () => ({ ok: true, status: "latest", current: "2.1.3", message: "已经是最新版 V2.1.3。" }));
ipcMain.handle("app:pickInstaller", () => ({ ok: false, canceled: true }));
ipcMain.handle("app:saveLog", (event, payload) => {
  const text = ["REPORT", JSON.stringify(payload.state || {}, null, 2), "", ...(payload.logs || [])].join("\n");
  const file = path.join(PROFILE, "log-test.txt");
  fs.writeFileSync(file, text, "utf8");
  return { ok: true, path: file };
});
ipcMain.handle("app:shareSetup", () => ({ ok: true, path: "C:////check////Repy-2.1.3-Setup.exe", rebuilt: true, size: 79000000 }));
ipcMain.handle("app:uninstallInfo", () => ({ found: true, file: "C:\\check\\Uninstall Repy.exe", dataDir: PROFILE }));
ipcMain.handle("app:uninstall", () => ({ ok: true, file: "C:\\check\\Uninstall.exe" }));
ipcMain.on("data:snapshot", (event, payload) => snapshots.push(payload));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1400,
    height: 940,
    show: false,
    backgroundColor: "#f3f2ed",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, "..", "preload.js")
    }
  });
  win.webContents.setBackgroundThrottling(false);

  win.webContents.on("console-message", (event, level, message, line, sourceId) => {
    logs.push(`[${level}] ${message} @${line}`);
    if (level >= 2) console.log(`!! ${message} @${line}`);
  });
  win.webContents.on("preload-error", (e, p, err) => logs.push("[preload] " + err.message));
  win.webContents.on("render-process-gone", (e, d) => logs.push("[gone] " + JSON.stringify(d)));

  await win.loadFile(path.join(__dirname, "..", "src", "index.html"));
  await wait(900);
  win.showInactive();
  await wait(400);

  const runErrors = [];
  const run = async code => {
    try {
      return await win.webContents.executeJavaScript(code, true);
    } catch (err) {
      const brief = String(code).replace(/\s+/g, " ").slice(0, 160);
      runErrors.push(brief + " :: " + String(err.message || err).split("\n")[0]);
      console.log("RUN FAILED >>> " + brief);
      return null;
    }
  };
  const report = {};

  // 新导入流程：模拟「选择 JSON 文件」，喂给隐藏的 input 并等 FileReader 读完
  const feedImportFile = async (payload, name = "records.json") => {
    const text = JSON.stringify(JSON.stringify(payload));
    await run(`(() => {
      const dt = new DataTransfer();
      dt.items.add(new File([${text}], ${JSON.stringify(name)}, {type:"application/json"}));
      const input = document.getElementById('importFile');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', {bubbles:true}));
      return true;
    })()`);
    await wait(220);
  };

  report.boot = await run(`(() => ({
    title: document.title,
    planPanelVisible: document.getElementById('planPanel').getBoundingClientRect().height > 0,
    dayTabs: document.querySelectorAll('#dayTabs .day-tab').length,
    dailyCards: document.querySelectorAll('#dailyList .action-choice').length,
    drawerOpen: document.getElementById('poolDrawer').open,
    allCount: document.getElementById('allCount').textContent,
    featureGone: !document.getElementById('featurePop'),
    streakLabel: document.getElementById('streakLabel').textContent,
    streakText: document.getElementById('streakBtn').textContent.replace(/\\s+/g,' ').trim(),
    hasOldWord: document.body.textContent.includes('健身依旧'),
    logCount: document.getElementById('logCount').textContent,
    ovDaysIsButton: document.getElementById('ovDaysBtn').tagName,
    aiStrip: !document.getElementById('aiStrip').hidden,
    presetInputs: document.querySelectorAll('.preset-input').length,
    poolToggleLabel: document.querySelector('#poolToggle .pt-label').textContent,
    poolOpen: document.getElementById('poolDrawer').open
  }))()`);

  await run(`document.getElementById('versionChip').click();`);
  await wait(250);
  await shot(win, "19-release-notes");
  await run(`(() => { const m = document.getElementById('releaseModal'); if (!m.hidden) document.getElementById('releaseClose').click(); })()`);
  await wait(200);
  await shot(win, "01-generator");

  // 气泡：三步 + 第二步下面的 plus 行；新版本屏的标题与三条
  report.bubble211 = await run(`(() => ({
    stepsTitle: document.querySelector('[data-pane="1"] .bubble-hi').textContent.trim(),
    stepMarks: [...document.querySelectorAll('[data-pane="1"] .bubble-steps li b')].map(e => e.textContent.trim()),
    plusRowText: (document.querySelector('[data-pane="1"] .bubble-steps li.is-plus span') || {}).textContent || '',
    plusRowBg: (() => {
      const b = document.querySelector('[data-pane="1"] .bubble-steps li.is-plus b');
      return b ? getComputedStyle(b).backgroundColor : '';
    })(),
    newsTitle: document.querySelector('[data-pane="2"] .bubble-hi').textContent.trim(),
    news: [...document.querySelectorAll('[data-pane="2"] .bubble-news li')].map(e => e.textContent.trim())
  }))()`);

  // 更新日志：三个版本能切，切完清单跟着换
  report.releaseHistory = await run(`(() => {
    const listTabs = () => [...document.querySelectorAll('#releaseTabs .release-tab')].map(b => b.textContent.trim());
    const snap = () => ({
      kicker: document.getElementById('releaseKicker').textContent.trim(),
      title: document.getElementById('releaseTitle').textContent.trim(),
      items: document.querySelectorAll('#releaseList li').length,
      on: (document.querySelector('#releaseTabs .release-tab.is-on') || {}).textContent || ''
    });
    document.getElementById('versionChip').click();
    const first = {tabs: listTabs(), ...snap()};
    document.querySelectorAll('#releaseTabs .release-tab')[1].click();
    const second = snap();
    document.querySelectorAll('#releaseTabs .release-tab')[2].click();
    const third = snap();
    return {first, second, third};
  })()`);
  await wait(320);
  await shot(win, "19b-release-history");

  // 看完更新日志就关掉，后面接着看气泡
  await run(`document.getElementById('releaseOk').click();`);
  await wait(300);

  // 气泡两屏的样子（问候已并入闲聊库，标签只剩两个）
  await run(`document.querySelector('[data-bubble="1"]').click();`);
  await wait(320);
  await run(`document.getElementById('bubbleStage').scrollIntoView({block:'center'})`);
  await wait(200);
  await shot(win, "19d-bubble-steps");
  await run(`document.querySelector('[data-bubble="2"]').click();`);
  await wait(320);
  await shot(win, "19e-bubble-news");

  // 闲聊屏：轮换落到闲聊屏时必须有一句真话
  report.bubbleChat = await run(`(() => ({
    tabs: [...document.querySelectorAll('.bubble-tab')].map(t => t.textContent.trim()),
    tabCount: document.querySelectorAll('.bubble-tab').length,
    chatText: (document.getElementById('bubbleChat') || {}).textContent || '',
    chatSize: getComputedStyle(document.querySelector('[data-pane="0"] .bubble-hello')).fontSize,
    greetKept: [...document.querySelectorAll('.bubble-tab')].every(t => t.textContent.trim() !== '问候')
  }))()`);
  await wait(11500);
  report.bubbleRotate = await run(`(() => ({
    chatShown: !document.querySelector('[data-pane="0"]').hidden,
    chatText: (document.getElementById('bubbleChat') || {}).textContent || '',
    bubbleHeight: Math.round(document.getElementById('repyBubble').getBoundingClientRect().height)
  }))()`);
  await shot(win, "19f-bubble-chat");

  // 展开动作池：底部大按钮
  await run(`document.getElementById('poolToggle').click();`);
  await wait(250);
  report.drawer = await run(`({
    open: document.getElementById('poolDrawer').open,
    cards: document.querySelectorAll('#allList .action-choice').length,
    label: document.querySelector('#poolToggle .pt-label').textContent,
    expanded: document.getElementById('poolToggle').getAttribute('aria-expanded')
  })`);
  // 部位筛选：九个标签排成几行
  await run(`document.getElementById('categoryLine').scrollIntoView({block:'center'})`);
  await wait(300);
  report.poolCats = await run(`(() => {
    const line = document.getElementById('categoryLine');
    const chips = [...line.querySelectorAll('.category-chip')];
    const tops = [...new Set(chips.map(c => Math.round(c.getBoundingClientRect().top)))];
    return {
      chips: chips.map(c => c.textContent.replace(/\\d+$/, '').trim()),
      rows: tops.length,
      lineHeight: Math.round(line.getBoundingClientRect().height)
    };
  })()`);
  await shot(win, "20e-pool-cats");

  await run(`document.getElementById('addActionBtn').scrollIntoView({block:'center'})`);
  await wait(300);
  report.addBtn = await run(`(() => {
    const btn = document.getElementById('addActionBtn');
    const b = btn.getBoundingClientRect();
    const head = document.querySelector('.pool-head').getBoundingClientRect();
    const openBefore = document.getElementById('poolDrawer').open;
    btn.click();
    const openAfter = document.getElementById('poolDrawer').open;
    const modal = !document.getElementById('addActionModal').hidden;
    document.getElementById('addActionCancel').click();
    return {
      btnW: Math.round(b.width),
      headW: Math.round(head.width),
      small: b.width < head.width / 3,
      inHeader: b.top >= head.top - 1 && b.bottom <= head.bottom + 1,
      drawerStays: openBefore === openAfter,
      modal
    };
  })()`);
  await shot(win, "02a-add-button");
  await run(`document.getElementById('poolToggle').scrollIntoView({block:'center'})`);
  await wait(350);
  await shot(win, "02b-pool-toggle");

  // 搜索
  report.search = await run(`(() => {
    const input = document.getElementById('actionSearch');
    input.value = '卧推';
    input.dispatchEvent(new Event('input', {bubbles:true}));
    const hit = document.querySelectorAll('#allList .action-choice').length;
    document.getElementById('searchClear').click();
    return {hits: hit};
  })()`);

  // 一周安排
  await run(`document.getElementById('editPlanBtn').click();`);
  await wait(250);
  report.planModalOpen = await run(`!document.getElementById('planModal').hidden`);
  // 照抄某天：菜单里能看到七天 + 方向说明
  await run(`document.getElementById('planCopyBtn').click()`);
  await wait(200);
  report.planCopy = await run(`({
    menuOpen: !document.getElementById('planCopyMenu').hidden,
    days: document.querySelectorAll('#planCopyMenu [data-plan-copy]').length,
    lead: document.querySelector('#planCopyMenu .plan-copy-lead')?.textContent,
    selfDisabled: Boolean(document.querySelector('#planCopyMenu .is-self[disabled]'))
  })`);
  await shot(win, "03b-plan-copy");
  await run(`document.getElementById('planCopyBtn').click()`);
  await wait(150);
  await run(`(() => {
    document.getElementById('planNameInput').value = '周一 · 自测安排';
    document.getElementById('planNameInput').dispatchEvent(new Event('input', {bubbles:true}));
    [...document.querySelectorAll('#planModalList .plan-pick:not(.is-on)')].slice(0, 3).forEach(p => p.click());
  })()`);
  await wait(250);
  await shot(win, "03-plan-editor");
  report.planDraft = await run(`({
    picked: document.querySelectorAll('#planPicked .picked-chip').length,
    count: document.getElementById('planPickedCount').textContent,
    tabs: document.querySelectorAll('.plan-day-tab').length
  })`);
  await run(`document.getElementById('planSave').click();`);
  await wait(300);
  report.planSaved = await run(`(() => {
    const plan = JSON.parse(localStorage.getItem('fitness-log-week-plan-v1'));
    return {
      closed: document.getElementById('planModal').hidden,
      day1Items: plan['1'].items.length,
      day1Name: plan['1'].name,
      dailyCards: document.querySelectorAll('#dailyList .action-choice').length,
      banner: document.getElementById('planName').textContent
    };
  })()`);

  // 健身起点
  await run(`document.getElementById('streakBtn').click();`);
  await wait(200);
  await run(`(() => {
    document.getElementById('startInput').value = '2026-01-01';
    document.getElementById('startSave').click();
  })()`);
  await wait(300);
  report.startDate = await run(`({
    closed: document.getElementById('startModal').hidden,
    days: document.getElementById('streakDays').textContent,
    label: document.getElementById('streakLabel').textContent,
    stored: JSON.parse(localStorage.getItem('fitness-log-settings-v1')).startDate
  })`);
  await shot(win, "04-generator-streak");

  // 选动作 + 保存 → 记录
  await run(`(() => {
    const cards = [...document.querySelectorAll('#dailyList .action-choice')].slice(0, 3);
    cards.forEach(c => c.click());
    /* 有氧动作没有组次，力量那几条断言要一张力量卡兜底 */
    const strength = document.querySelector('#allList [data-action-id="bench"]');
    if (strength) strength.click();
  })()`);
  await wait(250);
  report.builder = await run(`document.querySelectorAll('.selected-card').length`);

  // 再挂一个有氧动作，第二步的有氧骨架才有得看
  await run(`(() => {
    const chip = [...document.querySelectorAll('#categoryLine .category-chip')].find(e => e.textContent.includes('有氧'));
    if (chip) chip.click();
  })()`);
  await wait(220);
  await run(`(() => {
    const first = document.querySelector('#allList .action-choice');
    if (first && !first.classList.contains('selected')) first.click();
  })()`);
  await wait(220);

  // V2.1.0：步骤条已移除，改为核对新布局
  report.layout = await run(`({
    stepRailGone: !document.getElementById('stepRail'),
    railSteps: document.querySelectorAll('.rail-step').length,
    logo: document.querySelector('.side-logo')?.textContent,
    navLabels: [...document.querySelectorAll('.side-nav-btn .nav-label')].map(e => e.textContent),
    heroBotLoaded: (() => { const i = document.querySelector('.repy-bot'); return Boolean(i && i.complete && i.naturalWidth > 0); })(),
    bubblePanes: document.querySelectorAll('.bubble-pane').length,
    calInRightbar: Boolean(document.querySelector('#rightBar #miniGrid'))
  })`);

  // V2.1.1：新部位 / 有氧卡片 / 编辑动作入口 / plus 步
  report.v211 = await run(`(() => {
    const cardioCard = document.querySelector('.selected-card.is-cardio');
    const plus = document.getElementById('plusPanel');
    const tabs = [...document.querySelectorAll('#categoryLine .category-chip')].map(e => e.textContent.replace(/\\d+$/, '').trim());
    return {
      poolTabs: tabs,
      cardioFields: cardioCard ? [...cardioCard.querySelectorAll('.cardio-field > label')].map(e => e.textContent.trim()) : [],
      paceUnits: cardioCard ? [...cardioCard.querySelectorAll('.pace-unit')].map(e => e.textContent.trim()) : [],
      cardioAddLabel: cardioCard ? cardioCard.querySelector('[data-op="add-load"]').textContent.trim() : '',
      effortLevels: document.querySelectorAll('#effortScale .effort-lv').length,
      effortWidths: [...new Set([...document.querySelectorAll('#effortScale .effort-lv')].map(e => Math.round(e.getBoundingClientRect().width)))],
      plusReadout: document.getElementById('plusReadout').textContent.replace(/\\s+/g, ' ').trim(),
      plusBadge: (document.querySelector('#plusPanel .plus-badge') || {}).textContent || '',
      plusNew: (() => {
        const em = document.querySelector('#plusPanel .plus-new');
        return em ? em.textContent.trim() + ' / ' + getComputedStyle(em).color : '';
      })(),
      plusFrame: getComputedStyle(document.querySelector('#plusPanel .plus-badge')).borderTopWidth,
      effortBg: (() => {
        const b = document.querySelector('#effortScale .effort-lv');
        return b ? getComputedStyle(b).backgroundColor : '';
      })(),
      effortFrosted: (() => {
        const b = document.querySelector('#effortScale .effort-lv');
        if (!b) return '';
        const style = getComputedStyle(b);
        return style.backdropFilter || style.webkitBackdropFilter || '';
      })(),
      partChipBg: (() => {
        const c = document.querySelector('.category-chip') || document.querySelector('.part-btn');
        return c ? getComputedStyle(c).backgroundColor : '';
      })(),
      plusTitleSize: getComputedStyle(document.getElementById('plusTitle')).fontSize,
      plusDesc: document.querySelectorAll('#plusPanel .plus-title p').length,
      plusBetween: (plus && plus.previousElementSibling ? plus.previousElementSibling.id : '?') + ' > ' + (plus && plus.nextElementSibling ? plus.nextElementSibling.id : '?'),
      plusHeight: plus ? Math.round(plus.getBoundingClientRect().height) : 0,
      manageBtn: Boolean(document.getElementById('manageActionBtn')),
      saveGo: document.getElementById('saveGo').textContent
    };
  })()`);
  // 有氧配速单位：默认一个都不选，点一下选上，再点一下取消（RepyNeo 的逻辑）
  report.cardioUnitToggle = await run(`(() => {
    const card = document.querySelector('.selected-card.is-cardio');
    if (!card) return { noCard: true };
    const first = card.querySelector('.pace-unit');
    return { atStart: card.querySelectorAll('.pace-unit.active').length, first: first.textContent.trim() };
  })()`);
  await run(`(() => { const b = document.querySelector('.selected-card.is-cardio .pace-unit'); if (b) b.click(); })()`);
  report.cardioUnitOn = await run(`document.querySelectorAll('.selected-card.is-cardio .pace-unit.active').length`);
  await run(`(() => { const b = document.querySelector('.selected-card.is-cardio .pace-unit'); if (b) b.click(); })()`);
  report.cardioUnitOff = await run(`document.querySelectorAll('.selected-card.is-cardio .pace-unit.active').length`);


  // 编辑动作弹窗：按部位筛选 + 两击删除
  await run(`(() => {
    const card = document.querySelector('.selected-card.is-cardio');
    if (card) card.scrollIntoView({block:'center'});
  })()`);
  await wait(300);
  await shot(win, "04c-cardio-row");

  await run(`document.getElementById('manageActionBtn').click()`);
  await wait(250);
  report.manage = await run(`(() => ({
    open: !document.getElementById('manageActionsModal').hidden,
    items: document.querySelectorAll('#manageList .manage-item').length,
    parts: [...document.querySelectorAll('#manageParts .pick-part')].map(e => e.textContent.trim())
  }))()`);
  await shot(win, "20-manage-actions");
  await run(`(() => {
    const part = [...document.querySelectorAll('#manageParts .pick-part')].find(e => e.textContent.trim() === '有氧');
    if (part) part.click();
  })()`);
  await wait(200);
  report.manageFilter = await run(`(() => ({
    items: document.querySelectorAll('#manageList .manage-item').length,
    names: [...document.querySelectorAll('#manageList .mi-name')].slice(0, 3).map(e => e.textContent.trim())
  }))()`);
  await shot(win, "20b-manage-cardio");
  // 两击删除：先点一次是确认态，再点一次才真删（删完马上撤回，避免影响后面的保存）
  report.manageArm = await run(`(() => {
    const btn = document.querySelector('#manageList [data-manage-del]');
    const id = btn.dataset.manageDel;
    btn.click();
    const armed = document.querySelector('#manageList .manage-del.is-arm');
    return {armed: Boolean(armed), id};
  })()`);
  await run(`(() => {
    const btn = document.querySelector('#manageList .manage-del.is-arm');
    if (btn) btn.click();
    document.getElementById('manageDone').click();
  })()`);
  await wait(250);
  report.manageDeleted = await run(`(() => ({
    modalClosed: document.getElementById('manageActionsModal').hidden,
    total: document.getElementById('allCount').textContent
  }))()`);

  // 恢复自带的动作
  await run(`document.getElementById('manageActionBtn').click()`);
  await wait(200);
  report.manageRestore = await run(`(() => {
    const btn = document.getElementById('manageRestore');
    const shown = !btn.hidden;
    if (shown) btn.click();
    return {restoreShown: shown, total: document.getElementById('allCount').textContent};
  })()`);
  await wait(200);
  await run(`document.getElementById('manageDone').click()`);
  await wait(150);


  // V2.1.0 收尾：统一圆角 / 取消小色条 / 中文不并排英文
  report.polish2 = await run(`(() => {
    const root = document.documentElement;
    const thumb = document.getElementById('dayThumb');
    const mini = document.querySelector('.rightbar .mini-cal');
    return {
      hello: document.querySelector('[data-pane="0"] .bubble-hello')?.textContent,
      helloSize: getComputedStyle(document.querySelector('.bubble-hello')).fontSize,
      noHelloInSteps: !document.querySelector('[data-pane="1"] .bubble-hello'),
      noHelloInNews: !document.querySelector('[data-pane="2"] .bubble-hello'),
      bodyFont: getComputedStyle(document.body).fontFamily,
      muted: getComputedStyle(root).getPropertyValue('--muted').trim(),
      smallFonts: ['.mini-legend','.field label','.rec-part','.day-tab','.bubble-tab']
        .map(s => { const e = document.querySelector(s); return e ? getComputedStyle(e).fontSize : 'none'; }),
      thumbTint: getComputedStyle(thumb).backgroundColor,
      thumbTiming: getComputedStyle(thumb).transitionTimingFunction,
      thumbBackdrop: getComputedStyle(thumb).backdropFilter,
      miniShadow: mini ? getComputedStyle(mini).boxShadow : 'none',
      sbWidth: getComputedStyle(root).getPropertyValue('--sb').trim()
    };
  })()`);

  // 本轮六条
  report.polish3 = await run(`(() => {
    const cs = s => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
    const shell = document.getElementById('shell');
    const root = document.documentElement;
    const gutterBefore = shell.offsetWidth - shell.clientWidth;
    const clientBefore = shell.clientWidth;
    root.classList.add('sb-hover');
    const gutterAfter = shell.offsetWidth - shell.clientWidth;
    const clientAfter = shell.clientWidth;
    root.classList.remove('sb-hover');
    const g = ['胸','背','腿','肩','手臂'].map(k => {
      const e = document.querySelector('.group-' + k);
      return e ? getComputedStyle(e).getPropertyValue('--group-color').trim() : 'none';
    });
    return {
      panes: document.querySelectorAll('.bubble-pane').length,
      tabs: [...document.querySelectorAll('.bubble-tab')].map(e => e.textContent),
      chat: document.querySelector('[data-pane="0"] .bubble-hello')?.textContent,
      chatSize: cs('.bubble-hello')?.fontSize,
      stepsTitle: document.querySelector('[data-pane="1"] .bubble-hi')?.textContent,
      newsTitle: document.querySelector('[data-pane="2"] .bubble-hi')?.textContent,
      newsCount: document.querySelectorAll('[data-pane="2"] .bubble-news li').length,
      partColors: g,
      rbHeadBorder: cs('.rb-head')?.borderBottomWidth,
      tabUserSelect: cs('.day-tab')?.userSelect,
      thumbTiming: cs('.day-thumb')?.transitionTimingFunction,
      thumbDuration: cs('.day-thumb')?.transitionDuration,
      navAlign: cs('.side-nav-btn')?.alignItems,
      navJustify: cs('.side-nav-btn')?.justifyContent,
      navSize: cs('.side-nav-btn')?.fontSize,
      navWeight: cs('.side-nav-btn')?.fontWeight,
      sbGutterBefore: gutterBefore,
      sbGutterAfter: gutterAfter,
      clientDelta: Math.abs(clientAfter - clientBefore)
    };
  })()`);

  // 本轮追加：字号 / 全站黑体 / 新版本屏留白 / 不占布局的滚动条
  report.polish4 = await run(`(() => {
    const cs = s => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
    const panes = [...document.querySelectorAll('.bubble-pane')];
    const heights = panes.map(p => {
      const was = p.hidden;
      p.hidden = false;
      const h = Math.round(p.getBoundingClientRect().height);
      p.hidden = was;
      return h;
    });
    const shell = document.getElementById('shell');
    return {
      navSize: cs('.side-nav-btn')?.fontSize,
      navLetter: cs('.side-nav-btn')?.letterSpacing,
      logoFont: cs('.side-logo')?.fontFamily,
      bodyFont: cs('body')?.fontFamily,
      helloFont: cs('.bubble-hello')?.fontFamily,
      monoFont: cs('.mono')?.fontFamily,
      paneHeights: heights,
      heightSpread: Math.max.apply(null, heights) - Math.min.apply(null, heights),
      stageAlign: cs('.bubble-stage')?.alignItems,
      newsPaneMin: cs('[data-pane="2"]')?.minHeight,
      newsJustify: cs('[data-pane="2"]')?.justifyContent,
      sbOverlay: !!document.querySelector('.sb-overlay'),
      sbThumbWidth: cs('.sb-thumb')?.width,
      sbHoverWidth: (() => {
        for (const sheet of document.styleSheets) {
          let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
          for (const r of rules) {
            if (r.selectorText && r.selectorText.indexOf('.sb-overlay:hover .sb-thumb') >= 0) return r.style.width;
          }
        }
        return 'none';
      })(),
      sbNativeGutter: shell.offsetWidth - shell.clientWidth
    };
  })()`);

  report.bubbleBatch = await run(`(() => {
    const bubble = document.getElementById('repyBubble');
    const cs = getComputedStyle(bubble);
    return {
      stageHeight: Math.round(document.getElementById('bubbleStage').getBoundingClientRect().height),
      bubbleHeight: Math.round(bubble.getBoundingClientRect().height),
      bubbleBg: cs.backgroundColor,
      bubbleBorder: cs.borderTopWidth,
      bubbleTransition: cs.transitionProperty,
      tipColor: getComputedStyle(bubble, '::before').borderRightColor,
      tipAfter: getComputedStyle(bubble, '::after').display,
      thumb: !!document.getElementById('dayThumb'),
      thumbTransition: getComputedStyle(document.getElementById('dayThumb')).transitionProperty,
      stepsTitle: document.querySelector('[data-pane="1"] .bubble-hi').textContent,
      steps: [...document.querySelectorAll('[data-pane="1"] .bubble-steps li')].map(e => e.textContent.replace(/\s+/g,' ').trim()),
      newsTitle: document.querySelector('[data-pane="2"] .bubble-hi').textContent,
      news: [...document.querySelectorAll('[data-pane="2"] .bubble-news li')].map(e => e.textContent.trim())
    };
  })()`);

  const panelTopBefore = await run(`document.getElementById('planPanel').getBoundingClientRect().top`);
  await run(`document.querySelector('[data-bubble="2"]').click();`);
  await wait(500);
  const panelTopAfter = await run(`document.getElementById('planPanel').getBoundingClientRect().top`);
  const bubbleExpanded = await run(`Math.round(document.getElementById('repyBubble').getBoundingClientRect().height)`);
  await run(`document.getElementById('shell').scrollTop = 0;`);
  await wait(180);
  await shot(win, "18-bubble-news");
  await run(`document.querySelector('[data-bubble="1"]').click();`);
  await wait(500);
  const bubbleCompact = await run(`Math.round(document.getElementById('repyBubble').getBoundingClientRect().height)`);
  report.bubbleJitter = {
    panelTopDelta: Math.round(Math.abs(panelTopAfter - panelTopBefore)),
    expandedHeight: bubbleExpanded,
    compactHeight: bubbleCompact
  };

  report.tabsBatch = await run(`(() => {
    const cs = sel => { const e = document.querySelector(sel); return e ? getComputedStyle(e) : null; };
    return {
      tabsRadius: cs('.day-tabs')?.borderTopLeftRadius,
      tabsBg: cs('.day-tabs')?.backgroundColor,
      tabsBorderBottom: cs('.day-tabs')?.borderBottomWidth,
      tabRadius: cs('.day-tab')?.borderTopLeftRadius,
      tabBorder: cs('.day-tab')?.borderRightWidth,
      thumbWidth: Math.round(document.getElementById('dayThumb').getBoundingClientRect().width),
      thumbShadow: cs('.day-thumb')?.boxShadow !== 'none',
      planTabRadius: cs('.plan-day-tab')?.borderTopLeftRadius,
      tabCount: document.querySelectorAll('#dayTabs .day-tab').length
    };
  })()`);


  // 侧栏 Repy 旁的三盏提示灯（竖排）：撰写红 / 复盘黄 / 趋势绿 / 设置三盏全蓝
  report.sideLamp = {};
  for (const lampPage of ['generator','overview','trend','settings']) {
    await run(`document.querySelectorAll('[data-page]').forEach(b => { if (b.dataset.page === '${lampPage}') b.click(); })`);
    await wait(80);
    report.sideLamp[lampPage] = await run(`(() => {
      const lamps = [...document.querySelectorAll('.side-lamps .side-lamp')].map(el => {
        const cs = getComputedStyle(el);
        return { cls: [...el.classList].filter(c => c !== 'side-lamp').join(','), color: cs.backgroundColor, anim: cs.animationName };
      });
      const box = document.querySelector('.side-lamps').getBoundingClientRect();
      const th = document.getElementById('navThumb');
      return {
        page: document.body.dataset.activePage,
        count: lamps.length,
        stacked: Math.round(box.height) > Math.round(box.width),
        lamps,
        thumb: {
          transform: th.style.transform,
          w: th.style.width,
          h: th.style.height,
          tint: th.style.getPropertyValue('--thumb-tint'),
          opacity: th.style.opacity,
          active: document.querySelector('.side-nav-btn.is-current')?.dataset.page || null
        }
      };
    })()`);
  }
  await run(`document.querySelectorAll('[data-page]').forEach(b => { if (b.dataset.page === 'generator') b.click(); });`);

  // 设置页：点标题不该把内容滚回顶部；气泡照片开关要能来回切
  report.settingsTitleScroll = await run(`(() => {
    document.querySelector('[data-page="settings"]').click();
    const shell = document.getElementById('shell');
    shell.scrollTop = 900;
    const before = shell.scrollTop;
    const h = [...document.querySelectorAll('#settingsPage h3')].find(x => x.textContent.includes('操作习惯'));
    if (h) h.click();
    return { before, after: shell.scrollTop };
  })()`);
  report.bubblePhotoSwitch = await run(`(() => {
    const el = document.getElementById('setBubblePhoto');
    const before = el.checked;
    el.click();
    return { before, after: el.checked, stored: JSON.parse(localStorage.getItem('fitness-log-settings-v1') || '{}').bubblePhoto };
  })()`);
  await run(`(() => { const el = document.getElementById('setBubblePhoto'); if (el.checked !== false) el.click(); })()`);
  await run(`document.querySelector('[data-page="generator"]').click()`);

  await wait(420);
  // 两处滑动块都盖在选项卡上、文字压在滑块上，选项卡底色不被撤掉
  report.tabLayers = await run(`(() => {
    const z = sel => getComputedStyle(document.querySelector(sel)).zIndex;
    return {
      dayThumb: z('#dayThumb'), navThumb: z('#navThumb'),
      dayLabel: z('.day-tab .day-label'), navLabel: z('.side-nav-btn .nav-label'),
      daySpeed: getComputedStyle(document.querySelector('#dayThumb')).transitionDuration,
      navSpeed: getComputedStyle(document.querySelector('#navThumb')).transitionDuration
    };
  })()`);

  // 动作名→部位 与 部位→灯 的间距相等
  report.namePartGap = await run(`(() => {
    const card = document.querySelector('.selected-card:not(.is-cardio)');
    const name = card.querySelector('.selected-name strong').getBoundingClientRect();
    const part = card.querySelector('.part-tag').getBoundingClientRect();
    const lamps = card.querySelector('.ec-lamps').getBoundingClientRect();
    return { nameToPart: Math.round(part.left - name.right), partToLamp: Math.round(lamps.left - part.right) };
  })()`);

  // 三盏灯紧跟在动作部位的右边
  report.lampAfterPart = await run(`(() => {
    const name = document.querySelector('.selected-card:not(.is-cardio) .selected-name');
    const part = name.querySelector('.part-tag').getBoundingClientRect();
    const lamps = name.querySelector('.ec-lamps').getBoundingClientRect();
    return {
      count: name.querySelectorAll('.ec-lamp').length,
      afterPart: Math.round(lamps.left) >= Math.round(part.right),
      gap: Math.round(lamps.left - part.right)
    };
  })()`);

  report.loadRowBatch = await run(`(() => {
    const cs = sel => { const e = document.querySelector(sel); return e ? getComputedStyle(e) : null; };
    const lr = cs('.load-row');
    const et = cs('.each-toggle');
    return {
      loadRowLeft: lr ? lr.borderLeftWidth : 'none',
      loadRowBorder: lr ? lr.borderLeftColor : 'none',
      loadRowBg: lr ? lr.backgroundColor : 'none',
      eachToggleDisplay: et ? et.display : 'none',
      eachToggleJustify: et ? et.justifyContent : 'none',
      weightPresetsText: (document.querySelector('.weight-presets')?.textContent || '').trim(),
      streakInMiniCal: Boolean(document.querySelector('.mini-cal .streak')),
      streakBg: cs('.streak')?.backgroundColor,
      streakMarginTop: cs('.streak')?.marginTop
    };
  })()`);

  report.floatBatch = await run(`(() => {
    const cs = sel => getComputedStyle(document.querySelector(sel));
    const ft = document.getElementById('floatTools');
    return {
      kickerGone: !document.querySelector('.bubble-kicker'),
      bubbleTitle: document.querySelector('[data-pane="1"] .bubble-hi').textContent,
      floatWidth: Math.round(ft.getBoundingClientRect().width),
      floatJustify: cs('.float-tools').justifyContent,
      floatPosition: cs('.float-tools').position,
      panelTop: cs('.panel').borderTopWidth,
      panelLeft: cs('.panel').borderLeftWidth,
      sidebarRight: cs('.sidebar').borderRightWidth,
      rightbarLeft: cs('.rightbar').borderLeftWidth,
      setCardTop: cs('.set-card').borderTopWidth,
      heroBottom: cs('.repy-hero').borderBottomWidth,
      dayTabShadow: (() => { const d = document.querySelector('.day-tab.has-plan'); return d ? getComputedStyle(d).boxShadow : 'no-plan'; })()
    };
  })()`);

  report.annotation = await run(`(() => {
    const cs = sel => getComputedStyle(document.querySelector(sel));
    return {
      stripGone: !document.querySelector('.status-strip'),
      taglineGone: !document.querySelector('.side-tagline'),
      logoColor: cs('.side-logo').color,
      floatVisibleOnGenerator: !document.getElementById('floatTools').hidden,
      floatPosition: cs('.float-tools').position,
      statLeft: cs('.ov-stat').borderLeftWidth,
      statTop: cs('.ov-stat').borderTopWidth,
      statRadius: cs('.ov-stat').borderTopLeftRadius,
      hintBorderStyle: cs('.ov-hint').borderTopStyle,
      calPanelTop: cs('.cal-panel').borderTopWidth,
      ovHeadBottom: cs('.ov-head').borderBottomWidth,
      heroBottom: cs('.repy-hero').borderBottomWidth,
      setHeadBottom: cs('.set-head').borderBottomWidth,
      planBannerLeft: cs('.plan-banner').borderLeftWidth,
      gearPath: document.querySelector('.side-gear svg path').getAttribute('d').length,
      siteLabel: document.querySelector('.side-site')?.textContent.trim() || null,
      siteAboveGear: document.querySelector('.side-site')?.nextElementSibling === document.querySelector('.side-gear'),
      siteWidth: Math.round(document.querySelector('.side-site')?.getBoundingClientRect().width || 0),
      siteIpc: typeof window.desktop?.openSite === 'function',
      gearWidth: Math.round(document.querySelector('.side-gear').getBoundingClientRect().width)
    };
  })()`);

  report.polish = await run(`(() => {
    const cs = sel => getComputedStyle(document.querySelector(sel));
    return {
      radius: getComputedStyle(document.documentElement).getPropertyValue('--r').trim(),
      bubbleRadius: cs('.repy-bubble').borderTopLeftRadius,
      navRadius: cs('.side-nav-btn').borderTopLeftRadius,
      heroRadius: cs('.repy-hero').borderTopLeftRadius,
      navSubGone: document.querySelectorAll('.nav-sub').length === 0,
      chipDotGone: getComputedStyle(document.querySelector('.category-chip'), '::before').display === 'none',
      choiceLeftWidth: cs('.action-choice').borderLeftWidth,
      choiceBackground: cs('.action-choice').backgroundColor,
      navBackground: cs('.side-nav-btn').backgroundColor
    };
  })()`);

  // 预选按钮：点击不重建 DOM
  await run(`document.getElementById('builderPanel').scrollIntoView({block:'start'})`);
  await wait(300);
  report.presetNoRerender = await run(`(() => {
    const card = document.querySelector('.selected-card:not(.is-cardio)');
    const btn = card.querySelector('[data-op="set-reps"]');
    const value = btn.dataset.value;
    btn.click();
    const after = document.querySelector('.selected-card:not(.is-cardio)');
    const same = after === card;
    const pressed = card.querySelector('[data-op="set-reps"].active')?.dataset.value;
    return {sameCard: same, activeValue: pressed, clicked: value, sameGrid: Boolean(after)};
  })()`);
  await shot(win, "04b-preset-click");

  // 「分别制定每组」：点开变深蓝、每组输入框整行铺开、行变高，且不重建这一行
  report.repModeToggle = await run(`(() => {
    const row0 = document.querySelector('.selected-card:not(.is-cardio) .load-row');
    const remove0 = row0.querySelector('.load-remove').getBoundingClientRect();
    const btn0 = row0.querySelector('[data-op="toggle-rep-mode"]');
    const t0 = btn0.getBoundingClientRect();
    const before = btn0.textContent.trim();
    btn0.click();
    const row1 = document.querySelector('.selected-card:not(.is-cardio) .load-row');
    const btn1 = row1.querySelector('[data-op="toggle-rep-mode"]');
    const after = btn1.textContent.trim();
    const t1 = btn1.getBoundingClientRect();
    const sameRow = row1 === row0;
    btn1.click();
    return {
      sameRow,
      before, after,
      underRemove: t0.top >= remove0.bottom - 1,
      rightAligned: Math.round(Math.abs(t0.right - remove0.right)),
      widthDelta: Math.round(t0.width - remove0.width),
      layoutStable: Math.round(Math.abs(t1.top - t0.top))
    };
  })()`);

  // 预选与输入框对齐：两排预选都铺满整行，三个灯最右侧一条线
  report.presetAlign = await run(`(() => {
    const row = document.querySelector('.selected-card:not(.is-cardio) .load-row');
    const setsInput = row.querySelector('[data-field="sets"]').getBoundingClientRect();
    const setsPresets = row.querySelector('.sets-presets').getBoundingClientRect();
    const repsField = row.querySelector('.reps-field').getBoundingClientRect();
    const repsPresets = row.querySelector('.reps-presets').getBoundingClientRect();
    return {
      setsDelta: Math.round(Math.abs(setsInput.width - setsPresets.width)),
      repsDelta: Math.round(Math.abs(repsField.width - repsPresets.width)),
      setsButtons: row.querySelectorAll('[data-op="set-sets"]').length,
      repsButtons: row.querySelectorAll('[data-op="set-reps"]').length
    };
  })()`);

  // plus 步：选第 6 级
  await run(`document.getElementById('plusPanel').scrollIntoView({block:'center'})`);
  await wait(280);
  report.effort = await run(`(() => {
    const lv = document.querySelector('#effortScale .effort-lv[data-effort="6"]');
    lv.click();
    const on = document.querySelector('#effortScale .effort-lv.is-on');
    return {
      onButtons: document.querySelectorAll('#effortScale .effort-lv.is-on').length,
      onLevel: on ? on.dataset.effort : '',
      readout: document.getElementById('plusReadout').textContent.replace(/\\s+/g, ' ').trim(),
      onBorder: on ? getComputedStyle(on).borderColor : '',
      onHeight: on ? Math.round(on.getBoundingClientRect().height) : 0
    };
  })()`);
  await shot(win, "20c-plus-effort");

  // 复制按钮也一样：按下就让三盏灯同闪（不看复制成功与否）
  await run(`document.getElementById('copyButton').click();`);
  report.copyLamp = await run(`({
    lampAll: document.body.classList.contains('is-lamp-all'),
    anims: [...document.querySelectorAll('.side-lamp')].map(el => getComputedStyle(el).animationName),
    delays: [...document.querySelectorAll('.side-lamp')].map(el => getComputedStyle(el).animationDelay)
  })`);

  await run(`document.getElementById('saveButton').click();`);
  await wait(350);
  report.saved = await run(`({
    modal: !document.getElementById('saveModal').hidden,
    sub: document.getElementById('saveSub').textContent,
    countdown: document.getElementById('saveCountdown').textContent,
    hasClose: Boolean(document.getElementById('saveClose')),
    checkSvg: Boolean(document.querySelector('#saveModal .save-check svg')),
    goLabel: document.getElementById('saveGo').textContent,
    // 不是咖啡弹窗，侧栏 Repy 字标不该跟着闪
    wordAnimated: getComputedStyle(document.querySelector('.side-logo .side-word')).animationName,
    // 按了「保存本次训练」：三盏灯三种颜色一起亮（sideLampAll 1s，delay 全 0），且要压过弹窗那颗跑圈
    lampAll: document.body.classList.contains('is-lamp-all'),
    lampAnims: [...document.querySelectorAll('.side-lamp')].map(el => {
      const cs = getComputedStyle(el);
      return cs.animationName + '|' + cs.animationDelay + '|' + cs.opacity;
    })
  })`);
  await shot(win, "05-save-modal");
  // 闪满 4 秒自己停：class 摘掉，灯交给还在开着的弹窗继续跑圈
  report.lampAllStop = await run(`(async () => {
    await new Promise(r => setTimeout(r, 4300));
    return {
      lampAll: document.body.classList.contains('is-lamp-all'),
      backTo: [...document.querySelectorAll('.side-lamp')].map(el => getComputedStyle(el).animationName)
    };
  })()`);
  await run(`document.getElementById('saveGo').click();`);
  await wait(500);

  report.overview = await run(`({
    days: document.getElementById('ovDays').textContent,
    count: document.getElementById('ovCount').textContent,
    trainDays: document.getElementById('ovTrainDays').textContent,
    records: document.querySelectorAll('.rec-block').length,
    aiStrip: !document.getElementById('aiStrip').hidden,
    editables: [...document.querySelectorAll('.ov-stat.is-edit')].map(el => el.id),
    floatHiddenOnOverview: document.getElementById('floatTools').hidden
  })`);

  // 复盘 / 趋势新增的入口：小记、体重围度、看趋势、目标、时间范围与部位筛选
  report.newEntries = await run(`(() => {
    const peekBtn = document.querySelector('#dayBody [data-trend-peek]');
    const noteCard = document.querySelector('#dayBody .day-note');
    return {
      dayNoteBtn: document.getElementById('dayNoteBtn').textContent.trim(),
      dayNoteShown: !document.getElementById('dayNoteBtn').hidden,
      calHeadAddGone: document.getElementById('calBackfill') === null,
      hasAddRecord: Boolean(document.getElementById('ovAddRecord')),
      plusNote: Boolean(document.getElementById('plusNoteInput')),
      metrics: Boolean(document.getElementById('dayMetrics')),
      peekBtn: Boolean(peekBtn),
      noteCard: Boolean(noteCard),
      modals: ['dayNoteModal', 'bodyModal', 'trendPeekModal', 'goalModal'].filter(id => !document.getElementById(id)),
      trendRange: document.querySelectorAll('#trRange .tr-chip').length,
      trendParts: document.querySelectorAll('#trParts .pick-part').length,
      trendFiltersHidden: document.getElementById('trFilter').hidden,
      lampParty: document.body.classList.contains('is-lamp-party'),
      sideLamps: [...document.querySelectorAll('.side-lamp')].map(el => getComputedStyle(el).animationName)
    };
  })()`);

  // 复盘：日历按 plus 阶段上色，当日面板显示评级
  report.effortRecord = await run(`(() => {
    const cell = document.querySelector('.cal-cell.has-record');
    return {
      cellEff: cell ? [...cell.classList].filter(c => c.indexOf('eff-') === 0).join(',') : '',
      cellBg: cell ? getComputedStyle(cell).backgroundColor : '',
      dayChips: [...document.querySelectorAll('.rec-effort')].map(e => e.textContent.replace(/\\s+/g, ' ').trim()),
      legendStages: document.querySelectorAll('.cal-legend .lg-eff').length,
      miniColored: document.querySelectorAll('.mini-cell[class*="eff-"]').length,
      emptyCellBg: (() => {
        const plain = [...document.querySelectorAll('.cal-cell:not(.is-empty):not(.has-record)')][0];
        return plain ? getComputedStyle(plain).backgroundColor : '';
      })(),
      recHeadOrder: (() => {
        const meta = document.querySelector('.rec-time .rec-meta');
        return meta ? [...meta.children].map(e => e.className.replace('rec-', '')).join(' > ') : '';
      })(),
      stampIndent: (() => {
        const st = document.querySelector('.rec-effort + .rec-stamp');
        return st ? getComputedStyle(st).paddingLeft : '';
      })(),
      calGap: getComputedStyle(document.getElementById('calGrid')).gap,
      calCellBorder: (() => {
        const c = document.querySelector('.cal-cell:not(.is-empty)');
        if (!c) return '';
        const s2 = getComputedStyle(c);
        return [s2.borderTopWidth, s2.borderRightWidth, s2.borderBottomWidth, s2.borderLeftWidth].join('/');
      })()
    };
  })()`);
  await shot(win, "20d-overview-effort");

  // AI 接入条与下面的记录卡左边缘对齐
  report.aiStripAlign = await run(`(() => {
    const strip = document.getElementById('aiStrip').getBoundingClientRect();
    const rec = document.querySelector('.rec-block').getBoundingClientRect();
    return {
      stripLeft: Math.round(strip.left),
      recLeft: Math.round(rec.left),
      leftDelta: Math.round(strip.left - rec.left),
      rightDelta: Math.round(strip.right - rec.right)
    };
  })()`);

  // 字体：备注框 / 预览区 / 正文都不该出现衬线或等宽
  report.fonts = await run(`(() => {
    const ta = document.querySelector('textarea');
    const pre = document.getElementById('copyPreview');
    const list = {
      body: getComputedStyle(document.body).fontFamily,
      textarea: ta ? getComputedStyle(ta).fontFamily : null,
      pre: getComputedStyle(pre).fontFamily,
      checkGlyph: document.querySelector('#saveModal .save-check').textContent.trim()
    };
    list.serifFree = Object.values(list).filter(v => typeof v === 'string')
      .every(v => !/serif/i.test(v) || /sans-serif/.test(v));
    return list;
  })()`);
  await shot(win, "06-overview");

  // 总览：点「健身已经」开日期弹窗
  await run(`document.getElementById('ovDaysBtn').click();`);
  await wait(250);
  report.ovDaysClick = await run(`!document.getElementById('startModal').hidden`);
  await run(`document.getElementById('startCancel').click();`);
  await wait(150);

  // 总览：训练天数自定义
  await run(`document.getElementById('ovTrainDaysBtn').click();`);
  await wait(250);
  await shot(win, "06b-train-days");
  await run(`(() => {
    const input = document.getElementById('trainDaysInput');
    input.value = '120';
    document.getElementById('trainDaysSave').click();
  })()`);
  await wait(300);
  report.trainDaysCustom = await run(`({
    shown: document.getElementById('ovTrainDays').textContent,
    hint: document.getElementById('ovTrainHint').textContent,
    stored: JSON.parse(localStorage.getItem('fitness-log-settings-v1')).manualTrainDays
  })`);

  // AI 接入条关闭
  await run(`document.getElementById('aiStripClose').click();`);
  await wait(200);
  report.aiStripClosed = await run(`({hidden: document.getElementById('aiStrip').hidden, flag: localStorage.getItem('overview-ai-strip-hidden-v1')})`);
  await shot(win, "06c-overview-closed");

  // 回生成器看迷你日历标记
  await run(`document.querySelector('[data-page="generator"]').click();`);
  await wait(400);
  report.miniMarks = await run(`({
    hasRecord: document.querySelectorAll('.mini-cell.has-record').length,
    hasKey: document.querySelectorAll('.mini-cell.has-key').length,
    selected: document.querySelectorAll('.mini-cell.is-selected').length,
    today: document.querySelectorAll('.mini-cell.is-today').length
  })`);
  await shot(win, "07-mini-marks");

  // 设置页
  await run(`document.querySelector('.side-gear').click();`);
  await wait(500);
  report.settings = await run(`(() => {
    const cards = [...document.querySelectorAll('.set-card')];
    const widths = cards.map(c => Math.round(c.getBoundingClientRect().width));
    const lefts = cards.map(c => Math.round(c.getBoundingClientRect().left));
    return {
      cards: cards.length,
      sameWidth: new Set(widths).size === 1,
      sameLeft: new Set(lefts).size === 1,
      width: widths[0],
      planCount: document.getElementById('setPlanCount').textContent,
      startDate: document.getElementById('setStartDate').textContent,
      trainDays: document.getElementById('setTrainDays').textContent,
      api: document.getElementById('aiApi').textContent,
      updateText: document.getElementById('updateStatus').textContent,
      logCount: document.getElementById('logCount').textContent,
      coffeeCard: Boolean(document.querySelector('.coffee-card')),
      uninstallCard: Boolean(document.querySelector('.danger-card')),
      presetValues: [...document.querySelectorAll('.preset-input')].map(i => i.value),
      sideLabels: [...document.querySelectorAll('.side-nav-btn .nav-label')].map(e => e.textContent)
    };
  })()`);
  await shot(win, "08-settings");

  // V2.1.0 专项：右侧栏 / 气泡 / 导入 / 分享 / 不再提醒
  await run(`document.querySelector('[data-page="settings"]').click();`);
  await wait(300);
  // 设置 · Repy 说：卡片在动作池上面，自带的 9 句也能改，能加能删能恢复
  report.chatSettings = await run(`(() => {
    const cards = [...document.querySelectorAll('#settingsPage .set-card h3')].map(h => h.textContent.trim());
    return {
      cards: cards.slice(0, 4),
      orderOk: cards.indexOf('Repy 说') >= 0 && cards.indexOf('Repy 说') < cards.indexOf('动作池'),
      count: document.getElementById('setChatCount').textContent,
      rows: document.querySelectorAll('#setChatList .chat-row').length,
      first: (document.querySelector('#setChatList .chat-edit') || {}).value || '',
      resetDisabled: document.getElementById('setChatReset').disabled,
      drawerClosed: !document.getElementById('chatDrawer').open,
      noStore: localStorage.getItem('fitness-log-chat-lines-v1') === null
    };
  })()`);
  await run(`document.getElementById('chatDrawer').open = true;`);
  await wait(200);
  await run(`(() => {
    document.getElementById('setChatInput').value = '自测台词：开始训练 【天】 天';
    document.getElementById('setChatAdd').click();
  })()`);
  await wait(260);
  report.chatAdded = await run(`(() => {
    const stored = JSON.parse(localStorage.getItem('fitness-log-chat-lines-v1') || '[]');
    return {
      storedCount: stored.length,
      last: stored[stored.length - 1],
      count: document.getElementById('setChatCount').textContent,
      rows: document.querySelectorAll('#setChatList .chat-row').length,
      cleared: document.getElementById('setChatInput').value === '',
      resetEnabled: !document.getElementById('setChatReset').disabled,
      toast: document.getElementById('toast').textContent
    };
  })()`);
  // 改自带的第一句：边打边存
  await run(`(() => {
    const input = document.querySelectorAll('#setChatList .chat-edit')[0];
    input.value = '改过的第一句';
    input.dispatchEvent(new Event('input', {bubbles:true}));
  })()`);
  await wait(200);
  report.chatEdited = await run(`(() => {
    const stored = JSON.parse(localStorage.getItem('fitness-log-chat-lines-v1') || '[]');
    return {storedFirst: stored[0], count: document.getElementById('setChatCount').textContent};
  })()`);
  await shot(win, "18a-chat-lines");
  await run(`document.querySelector('#setChatList [data-del-chat]').click();`);
  await wait(220);
  report.chatDeleted = await run(`(() => ({
    storedCount: JSON.parse(localStorage.getItem('fitness-log-chat-lines-v1') || '[]').length,
    rows: document.querySelectorAll('#setChatList .chat-row').length
  }))()`);
  // 恢复自带：点两次才盖掉改过的句子
  await run(`document.getElementById('setChatReset').click();`);
  await wait(150);
  report.chatResetArm = await run(`(() => {
    const btn = document.getElementById('setChatReset');
    return {label: btn.textContent.trim(), armed: btn.dataset.armed, red: btn.classList.contains('is-armed')};
  })()`);
  await run(`document.getElementById('setChatReset').click();`);
  await wait(220);
  report.chatReset = await run(`(() => {
    const stored = JSON.parse(localStorage.getItem('fitness-log-chat-lines-v1') || '[]');
    return {
      storedCount: stored.length,
      first: stored[0],
      rows: document.querySelectorAll('#setChatList .chat-row').length,
      count: document.getElementById('setChatCount').textContent,
      disabled: document.getElementById('setChatReset').disabled
    };
  })()`);
  // 收尾：把自测台词清掉，恢复成「从没改过」的状态
  await run(`localStorage.removeItem('fitness-log-chat-lines-v1')`);
  await run(`document.getElementById('rbClose').click();`);
  await wait(250);
  report.rightbarClosed = await run(`document.body.classList.contains('rb-closed')`);
  await run(`document.querySelector('[data-page="generator"]').click();`);
  await wait(200);
  await run(`document.getElementById('calToggle').click();`);
  await wait(250);
  report.rightbarOpened = await run(`!document.body.classList.contains('rb-closed')`);
  await run(`document.querySelector('[data-bubble="2"]').click();`);
  await wait(150);
  report.bubbleSwitch = await run(`({
    pane2: !document.querySelector('[data-pane="2"]').hidden,
    pane0: document.querySelector('[data-pane="0"]').hidden,
    pane1: document.querySelector('[data-pane="1"]').hidden,
    noCountdown: !document.getElementById('bubbleCount'),
    noFoot: !document.querySelector('.bubble-foot'),
    noDots: !document.querySelector('.bubble-dots')
  })`);

  // 点 Repy 本体：回到闲聊屏，并且换了一句
  report.botClick = await run(`(() => {
    const text = () => (document.getElementById('bubbleChat') || {}).textContent || '';
    const before = text();
    document.querySelector('.repy-bot').click();
    const after = text();
    return {
      before,
      after,
      changed: after !== before,
      shown: !document.querySelector('[data-pane="0"]').hidden,
      cursor: getComputedStyle(document.querySelector('.repy-bot')).cursor,
      role: document.querySelector('.repy-bot').getAttribute('role')
    };
  })()`);
  await shot(win, "19g-bubble-click");

  // 伪随机：洗牌袋一轮说全，不会连着重复同一句
  report.chatBag = await run(`(() => {
    const bot = document.querySelector('.repy-bot');
    const text = () => (document.getElementById('bubbleChat') || {}).textContent || '';
    const seen = [];
    for (let i = 0; i < 18; i++){ bot.click(); seen.push(text()); }
    const counts = {};
    seen.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    return {
      draws: seen.length,
      unique: new Set(seen).size,
      noAdjacentRepeat: seen.every((v, i) => i === 0 || v !== seen[i - 1]),
      maxRepeat: Math.max.apply(null, Object.values(counts)),
      sample: seen.slice(0, 5)
    };
  })()`);

  await run(`document.getElementById('setImport').click();`);
  await wait(250);
  report.importModal = await run(`({
    open: !document.getElementById('importModal').hidden,
    schemaLen: document.getElementById('importSchemaText').textContent.length,
    noJsonInput: !document.getElementById('importJson'),
    noSourceInput: !document.getElementById('importSource'),
    hasDrop: Boolean(document.getElementById('importDrop')),
    parseDisabled: document.getElementById('importParse').disabled,
    saveDisabled: document.getElementById('importSaveFile').disabled,
    confirmDisabled: document.getElementById('importConfirm').disabled
  })`);
  await shot(win, "17-import-modal");

  await feedImportFile({records:{"2026-11-08":[{times:"第 1 次",items:[
    {name:"测试卧推",group:"胸",sets:3,reps:10,weight:60},
    {name:"测试划船",group:"背",sets:4,reps:[12,10,8,8],isKey:true}
  ]}]}});
  report.importFile = await run(`({
    fileName: document.getElementById('importFileName').textContent,
    parseEnabled: !document.getElementById('importParse').disabled,
    hint: document.getElementById('importHint').textContent
  })`);
  await run(`document.getElementById('importParse').click();`);
  await wait(250);
  report.importParsed = await run(`({
    preview: !document.getElementById('importPreview').hidden,
    hint: document.getElementById('importHint').textContent,
    enabled: !document.getElementById('importConfirm').disabled,
    translated: document.getElementById('importPreview').textContent.includes('翻译完成'),
    lines: Boolean(document.querySelector('#importPreview .imp-lines')),
    saveBtn: !document.getElementById('importSaveFile').disabled,
    footVisible: (() => {
      const r = document.querySelector('#importModal .form-foot').getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight + 1;
    })(),
    bodyScrolls: document.querySelector('#importModal .import-body').scrollHeight > document.querySelector('#importModal .import-body').clientHeight
  })`);
  await shot(win, "17a-import-preview");
  await run(`document.getElementById('importConfirm').click();`);
  await wait(350);
  report.importDone = await run(`(() => {
    const db = JSON.parse(localStorage.getItem('fitness-log-records-v2') || '{}');
    const r = db['2026-11-08'] && db['2026-11-08'][0];
    return {
      modalClosed: document.getElementById('importModal').hidden,
      hasRecord: Boolean(r), items: r ? r.items.length : 0,
      imported: r ? r.imported : null,
      firstLine: r ? r.text.split('\\n')[0] : '',
      firstLoad: r && r.items[0] ? r.items[0].loads[0] : null
    };
  })()`);
  await run(`document.getElementById('noticeClose').click();`);

  // 翻译层：Repy 导出的备份（loads）不能被翻成空动作
  await run(`document.getElementById('setImport').click();`);
  await feedImportFile({app:"fitness-log-generator", version:"2.1.0", records:{"2026-11-09":[{
    savedAt:1762728000000, text:"备份卧推 60KG（4 组：12 / 12 / 10 / 8）", items:[{
      name:"备份卧推", group:"胸", isKey:false, note:"", loads:[{
        weight:"60", eachSide:false, sets:4, setsExplicit:true,
        repMode:"each", sameRep:"", reps:["12","12","10","8"], target:""
      }]
    }]
  }]}}, "backup.json");
  await run(`document.getElementById('importParse').click();`);
  await wait(200);
  report.importBackup = await run(`({
    lines: document.querySelector('#importPreview .imp-lines') ? document.querySelector('#importPreview .imp-lines').textContent : '',
    enabled: !document.getElementById('importConfirm').disabled
  })`);
  await run(`document.getElementById('importCancel').click();`);

  // 翻译层：外来字段名、非标准日期、中文组次
  await run(`document.getElementById('setImport').click();`);
  await feedImportFile({workouts:[{workoutDate:"2026/11/7", exercises:[
    {动作:"外来深蹲", 部位:"腿部", 组数:3, 次数:"12/10/8", 重量:"80kg", 关键重量:"是"}
  ]}]}, "external.json");
  await run(`document.getElementById('importParse').click();`);
  await wait(200);
  report.importExternal = await run(`({
    lines: document.querySelector('#importPreview .imp-lines') ? document.querySelector('#importPreview .imp-lines').textContent : '',
    hint: document.getElementById('importHint').textContent,
    enabled: !document.getElementById('importConfirm').disabled
  })`);
  await shot(win, "17b-import-external");
  await run(`document.getElementById('importCancel').click();`);

  // 动作池匹配：别名「平板卧推」要落回「杠铃卧推」，有氧走 segments，池里没有的单独提示
  await run(`document.getElementById('setImport').click();`);
  await feedImportFile({records:{"2026-11-11":[{items:[
    {name:"平板卧推",group:"胸",sets:4,reps:[12,12,10,8],weight:60},
    {name:"跑步",group:"有氧",segments:[{spec:"6 km",pace:"10",paceUnit:"km/h",extra:"坡度 8"}]},
    {name:"不存在的动作",group:"背",sets:3,reps:10,weight:40}
  ]}]}}, "pool-match.json");
  await run(`document.getElementById('importParse').click();`);
  await wait(240);
  report.importMatch = await run(`(() => {
    const pick = s => document.querySelector(s);
    const sum = (pick('#importPreview .imp-summary') || {}).textContent || '';
    const gap = (pick('#importPreview .imp-gap') || {}).textContent || '';
    const lines = (pick('#importPreview .imp-lines') || {}).textContent || '';
    return {
      summary: sum,
      matchedTwo: sum.includes('2 个对上了动作池'),
      gap: gap,
      gapOnlyUnknown: gap.includes('不存在的动作') && !gap.includes('平板卧推'),
      aliasMapped: lines.includes('杠铃卧推') && !lines.includes('平板卧推'),
      cardioText: lines.includes('6 km @ 10 km/h'),
      hint: document.getElementById('importHint').textContent,
      schemaHasPool: document.getElementById('importSchemaText').textContent.includes('Repy 动作池'),
      schemaHasAlias: document.getElementById('importSchemaText').textContent.includes('平板卧推')
    };
  })()`);
  await shot(win, "17c-import-pool-match");
  await run(`document.getElementById('importCancel').click();`);

  // 空文件要给得出错误提示，不能静默失败
  await run(`document.getElementById('setImport').click();`);
  await feedImportFile("", "empty.json");
  await run(`document.getElementById('importParse').click();`);
  await wait(150);
  report.importEmpty = await run(`({
    isError: document.getElementById('importPreview').classList.contains('is-error'),
    hint: document.getElementById('importHint').textContent,
    confirmDisabled: document.getElementById('importConfirm').disabled
  })`);
  await run(`document.getElementById('importCancel').click();`);

  await run(`document.getElementById('shareBtn').click();`);
  await wait(500);
  report.share = await run(`({
    status: document.getElementById('shareStatus').textContent,
    notice: !document.getElementById('noticeModal').hidden
  })`);
  await run(`document.getElementById('noticeClose').click();`);
  await shot(win, "17b-share");

  report.backfillPromptSwitch = await run(`({
    hasSwitch: Boolean(document.getElementById('setBackfillPrompt')),
    checked: document.getElementById('setBackfillPrompt').checked
  })`);

  // 快速预选卡片
  await run(`document.getElementById('setsPresetEdit').scrollIntoView({block:'center'})`);
  await wait(300);
  await shot(win, "08d-presets-settings");

  // 咖啡弹窗
  await run(`document.querySelector('.coffee-card').scrollIntoView({block:'center'})`);
  await wait(250);
  await shot(win, "08b-coffee-card");
  await run(`document.getElementById('coffeeBtn').click();`);
  // 1.2s 一圈、三段均分：红 0–.4s / 黄 .4–.8s / 绿 .8–1.2s，各截一张对着看
  await wait(90);
  await shotCrop(win, "08c-coffee-word-red", { x: 0, y: 30, width: 220, height: 120 });
  await wait(380);
  await shotCrop(win, "08c-coffee-word-amber", { x: 0, y: 30, width: 220, height: 120 });
  await wait(400);
  await shotCrop(win, "08c-coffee-word-green", { x: 0, y: 30, width: 220, height: 120 });
  report.coffee = await run(`(() => {
    const img = document.querySelector('.coffee-qr');
    const word = document.querySelector('.side-logo .side-word');
    const wcs = word ? getComputedStyle(word) : null;
    return {open: !document.getElementById('coffeeModal').hidden, loaded: img.complete && img.naturalWidth > 0, w: img.naturalWidth, h: img.naturalHeight,
      wordParty: document.body.classList.contains('is-word-party'),
      wordAnimated: wcs ? wcs.animationName : 'no-word',
      wordColor: wcs ? wcs.color : '',
      wordGlow: wcs ? wcs.textShadow : ''};
  })()`);
  await shot(win, "08c-coffee-modal");
  // 不穿模：遮罩开着的时候，三盏灯和 Repy 字标都必须被遮罩盖住（点上去要命中 .modal-mask）
  report.layering = await run(`(() => {
    const probe = el => {
      if (!el) return 'no-el';
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit) return 'none';
      return hit.closest('.modal-mask') ? 'mask' : (hit.className || hit.tagName);
    };
    return {
      lamp: probe(document.querySelector('.side-lamp.is-red')),
      word: probe(document.querySelector('.side-logo .side-word')),
      lampsZ: getComputedStyle(document.querySelector('.side-lamps')).zIndex,
      wordZ: getComputedStyle(document.querySelector('.side-word')).zIndex,
      maskZ: getComputedStyle(document.querySelector('.modal-mask:not([hidden])')).zIndex
    };
  })()`);
  await run(`document.getElementById('coffeeClose').click();`);
  await wait(200);

  // 咖啡弹窗关掉：字标回到深灰、不动画；别的弹窗也不该动它
  report.coffeeClosed = await run(`(() => {
    const wcs = getComputedStyle(document.querySelector('.side-logo .side-word'));
    return {wordParty: document.body.classList.contains('is-word-party'), wordAnimated: wcs.animationName, wordColor: wcs.color, wordGlow: wcs.textShadow};
  })()`);

  // 预选自定义
  await run(`(() => {
    const boxes = [...document.querySelectorAll('.preset-input[data-preset="reps"]')];
    boxes.forEach((box, i) => { box.value = String([5, 10, 15, 20][i]); });
    boxes[0].dispatchEvent(new Event('change', {bubbles:true}));
  })()`);
  await wait(350);
  report.presetsChanged = await run(`({
    stored: JSON.parse(localStorage.getItem('fitness-log-settings-v1')).repsPresets,
    inputs: [...document.querySelectorAll('.preset-input[data-preset="reps"]')].map(i => i.value)
  })`);

  await run(`document.getElementById('logExport').scrollIntoView({block:'center'})`);
  await wait(300);
  await shot(win, "09-settings-bottom");

  await run(`document.getElementById('uninstallBtn').scrollIntoView({block:'center'})`);
  await wait(300);
  await shot(win, "09c-uninstall");

  // 导出日志
  await run(`document.getElementById('logExport').click();`);
  await wait(600);
  report.logExport = await run(`({
    noticeOpen: !document.getElementById('noticeModal').hidden,
    title: document.getElementById('noticeTitle').textContent,
    text: document.getElementById('noticeText').textContent
  })`);
  await shot(win, "09b-log-export");
  await run(`document.getElementById('noticeOk').click();`);
  await wait(150);

  const logFile = path.join(PROFILE, "log-test.txt");
  report.logFile = {
    exists: fs.existsSync(logFile),
    bytes: fs.existsSync(logFile) ? fs.statSync(logFile).size : 0,
    head: fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8").split("\n").slice(0, 6) : []
  };

  await run(`document.getElementById('updateCheck').click();`);
  await wait(300);
  report.update = await run(`document.getElementById('updateStatus').textContent`);

  // 回生成器验证新的预选值进了第二步
  await run(`document.querySelector('[data-page="generator"]').click();`);
  await wait(400);
  report.presetsInBuilder = await run(`(() => {
    const row = document.querySelector('.load-row');
    const repsField = row.querySelector('.reps-field').getBoundingClientRect();
    const repsPresets = row.querySelector('.reps-presets').getBoundingClientRect();
    return {
      values: [...row.querySelectorAll('[data-op="set-reps"]')].map(b => b.textContent),
      count: row.querySelectorAll('[data-op="set-reps"]').length,
      alignDelta: Math.round(Math.abs(repsField.width - repsPresets.width))
    };
  })()`);
  await run(`document.getElementById('builderPanel').scrollIntoView({block:'start'})`);
  await wait(400);
  await shot(win, "10-builder-presets");

  // 增加记录：总览标题右边点「增加记录」→ 整月变绿（不跳转）→ 点中某一天才回主界面挂提示条 → 保存补进那天
  await run(`document.querySelector('[data-page="overview"]').click();`);
  await wait(400);
  await run(`document.getElementById('ovAddRecord').click();`);
  await wait(350);
  report.backfillArm = await run(`({
    noticeOpen: !document.getElementById('noticeModal').hidden,
    noticeTitle: document.getElementById('noticeTitle').textContent,
    noticeText: document.getElementById('noticeText').textContent,
    stillOverview: !document.getElementById('overviewPage').hidden,
    barHidden: document.getElementById('backfillBar').hidden,
    /* 日历头上那个旧入口应该已经并到总览标题，别再冒出来 */
    calHeadAddGone: !document.getElementById('calBackfill'),
    greenCells: document.querySelectorAll('#calGrid.is-backfill .cal-cell:not(.is-empty):not(.has-record):not(.has-key)').length,
    allCells: document.querySelectorAll('#calGrid .cal-cell:not(.is-empty)').length,
    emptyGreen: document.querySelectorAll('#calGrid.is-backfill .cal-cell.is-empty').length,
    noMoreBox: !document.getElementById('noticeOpt').hidden,
    legend: document.getElementById('calBackfillLegendText').textContent,
    stored: localStorage.getItem('fitness-log-backfill-v1'),
    ovAddLabel: document.getElementById('ovAddRecord').textContent.trim(),
    ovAddArmed: document.getElementById('ovAddRecord').classList.contains('is-armed'),
    /* 增加记录模式下，有记录的那天也得是绿的（以前只有空白日期变绿） */
    allGreen: [...document.querySelectorAll('#calGrid.is-backfill .cal-cell:not(.is-empty):not(.is-selected)')]
      .every(cell => getComputedStyle(cell).backgroundColor === 'rgb(231, 246, 236)')
  })`);
  await shot(win, "13-backfill-armed");
  await run(`document.getElementById('noticeOk').click();`);
  await wait(200);
  await shot(win, "13b-backfill-calendar");
  await run(`document.querySelector('#calGrid [data-date$="-05"]').click();`);
  await wait(400);
  report.backfillPick = await run(`({
    onGenerator: !document.getElementById('generatorPage').hidden,
    barOpen: !document.getElementById('backfillBar').hidden,
    barDate: document.getElementById('bfDate').textContent,
    stored: localStorage.getItem('fitness-log-backfill-v1')
  })`);
  await shot(win, "13c-backfill-bar");
  await run(`document.getElementById('saveButton').click();`);
  await wait(400);
  report.backfillSaved = await run(`(() => {
    const db = JSON.parse(localStorage.getItem('fitness-log-records-v2') || '{}');
    const day = Object.keys(db).sort().find(k => k.endsWith('-05'));
    const rec = day ? db[day][0] : null;
    return {
      title: document.getElementById('saveTitle').textContent,
      text: document.getElementById('saveText').textContent,
      sub: document.getElementById('saveSub').textContent,
      barClosed: document.getElementById('backfillBar').hidden,
      stored: localStorage.getItem('fitness-log-backfill-v1'),
      day, savedDate: rec ? rec.savedDate : null,
      flag: rec ? rec.backfill : null,
      items: rec ? rec.items.length : 0
    };
  })()`);
  await shot(win, "14-backfill-saved");
  await run(`document.getElementById('saveGo').click();`);
  await wait(450);
  report.backfillOverview = await run(`({
    dayTitle: document.getElementById('dayTitle').textContent,
    tag: Boolean(document.querySelector('.rec-backfill-tag')),
    greenOff: !document.getElementById('calGrid').classList.contains('is-backfill'),
    legendHidden: document.getElementById('calBackfillLegend').hidden,
    count: document.getElementById('ovCount').textContent
  })`);
  await shot(win, "15-backfill-overview");

  // 删除单个动作（记录里的小 ×）
  report.itemsBefore = await run(`document.querySelectorAll('#dayBody .rec-item').length`);
  await run(`document.querySelector('#dayBody [data-del-item]').click();`);
  await wait(400);
  report.itemDeleted = await run(`(() => {
    const db = JSON.parse(localStorage.getItem('fitness-log-records-v2') || '{}');
    const rec = (db['2026-11-05'] || [])[0];
    return {
      itemsLeft: document.querySelectorAll('#dayBody .rec-item').length,
      stored: rec ? rec.items.length : 0,
      textLines: rec ? rec.text.split('\\n').length : 0,
      toast: document.getElementById('toast').textContent
    };
  })()`);
  await shot(win, "15b-item-deleted");

  // 单删把这条记录删空了，用新导入功能补一条回来，再验证「删除整条记录」
  await run(`document.getElementById('setImport').click();`);
  await feedImportFile({records:{"2026-11-05":[{items:[
    {name:"补位动作甲",group:"胸",sets:3,reps:10},
    {name:"补位动作乙",group:"背",sets:3,reps:12}
  ]}]}}, "backfill.json");
  await run(`document.getElementById('importParse').click();`);
  await run(`document.getElementById('importConfirm').click();`);
  await wait(350);
  await run(`document.getElementById('noticeClose').click();`);
  await wait(150);

  // 删除整条记录：第一次点击进入确认态，第二次才删
  await run(`document.querySelector('#dayBody [data-del-id]').click();`);
  await wait(200);
  report.deleteArm = await run(`(() => {
    const b = document.querySelector('#dayBody [data-del-id]');
    return {label: b.textContent.trim(), armed: b.dataset.armed, red: b.classList.contains('is-armed')};
  })()`);
  await shot(win, "16-delete-arm");
  await run(`document.querySelector('#dayBody [data-del-id]').click();`);
  await wait(450);
  report.deleted = await run(`(() => {
    const db = JSON.parse(localStorage.getItem('fitness-log-records-v2') || '{}');
    return {
      blocks: document.querySelectorAll('.rec-block').length,
      empty: Boolean(document.querySelector('.day-empty')),
      dayLeft: Boolean(db['2026-11-05']),
      count: document.getElementById('ovCount').textContent,
      toast: document.getElementById('toast').textContent
    };
  })()`);
  await shot(win, "16b-deleted");
  await run(`document.querySelector('[data-page="generator"]').click();`);
  await wait(400);

  // 窄屏
  win.setSize(1000, 900);
  await wait(500);
  await shot(win, "11-narrow");

  // 窄屏下的第二步：一条负荷变两条，看「第 N 组」头与删按钮
  await run(`(() => {
    const b = document.querySelector('.selected-card:not(.is-cardio) [data-op="add-load"]');
    if (b) b.click();
    const c = document.querySelector('.selected-card');
    if (c) c.scrollIntoView({block:'start'});
  })()`);
  await wait(450);
  await shot(win, "11b-narrow-step2");
  await run(`(() => {
    const row = document.querySelectorAll('.selected-card:not(.is-cardio) .load-row');
    const del = row.length > 1 ? row[1].querySelector('.ec-del') : null;
    if (del) del.click();
  })()`);
  await wait(300);
  win.setSize(1400, 940);
  await wait(400);

  await wait(400);
  const last = snapshots[snapshots.length - 1] || {};
  report.snapshot = {
    received: snapshots.length,
    version: last.version,
    actions: (last.actions || []).length,
    planDays: Object.keys(last.weekPlan || {}).length,
    recordDays: Object.keys(last.records || {}).length,
    profile: last.profile
  };

  // 添加动作 → 保存成功弹窗的倒计时与自动关闭
  await run(`document.getElementById('addActionBtn').click()`);
  await wait(250);
  await run(`(() => {
    document.getElementById('newActionName').value = '自测动作';
    document.querySelector('#newActionParts [data-part="背"]').click();
    document.getElementById('addActionForm').dispatchEvent(new Event('submit', {bubbles:true, cancelable:true}));
  })()`);
  await wait(1200);
  report.notice = await run(`({
    open: !document.getElementById('noticeModal').hidden,
    countdown: document.getElementById('noticeCountdown').textContent,
    hasClose: Boolean(document.getElementById('noticeClose')),
    checkSvg: Boolean(document.querySelector('#noticeModal .save-check svg'))
  })`);
  await shot(win, "12-notice-countdown");
  await wait(4400);
  report.noticeAutoClosed = await run(`document.getElementById('noticeModal').hidden`);

  // 第十批：星期滑块不漂移 + 右栏按页显隐
  const thumbDrift = () => run(`(() => {
    const t = document.querySelector('#dayTabs .day-tab.active');
    const th = document.getElementById('dayThumb');
    if (!t || !th) return 999;
    const a = t.getBoundingClientRect(), b = th.getBoundingClientRect();
    return Math.round(Math.abs(b.left - a.left) + Math.abs(b.width - a.width));
  })()`);
  await run(`document.querySelector('[data-page="generator"]').click();`);
  await wait(350);
  const d0 = await thumbDrift();
  await run(`document.getElementById('calToggle').click();`);
  await wait(100);
  const dMid1 = await thumbDrift();
  await wait(320);
  const d1 = await thumbDrift();
  await run(`document.getElementById('calToggle').click();`);
  await wait(100);
  const dMid2 = await thumbDrift();
  await wait(320);
  const d2 = await thumbDrift();
  await run(`document.querySelector('[data-page="overview"]').click();`);
  await wait(320);
  const rbOverview = await run(`getComputedStyle(document.getElementById('rightBar')).display`);
  await run(`document.querySelector('[data-page="settings"]').click();`);
  await wait(320);
  const rbSettings = await run(`getComputedStyle(document.getElementById('rightBar')).display`);
  await run(`document.querySelector('[data-page="generator"]').click();`);
  await wait(420);
  const rbGenerator = await run(`getComputedStyle(document.getElementById('rightBar')).display`);
  const d3 = await thumbDrift();
  report.polish5Motion = { d0, dMid1, d1, dMid2, d2, d3, rbOverview, rbSettings, rbGenerator };

  report.polish5 = await run(`(() => {
    const cs = s => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
    const rel = document.querySelector('.release-list')?.textContent || '';
    return {
      navSize: cs('.side-nav-btn')?.fontSize,
      sidebarPadTop: cs('.sidebar')?.paddingTop,
      releaseDumbbell: rel.indexOf('哑铃') >= 0,
      releaseNoOldTools: !/拿笔|放大镜/.test(rel),
      releaseItems: document.querySelectorAll('.release-list li').length,
      setHeadSize: cs('.set-card-head h3')?.fontSize,
      setHeadWeight: cs('.set-card-head h3')?.fontWeight,
      setHeadBg: cs('.set-card-head')?.backgroundColor,
      setOptionSize: cs('.set-row-text strong')?.fontSize,
      setDescSize: cs('.set-row-text span')?.fontSize,
      setDescColor: cs('.set-row-text span')?.color
    };
  })()`);

  // 导入的动作要落到动作池里的真 id 上，趋势图和部位配色才认得出
  await run(`document.getElementById('setImport').click();`);
  await feedImportFile({records:{"2026-11-12":[{items:[
    {name:"平板卧推",group:"胸",sets:3,reps:10,weight:"60kg"},
    {name:"跑步",group:"有氧",segments:[{spec:"5 km",pace:"11",paceUnit:"km/h"}]}
  ]}]}}, "pool-id.json");
  await run(`document.getElementById('importParse').click();`);
  await wait(200);
  await run(`document.getElementById('importConfirm').click();`);
  await wait(320);
  report.importPoolIds = await run(`(() => {
    const db = JSON.parse(localStorage.getItem('fitness-log-records-v2') || '{}');
    const rec = (db['2026-11-12'] || [])[0];
    const items = rec ? rec.items : [];
    return {
      raw: items.length,
      ids: items.map(i => i.actionId),
      names: items.map(i => i.name),
      types: items.map(i => i.type),
      groups: items.map(i => i.group),
      cardioLoad: items[1] ? items[1].loads[0] : null,
      text: rec ? rec.text : ''
    };
  })()`);
  await run(`(() => { const m = document.getElementById('noticeModal'); if (!m.hidden) document.getElementById('noticeClose').click(); })()`);
  await wait(150);

  // 同一份文件再导一次：先问「保留还是覆盖」，选保留后一条不加
  await run(`document.getElementById('setImport').click();`);
  await feedImportFile({records:{"2026-11-12":[{items:[
    {name:"平板卧推",group:"胸",sets:3,reps:10,weight:"60kg"},
    {name:"跑步",group:"有氧",segments:[{spec:"5 km",pace:"11",paceUnit:"km/h"}]}
  ]}]}}, "pool-id.json");
  await run(`document.getElementById('importParse').click();`);
  await wait(200);
  await run(`document.getElementById('importConfirm').click();`);
  await wait(300);
  const dupAsk = await run(`(() => ({
    asked: !document.getElementById('dupModal').hidden,
    title: document.getElementById('dupTitle').textContent,
    dayCount: (JSON.parse(localStorage.getItem('fitness-log-records-v2') || '{}')['2026-11-12'] || []).length
  }))()`);
  await shot(win, "22-import-dup");
  await run(`document.getElementById('dupKeep').click();`);
  await wait(300);
  report.importDupKeep = {
    asked: dupAsk.asked,
    title: dupAsk.title,
    before: dupAsk.dayCount,
    after: await run(`(JSON.parse(localStorage.getItem('fitness-log-records-v2') || '{}')['2026-11-12'] || []).length`),
    modalClosed: await run(`document.getElementById('dupModal').hidden`)
  };
  await run(`(() => { const m = document.getElementById('noticeModal'); if (!m.hidden) document.getElementById('noticeClose').click(); })()`);
  await wait(150);

  // 再来一次，这次选覆盖：条数不涨，内容换成新的
  await run(`document.getElementById('setImport').click();`);
  await feedImportFile({records:{"2026-11-12":[{items:[
    {name:"平板卧推",group:"胸",sets:4,reps:8,weight:"65kg"}
  ]}]}}, "pool-id-2.json");
  await run(`document.getElementById('importParse').click();`);
  await wait(200);
  await run(`document.getElementById('importConfirm').click();`);
  await wait(300);
  await run(`document.getElementById('dupOver').click();`);
  await wait(300);
  report.importDupOver = await run(`(() => {
    const list = JSON.parse(localStorage.getItem('fitness-log-records-v2') || '{}')['2026-11-12'] || [];
    return {
      count: list.length,
      items: list[0] ? list[0].items.length : 0,
      weight: list[0] && list[0].items[0] ? list[0].items[0].loads[0].weight : '',
      idKept: Boolean(list[0] && /^rec-/.test(list[0].id))
    };
  })()`);
  await run(`(() => { const m = document.getElementById('noticeModal'); if (!m.hidden) document.getElementById('noticeClose').click(); })()`);
  await wait(150);

  // 复盘：训练次数 + 当日身材照（三张封顶）
  await run(`document.querySelector('[data-page="overview"]').click();`);
  await wait(400);
  report.trainCount = await run(`(() => {
    const block = document.getElementById('ovTrainDaysBtn');
    return {
      label: block.querySelector('span').textContent.replace(/\\s+/g, ''),
      unit: block.querySelector('i').textContent,
      value: document.getElementById('ovTrainDays').textContent
    };
  })()`);

  // 塞四张假照片进 input：只该收下三张，按钮随后变灰
  await run(`(async () => {
    const make = async (r, g, b) => {
      const canvas = document.createElement('canvas');
      canvas.width = 320; canvas.height = 420;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      ctx.fillRect(0, 0, 320, 420);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
      return new File([blob], 'shot.jpg', { type: 'image/jpeg' });
    };
    const files = [await make(143, 211, 244), await make(40, 160, 214), await make(120, 190, 230), await make(200, 220, 240)];
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    const input = document.getElementById('dayPhotoFile');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await wait(1400);
  await shot(win, "23-day-photos");
  report.dayPhotos = await run(`(async () => {
    const grid = document.querySelector('#dayPhotos .dp-grid');
    const add = document.getElementById('dayPhotoAdd');
    const meta = document.querySelector('#dayPhotos .dp-head span').textContent.replace(/\\s+/g, '');
    return {
      thumbs: grid ? grid.querySelectorAll('.dp-thumb').length : 0,
      meta,
      addDisabled: Boolean(add && add.disabled),
      addText: add ? add.textContent.replace(/\\s+/g, '') : '',
      radius: grid ? getComputedStyle(grid.querySelector('.dp-thumb')).borderTopLeftRadius : '',
      stored: await new Promise(res => {
        const req = indexedDB.open('repy-photos', 1);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('meta')) return res(-1);
          const tx = db.transaction('meta', 'readonly');
          const all = tx.objectStore('meta').getAll();
          all.onsuccess = () => res(all.result.length);
          all.onerror = () => res(-2);
        };
        req.onerror = () => res(-3);
      })
    };
  })()`);

  // 换一天再加一张：对比页才有两天可挑
  await run(`(() => { const cell = document.querySelector('#calGrid [data-date="2026-11-12"]'); if (cell) cell.click(); })()`);
  await wait(450);
  await run(`(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 360; canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(60,150,210)';
    ctx.fillRect(0, 0, 360, 480);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'b.jpg', { type: 'image/jpeg' }));
    const input = document.getElementById('dayPhotoFile');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await wait(1200);
  report.dayPhotosOtherDay = await run(`(() => ({
    title: document.getElementById('dayTitle').textContent,
    thumbs: document.querySelectorAll('#dayPhotos .dp-thumb').length,
    addDisabled: document.getElementById('dayPhotoAdd').disabled
  }))()`);

  // 趋势：有照片才出现「身材变化」，弹窗两个连体选项卡都能用
  await run(`document.querySelector('[data-page="trend"]').click();`);
  await wait(1400);
  report.trendFilters = await run(`(() => ({
    chips: [...document.querySelectorAll('#trRange .tr-chip')].map(b => b.textContent.trim()),
    active: (document.querySelector('#trRange .tr-chip.is-on') || {}).textContent || '',
    parts: document.querySelectorAll('#trParts .pick-part').length,
    cards: document.querySelectorAll('.trend-card').length,
    emptyShown: !document.getElementById('trendEmpty').hidden,
    noMatchHidden: document.getElementById('trendNoMatch').hidden
  }))()`);
  report.fineUi = await run(`(() => {
    const bar = document.querySelector('.sb-overlay');
    const navs = [...document.querySelectorAll('.side-nav-btn')].map(btn => ({
      page: btn.dataset.page,
      bg: getComputedStyle(btn).backgroundColor
    }));
    return {
      scrollOpacity: bar ? getComputedStyle(bar).opacity : 'missing',
      scrollPointer: bar ? getComputedStyle(bar).pointerEvents : '',
      navs
    };
  })()`);
  await run(`document.getElementById('trendAdd').click();`);
  await wait(260);
  report.pickChip = await run(`(() => {
    const chip = document.querySelector('#trendParts .pick-part.is-on') || document.querySelector('#trendParts .pick-part');
    if (!chip) return null;
    const cs = getComputedStyle(chip);
    return { text: chip.textContent.trim(), radius: cs.borderTopLeftRadius, bg: cs.backgroundColor, color: cs.color };
  })()`);
  await shot(win, "26-pick-parts");
  await run(`document.getElementById('trendClose').click();`);
  await wait(220);
  report.photoEntry = await run(`(() => {
    const btn = document.getElementById('trendPhotos');
    return { hidden: btn.hidden, text: btn.textContent.trim(), bg: getComputedStyle(btn).backgroundColor };
  })()`);
  await run(`document.getElementById('trendPhotos').click();`);
  await wait(500);
  await shot(win, "24-photo-compare");
  report.photoCompare = await run(`(() => {
    const side = document.getElementById('pvSideA');
    return {
      open: !document.getElementById('photoModal').hidden,
      tabs: [...document.querySelectorAll('.pv-tab')].map(t => t.textContent.trim()),
      stages: document.querySelectorAll('[data-pv-stage]').length,
      dates: side.querySelectorAll('[data-pv-date]').length,
      pickDates: [...side.querySelectorAll('[data-pv-date]')].map(b => b.dataset.date),
      hasImg: Boolean(side.querySelector('[data-pv-img]')),
      imgLoaded: (side.querySelector('[data-pv-img]') || {}).naturalWidth || 0
    };
  })()`);
  await run(`document.getElementById('pvTabGallery').click();`);
  await wait(700);
  await shot(win, "25-photo-gallery");
  report.photoGallery = await run(`(() => ({
    paneShown: !document.getElementById('pvPaneGallery').hidden,
    compareHidden: document.getElementById('pvPaneCompare').hidden,
    shots: document.querySelectorAll('#pvGal figure').length,
    state: document.getElementById('pvGalState').textContent,
    scrolled: Math.round(document.querySelector('.pv-gal-wrap').scrollLeft)
  }))()`);
  await run(`document.getElementById('photoClose').click();`);
  await wait(200);

  // 气泡里那张：设置里打开才出现
  await run(`document.querySelector('[data-page="settings"]').click();`);
  await wait(320);
  await run(`(() => { const s = document.getElementById('setBubblePhoto'); s.checked = true; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await run(`document.querySelector('[data-page="generator"]').click();`);
  await wait(700);
  report.bubblePhoto = await run(`(() => {
    const box = document.getElementById('bubblePhoto');
    const img = box.querySelector('img');
    return {
      hidden: box.hidden,
      inChatPane: Boolean(box.closest('.bubble-pane.is-chat')),
      imgWidth: img ? img.naturalWidth : 0,
      note: box.textContent.replace(/\\s+/g, ''),
      hasPhoto: document.querySelector('.bubble-pane.is-chat').classList.contains('has-photo'),
      chatHidden: getComputedStyle(document.getElementById('bubbleChat')).display === 'none',
      on: document.getElementById('setBubblePhoto').checked
    };
  })()`);
  await run(`(() => {
    document.querySelectorAll('.bubble-pane').forEach(p => { p.hidden = p.dataset.pane !== '0'; });
    window.dispatchEvent(new CustomEvent('repy:measure'));
  })()`);
  await wait(420);
  await shot(win, "27-bubble-photo");

  // 照片占位时点 Repy：先回到文案，再点能换句
  report.chatAfterPhoto = await run(`(() => {
    const pane = document.querySelector('.bubble-pane.is-chat');
    const bot = document.querySelector('.repy-bot');
    const chat = document.getElementById('bubbleChat');
    const before = chat.textContent;
    bot.click();
    const after1 = chat.textContent;
    const visible = getComputedStyle(chat).display !== 'none';
    const photoGone = getComputedStyle(document.getElementById('bubblePhoto')).display === 'none';
    bot.click();
    const after2 = chat.textContent;
    return {
      hasPhoto: pane.classList.contains('has-photo'),
      showText: pane.classList.contains('show-text'),
      visible, photoGone,
      changed1: before !== after1,
      changed2: after1 !== after2,
      pane0Hidden: pane.hidden,
      text: chat.textContent.slice(0, 20),
      tabsOn: [...document.querySelectorAll('.bubble-tab.is-on')].map(t => t.textContent.trim())
    };
  })()`);
  await wait(320);
  report.chatAfterPhotoLate = await run(`(() => {
    const pane = document.querySelector('.bubble-pane.is-chat');
    return {
      showText: pane.classList.contains('show-text'),
      hasPhoto: pane.classList.contains('has-photo'),
      photoDisplay: getComputedStyle(document.getElementById('bubblePhoto')).display,
      helloDisplay: getComputedStyle(document.getElementById('bubbleChat')).display,
      helloText: document.getElementById('bubbleChat').textContent.slice(0, 16)
    };
  })()`);
  await shot(win, "27c-chat-after-photo");

  // 窄屏下照片也不能溢出面板
  win.setSize(1000, 900);
  await wait(450);
  report.narrowBubble = await run(`(() => {
    const hero = document.querySelector('.repy-hero').getBoundingClientRect();
    const photo = document.getElementById('bubblePhoto').getBoundingClientRect();
    const bubble = document.getElementById('repyBubble').getBoundingClientRect();
    return {
      photoInHero: Math.round(photo.right) <= Math.round(hero.right),
      bubbleInHero: Math.round(bubble.right) <= Math.round(hero.right),
      photoW: Math.round(photo.width)
    };
  })()`);
  await shot(win, "27b-narrow-photo");

  /* 偏好包顺序：排班里引用的自建动作是这份包刚带过来的，不能被先写进去的排班挡掉 */
  await run(`(() => {
    const dt = new DataTransfer();
    dt.items.add(new File([JSON.stringify({
      app: "fitness-log-generator", kind: "repyneo-prefs", schema: 1,
      from: "RepyNeo", version: "2.1.3",
      plan: { 0: { name: "检查日", items: ["custom-check-plan", "bench"] } },
      customActions: [{ id: "custom-check-plan", name: "检查动作", aliases: "", group: "胸", priority: 99 }]
    })], "repyneo-prefs-check.json", {type: "application/json"}));
    const input = document.getElementById('prefsFile');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await wait(500);
  report.prefsPlanOrder = await run(`(() => {
    let plan = null;
    let custom = [];
    try { plan = JSON.parse(localStorage.getItem('fitness-log-week-plan-v1') || 'null'); } catch (err) {}
    try { custom = JSON.parse(localStorage.getItem('fitness-log-custom-actions-v1') || '[]'); } catch (err) {}
    const items = plan && plan[0] && Array.isArray(plan[0].items) ? plan[0].items : [];
    return {
      customAdded: Array.isArray(custom) && custom.some(item => item.id === 'custom-check-plan'),
      planName: plan && plan[0] ? plan[0].name : '',
      keepsNewAction: items.indexOf('custom-check-plan') >= 0,
      keepsBuiltin: items.indexOf('bench') >= 0,
      items
    };
  })()`);

  /* 复盘页的两个入口：增加记录只在总览标题右边；没记录的那天头上不留按钮 */
  await run(`document.querySelector('[data-page="overview"]').click();`);
  await wait(400);
  await run(`(() => {
    const cells = [...document.querySelectorAll('#calGrid [data-date]')].filter(c => !c.classList.contains('has-record'));
    const cell = cells[cells.length - 1];
    if (cell) cell.click();
    return true;
  })()`);
  await wait(350);
  report.dayButtons = await run(`({
    calHeadAddGone: document.getElementById('calBackfill') === null,
    addLabel: document.getElementById('ovAddRecord').textContent.trim(),
    emptyDayMeta: document.getElementById('dayMeta').textContent,
    emptyDayNoteHidden: document.getElementById('dayNoteBtn').hidden,
    emptyDayActions: document.querySelectorAll('.day-empty-actions .day-empty-btn').length
  })`);

  /* 复盘页有氧那行也要能点开编辑：以前只渲染成 <span>，点不动也没弹窗 */
  /* 自检前面导入的记录已经被后面的用例改过，这里自己种一条有氧记录最稳 */
  await run(`(() => {
    const d = new Date();
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    const db = JSON.parse(localStorage.getItem('fitness-log-records-v2') || '{}');
    db[key] = [{
      id: 'rec-check-cardio', savedAt: Date.now(), date: key,
      items: [
        { actionId: 'climb', name: '爬楼梯', group: '有氧', type: 'cardio', note: '', loads: [{}] },
        { actionId: 'bench', name: '平板卧推', group: '胸', type: 'strength', note: '', loads: [{weight:'60kg', sets:3, setsExplicit:true, repMode:'same', sameRep:'10', reps:['10','10','10'], target:'12'}] }
      ]
    }];
    localStorage.setItem('fitness-log-records-v2', JSON.stringify(db));
    return true;
  })()`);
  await wait(200);
  await run(`location.reload()`);
  await wait(1600);
  await run(`(() => {
    document.querySelectorAll('.modal-mask').forEach(el => { el.hidden = true; });
    document.querySelector('[data-page="overview"]').click();
    return true;
  })()`);
  await wait(600);

  report.cardioEdit = await run(`(() => {
    /* 按部位找「有氧」那一组里的那一行 */
    const card = [...document.querySelectorAll('.rec-item')].find(el => (el.querySelector('.rec-part') || {}).textContent === '有氧');
    const btn = card ? card.querySelector('.rec-load-val[data-edit-item]') : null;
    if (!btn) return { found: false, recItems: document.querySelectorAll('.rec-item').length };
    btn.click();
    const body = document.getElementById('loadEditBody');
    const modal = document.getElementById('loadEditModal');
    const out = {
      found: true,
      opened: !modal.hidden,
      kicker: document.getElementById('loadEditKicker').textContent.trim(),
      title: document.getElementById('loadEditTitle').textContent.trim(),
      hasSpec: !!body.querySelector('[data-le-field="spec"]'),
      hasPace: !!body.querySelector('[data-le-field="pace"]'),
      hasExtra: !!body.querySelector('[data-le-field="extra"]'),
      unitCount: body.querySelectorAll('[data-le-unit]').length,
      hasWeight: !!body.querySelector('[data-le-field="weight"]')
    };
    document.getElementById('loadEditCancel').click();
    out.closed = document.getElementById('loadEditModal').hidden;
    return out;
  })()`);

  /* 三处分割线两端要平直：全局圆角别把带边框的容器带弯 */
  report.dividerLines = await run(`(() => {
    const pick = sel => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        tl: parseFloat(cs.borderTopLeftRadius) || 0,
        tr: parseFloat(cs.borderTopRightRadius) || 0,
        br: parseFloat(cs.borderBottomRightRadius) || 0,
        bl: parseFloat(cs.borderBottomLeftRadius) || 0
      };
    };
    return { calHead: pick('.cal-head'), dayMetrics: pick('.day-metrics'), dayPhotos: pick('.day-photos') };
  })()`);

  report.runErrors = runErrors;
  console.log("\n===REPORT===\n" + JSON.stringify(report, null, 2));
  console.log("\n===LOGS===\n" + logs.join("\n"));

  win.destroy();
  app.quit();
}).catch(err => {
  console.error("FATAL", err);
  app.exit(1);
});
