# -*- coding: utf-8 -*-
"""
V2.1.0 功能改造（一次性脚本，可重复跑）

  2. 设置页新增「导入」：AI agent 提示词 + JSON 校验预览 + 合并写入
  3. 设置页新增「分享软件」：重新打包 / 定位安装包，由用户选保存位置
  7. 补记录：只有空白日期格变绿；提示弹窗可勾「不再提醒」；设置里能恢复
  8. 版本号 V2.1.0 + 更新日志
"""
import io
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, "src", "index.html")
MARK = "/* V2.1.0 FEATURES */"


# ---------------- 设置页：导入 ----------------

OLD_EXPORT_ROW = '''      <div class="set-row">
        <div class="set-row-text">
          <strong>导出全部记录</strong>
          <span id="setRecCount">0 天 · 0 条记录</span>
        </div>
        <div class="set-row-ctl">
          <button class="set-btn" type="button" id="setExport">导出 JSON</button>
        </div>
      </div>'''

NEW_EXPORT_ROW = OLD_EXPORT_ROW + '''
      <div class="set-row">
        <div class="set-row-text">
          <strong>导入外部记录</strong>
          <span>借助 AI agent 把别处的表格 / 文字翻译成 Repy 格式，确认后并进现有记录</span>
        </div>
        <div class="set-row-ctl">
          <button class="set-btn" type="button" id="setImport">导入记录</button>
        </div>
      </div>
      <div class="set-row">
        <div class="set-row-text">
          <strong>分享软件给朋友</strong>
          <span id="shareStatus">把当前版本重新打包成安装包，存在哪儿由你选</span>
        </div>
        <div class="set-row-ctl">
          <button class="set-btn" type="button" id="shareBtn">分享软件</button>
        </div>
      </div>'''

# 操作习惯里加「补记录提示」开关
OLD_HABIT_ANCHOR = '''      <div class="set-row">
        <div class="set-row-text">
          <strong>新建动作后直接加入编排</strong>
          <span>添加完动作就不用再回列表点一次。</span>
        </div>'''

NEW_HABIT_ANCHOR = '''      <div class="set-row">
        <div class="set-row-text">
          <strong>补记录时弹提示</strong>
          <span>关掉后，点「补记录」直接选日期，不再弹说明窗。</span>
        </div>
        <div class="set-row-ctl">
          <label class="switch">
            <input type="checkbox" id="setBackfillPrompt">
            <span class="switch-track" aria-hidden="true"></span>
          </label>
        </div>
      </div>
''' + OLD_HABIT_ANCHOR


# ---------------- 导入弹窗 ----------------

IMPORT_MODAL = '''
<div class="modal-mask" id="importModal" hidden>
  <div class="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="importTitle">
    <div class="modal-head">
      <div>
        <p class="modal-kicker">记录数据 · 导入</p>
        <h2 id="importTitle">把别处的记录搬进 Repy</h2>
      </div>
      <button class="modal-close" type="button" id="importClose" aria-label="关闭导入">×</button>
    </div>
    <div class="import-body">
      <p class="import-lead">Repy 不猜你的表格长什么样。把外来数据贴进来，复制一段提示词交给任意 AI agent，它会按 Repy 的格式翻译好；再把结果贴回下面，检查一遍就能导入。已有的记录不会被动到。</p>

      <div class="import-step">
        <span class="imp-n">01</span>
        <div class="imp-main">
          <strong>贴上外来数据</strong>
          <p>训练 App 导出的表格、备忘录、微信群里的打卡文字都行。</p>
          <textarea id="importSource" rows="5" spellcheck="false" placeholder="例如：11/5 胸 平板卧推 60kg 4组 12/12/10/8；上斜卧推 50kg 3×10"></textarea>
          <div class="imp-tools">
            <button class="set-btn" type="button" id="importPickFile">选择文件</button>
            <input type="file" id="importFile" accept=".txt,.json,.csv,.md,.log" hidden>
            <button class="set-btn" type="button" id="importCopyPrompt">复制给 AI 的提示词</button>
            <span class="imp-hint" id="importSourceHint">也可以直接把已经是 Repy 格式的 JSON 贴到第 02 步</span>
          </div>
        </div>
      </div>

      <details class="import-schema">
        <summary>看看 Repy 认什么格式（点开可复制）</summary>
        <pre id="importSchemaText"></pre>
        <button class="set-btn" type="button" id="importCopySchema">只复制格式说明</button>
      </details>

      <div class="import-step">
        <span class="imp-n">02</span>
        <div class="imp-main">
          <strong>贴上 AI 返回的 JSON</strong>
          <p>只接受下面这个结构；解析通过后会先给你看预览，不会立刻写入。</p>
          <textarea id="importJson" rows="6" spellcheck="false" placeholder='{"records": {"2026-11-05": [{"times": "第 1 次", "items": [{"name": "平板卧推", "group": "胸", "sets": 4, "reps": [12,12,10,8], "weight": 60}]}]}}'></textarea>
          <div class="imp-tools">
            <button class="set-btn" type="button" id="importParse">解析并预览</button>
            <span class="imp-hint" id="importHint">还没解析</span>
          </div>
        </div>
      </div>

      <div class="import-preview" id="importPreview" hidden></div>
    </div>
    <div class="form-foot">
      <button class="ghost-btn" type="button" id="importCancel">取消</button>
      <button class="save-btn" type="button" id="importConfirm" disabled>确认导入</button>
    </div>
  </div>
</div>
'''


# ---------------- notice 弹窗：不再提醒 ----------------

OLD_NOTICE_FOOT = '''    <div class="save-actions">
      <button class="save-btn" type="button" id="noticeOk">知道了</button>
    </div>'''

NEW_NOTICE_FOOT = '''    <label class="notice-opt" id="noticeOpt" hidden>
      <input type="checkbox" id="noticeNoMore">
      <span>不再提醒</span>
    </label>
    <div class="save-actions">
      <button class="save-btn" type="button" id="noticeOk">知道了</button>
    </div>'''


# ---------------- 补记录 CSS ----------------

OLD_BACKFILL_CSS = '''.cal-grid.is-backfill .cal-cell{
  color:#14532d;
  background:#d9f2de;
  border-color:#7fc494;
}
.cal-grid.is-backfill .cal-cell:hover{background:#c6ebd0;border-color:#4f9f6b}
.cal-grid.is-backfill .cal-cell.has-record{background:#b7e8c2;border-color:#57a874}
.cal-grid.is-backfill .cal-cell.has-key{background:#93dba6;border-color:#3d8f5e}'''

NEW_BACKFILL_CSS = '''/* 补记录：只有「光秃秃一个日期」的格子变绿；空白占位格、已有记录的格子保持原样 */
.cal-grid.is-backfill .cal-cell:not(.is-empty):not(.has-record):not(.has-key){
  color:#14532d;
  background:#d9f2de;
  border-color:#7fc494;
}
.cal-grid.is-backfill .cal-cell:not(.is-empty):not(.has-record):not(.has-key):hover{background:#c6ebd0;border-color:#4f9f6b}
.cal-grid.is-backfill .cal-cell.is-empty{background:transparent;border-color:transparent}'''


# ---------------- 更新日志 ----------------

OLD_RELEASE = '''    <ul class="release-list">
      <li><b>新增「补记录」</b>：在记录总览的日历上点「补记录」，整月日期全部变绿</li>
      <li>弹窗告诉你「可以补记录了」；关掉它，在绿色日历上点中哪一天，才会带着那一天跳回「健身记录生成器」</li>
      <li>主界面底部常驻一条提示：正在补某年某月某日。照常编排动作，按下「保存本次训练」就补进那天，提示立刻消失</li>
      <li>补记过的记录在总览里带绿色「补记」标记，并直接停在那一天；补错了点「取消补记」就能退出</li>
      <li>「添加动作」收成动作池标题右侧的小按钮，展开/收起换成面板底部的大按钮</li>
      <li>总览里的记录可以删：每条记录右上角「删除」（点两次确认），每个动作右侧的「×」可以单删一个动作</li>
    </ul>'''

NEW_RELEASE = '''    <ul class="release-list">
      <li><b>全新的 Repy</b>：换了应用图标，小机器人一手拿笔帮你撰写、一手拿放大镜帮你复盘；全站换成 JR0 浅蓝主题</li>
      <li><b>导入记录</b>：设置里新增「导入记录」，把外来数据交给 AI agent 翻译成 Repy 格式，粘贴回来预览确认即可并进现有记录</li>
      <li><b>分享软件</b>：设置里新增「分享软件」，重新打包一份安装包，保存在哪里由你自己选</li>
      <li>左侧边栏去掉操作步骤卡，只留粗体的 <b>Repy</b> 和加粗放大的「撰写」「复盘」两个标签</li>
      <li>新增右侧可收起的日历栏，原来标题旁的小日历搬进去了，顶条上可以一键开关</li>
      <li>主页面换成 Repy 机器人 + 对话气泡：使用步骤与新版日志每 10 秒轮换，也能点标签立刻切</li>
      <li>补记录更克制：只有空白日期变绿，已有记录的日子保持原样；提示弹窗多了「不再提醒」，设置里能改回来</li>
    </ul>'''


# ---------------- CSS ----------------

CSS = r'''
/* V2.1.0 FEATURES */
.import-modal{width:min(760px,100%)}
.import-body{padding:16px 20px 8px}
.import-lead{
  margin:0 0 16px;
  padding:11px 13px;
  color:var(--ink2);
  background:var(--sky-soft);
  border-left:4px solid var(--sky-deep);
  font-size:11.5px;
  line-height:1.75;
}
.import-step{
  display:grid;
  grid-template-columns:34px minmax(0,1fr);
  gap:12px;
  margin-bottom:16px;
}
.imp-n{
  display:grid;
  place-items:center;
  width:32px;
  height:32px;
  color:#fff;
  background:var(--sky-deep);
  font-size:11px;
  font-weight:900;
}
.imp-main{min-width:0}
.imp-main strong{display:block;color:var(--ink);font-size:13px}
.imp-main p{margin:3px 0 8px;color:var(--muted);font-size:10.5px;line-height:1.6}
.import-body textarea{
  display:block;
  width:100%;
  padding:10px 11px;
  color:var(--ink);
  background:#fbfdff;
  border:1px solid var(--sky-line);
  font-size:11px;
  line-height:1.65;
  resize:vertical;
}
.import-body textarea:focus{outline:2px solid var(--sky);outline-offset:0}
.imp-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}
.imp-hint{color:var(--muted);font-size:10px;line-height:1.5}
.import-schema{
  margin:-4px 0 16px 46px;
  padding:9px 12px;
  background:var(--card2);
  border:1px solid var(--rule);
  font-size:10.5px;
}
.import-schema summary{color:var(--navy);font-weight:850;cursor:pointer}
.import-schema pre{
  max-height:220px;
  overflow:auto;
  margin:9px 0;
  padding:10px;
  color:var(--ink2);
  background:#fff;
  border:1px solid var(--sky-line);
  font-size:10px;
  line-height:1.6;
}
.import-preview{
  margin:0 0 14px 46px;
  padding:12px 14px;
  color:var(--ink2);
  background:#eff9f3;
  border:1px solid #8cc79b;
  font-size:11px;
  line-height:1.7;
}
.import-preview b{color:#1f6b3d}
.import-preview ul{margin:7px 0 0;padding-left:18px}
.import-preview.is-error{background:#fdeceb;border-color:#e3c8c4;color:#a8402f}
.notice-opt{
  display:flex;
  align-items:center;
  gap:8px;
  padding:0 20px 12px;
  color:var(--ink2);
  font-size:11px;
  font-weight:800;
}
.notice-opt input{width:15px;height:15px;accent-color:var(--sky-deep)}
@media (max-width:620px){
  .import-schema,.import-preview{margin-left:0}
  .import-step{grid-template-columns:26px minmax(0,1fr);gap:8px}
  .imp-n{width:26px;height:26px}
}
'''


# ---------------- JS ----------------

JS = r'''
  /* ---------- V2.1.0：导入 / 分享 / 补记录提示 ---------- */
  const BACKFILL_NO_PROMPT_KEY = "repy-backfill-no-prompt-v1";

  function repyImportSchema(){
    return [
      "Repy 训练记录导入格式（JSON）",
      "",
      "支持两种顶层结构：",
      '  A. {"records": {"YYYY-MM-DD": [ 训练条目, ... ]}}',
      '  B. [ {"date":"YYYY-MM-DD", "times":"第 1 次", "items":[...]}, ... ]',
      "",
      "训练条目字段：",
      "  times   可选，当天第几次训练（字符串或数字）",
      "  note    可选，这一条的备注",
      "  items   必填，动作数组，每个动作：",
      "    name     必填，动作名",
      "    group    可选，胸 / 背 / 腿 / 肩 / 其他，默认「其他」",
      "    sets     可选，组数，默认 1",
      "    reps     可选，每组数量：数字（所有组相同）或数组（逐组列出）",
      "    weight   可选，重量 kg，纯数字或带单位的字符串",
      "    eachSide 可选，true 表示「每边」",
      "    isKey    可选，true 标为关键重量",
      "    note     可选，动作备注",
      "",
      "示例：",
      JSON.stringify({records:{"2026-11-05":[{times:"第 1 次",items:[
        {name:"平板卧推",group:"胸",sets:4,reps:[12,12,10,8],weight:60,isKey:true},
        {name:"上斜卧推",group:"胸",sets:3,reps:10,weight:50}
      ]}]}}, null, 2),
      "",
      "翻译要求：只输出 JSON，不要代码块标记、不要解释；日期一律 YYYY-MM-DD；",
      "无法确定的字段就省略，不要编造动作；同一天多次训练用同一 key 下的多个条目表示。"
    ].join("\n");
  }

  function noBackfillPrompt(){
    try { return localStorage.getItem(BACKFILL_NO_PROMPT_KEY) === "1"; } catch (err) { return false; }
  }

  /* ---- 导入：解析 ---- */
  let importDraft = null;

  function normalizeImportPayload(data){
    if (!data || typeof data !== "object") throw new Error("不是 JSON 对象");
    const out = {};
    const push = (key, entry) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error(`日期格式不对：${key}（要 YYYY-MM-DD）`);
      const d = new Date(`${key}T00:00:00`);
      if (Number.isNaN(d.getTime())) throw new Error(`日期不存在：${key}`);
      if (!entry || typeof entry !== "object") throw new Error("训练条目格式不对");
      const rawItems = Array.isArray(entry.items) ? entry.items : [];
      if (!rawItems.length) throw new Error(`${key} 这条没有动作`);
      const items = rawItems.map(raw => {
        const name = String(raw.name || "").trim();
        if (!name) throw new Error(`${key} 里有动作没写名字`);
        const sets = Math.max(1, Math.floor(Number(raw.sets) || 1));
        const repsRaw = raw.reps;
        const repList = Array.isArray(repsRaw)
          ? repsRaw.slice(0, sets).map(v => String(v ?? "").trim())
          : [];
        while (repList.length < sets) repList.push(String(repsRaw ?? "").trim());
        const same = !Array.isArray(repsRaw) || new Set(repList).size === 1;
        return {
          actionId:`imported-${name}`,
          name,
          group:["胸","背","腿","肩"].includes(String(raw.group || "")) ? String(raw.group) : "其他",
          isKey:Boolean(raw.isKey),
          note:String(raw.note || ""),
          loads:[{
            weight:String(raw.weight ?? ""),
            eachSide:Boolean(raw.eachSide),
            sets,
            setsExplicit:true,
            repMode:same ? "same" : "each",
            sameRep:same ? (repList[0] || "") : "",
            reps:repList,
            target:""
          }]
        };
      });
      if (!Array.isArray(out[key])) out[key] = [];
      out[key].push({
        id:uid("rec"),
        savedAt:new Date(`${key}T20:00:00`).getTime(),
        savedDate:key,
        imported:true,
        times:String(entry.times ?? "").trim(),
        note:String(entry.note ?? "").trim(),
        text:textFromItems(items),
        items
      });
    };

    if (Array.isArray(data)) {
      data.forEach(entry => push(String(entry.date || ""), entry));
    } else {
      const records = data.records || data;
      if (!records || typeof records !== "object" || Array.isArray(records)) throw new Error("找不到 records");
      Object.keys(records).forEach(key => {
        const list = Array.isArray(records[key]) ? records[key] : [records[key]];
        list.forEach(entry => push(key, entry));
      });
    }
    return out;
  }

  function openImport(){
    $("importSource").value = "";
    $("importJson").value = "";
    $("importPreview").hidden = true;
    $("importHint").textContent = "还没解析";
    $("importConfirm").disabled = true;
    $("importSchemaText").textContent = repyImportSchema();
    importDraft = null;
    $("importModal").hidden = false;
    $("importSource").focus();
  }

  function closeImport(){
    $("importModal").hidden = true;
    importDraft = null;
  }

  async function copyText(text){
    if (window.desktop?.copy) {
      try { await window.desktop.copy(text); return true; } catch (err) {}
    }
    try { await navigator.clipboard.writeText(text); return true; } catch (err) {}
    return false;
  }

  function parseImport(){
    const raw = $("importJson").value.trim();
    const preview = $("importPreview");
    const hint = $("importHint");
    preview.hidden = false;
    if (!raw) {
      preview.classList.add("is-error");
      preview.textContent = "第 02 步还是空的：把 AI 返回的 JSON 贴进去，或者直接贴 Repy 格式的记录。";
      hint.textContent = "没有内容";
      $("importConfirm").disabled = true;
      importDraft = null;
      return;
    }
    try {
      const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      const data = JSON.parse(clean);
      importDraft = normalizeImportPayload(data);
      const days = Object.keys(importDraft).length;
      const recs = Object.values(importDraft).reduce((n, list) => n + list.length, 0);
      const acts = Object.values(importDraft).reduce((n, list) => n + list.reduce((m, r) => m + r.items.length, 0), 0);
      const sample = Object.keys(importDraft).sort().slice(0, 4).map(key => {
        const r = importDraft[key][0];
        return `<li><b>${key}</b> · ${r.items.length} 个动作 · ${escapeHtml(r.items.slice(0, 3).map(i => i.name).join("、"))}${r.items.length > 3 ? "…" : ""}</li>`;
      }).join("");
      preview.classList.remove("is-error");
      preview.innerHTML = `<b>解析通过</b>：${days} 天 / ${recs} 条记录 / ${acts} 个动作。导入时会并进已有记录，不会覆盖。<ul>${sample}</ul>`;
      hint.textContent = `${days} 天 · ${recs} 条 · ${acts} 个动作`;
      $("importConfirm").disabled = false;
      logLine("import", `解析待导入 ${days} 天 / ${recs} 条`);
    } catch (err) {
      preview.classList.add("is-error");
      preview.textContent = `没能解析：${err.message}。检查一下 JSON 是否完整、日期是不是 YYYY-MM-DD。`;
      hint.textContent = "解析失败";
      $("importConfirm").disabled = true;
      importDraft = null;
    }
  }

  function confirmImport(){
    if (!importDraft) return;
    recordDb = loadRecords();
    let added = 0;
    Object.keys(importDraft).forEach(key => {
      if (!Array.isArray(recordDb[key])) recordDb[key] = [];
      importDraft[key].forEach(rec => { recordDb[key].unshift(rec); added += 1; });
    });
    persistRecords();
    renderCalendar();
    renderDay();
    renderOverviewStats();
    renderMiniCalendar();
    syncSnapshot();
    logLine("import", `导入完成 ${added} 条记录`);
    closeImport();
    showNotice("导入完成", `并进来 ${added} 条训练记录，去「复盘」里翻翻看。`, "已有的记录一条都没动", NOTICE_SECONDS);
  }

  $("setImport").addEventListener("click", openImport);
  $("importClose").addEventListener("click", closeImport);
  $("importCancel").addEventListener("click", closeImport);
  $("importModal").addEventListener("click", event => {
    if (event.target === $("importModal")) closeImport();
  });
  $("importPickFile").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      $("importSource").value = String(reader.result || "");
      $("importSourceHint").textContent = `已读取 ${file.name}`;
      const txt = $("importSource").value.trim();
      if (txt.startsWith("{") || txt.startsWith("[")) $("importJson").value = txt;
    };
    reader.readAsText(file, "utf8");
    event.target.value = "";
  });
  $("importCopyPrompt").addEventListener("click", async () => {
    const src = $("importSource").value.trim();
    const prompt = `${repyImportSchema()}\n\n---------------- 待翻译的外来数据 ----------------\n${src || "（你还没贴外来数据，先回到第 01 步贴上再复制）"}\n\n请把上面的数据翻译成 Repy 格式，只输出 JSON。`;
    const ok = await copyText(prompt);
    showToast(ok ? "提示词已复制，发给 AI agent 就行" : "复制失败，手动选中上面的格式说明");
    logLine("import", "复制 AI 提示词");
  });
  $("importCopySchema").addEventListener("click", async () => {
    const ok = await copyText(repyImportSchema());
    showToast(ok ? "格式说明已复制" : "复制失败");
  });
  $("importParse").addEventListener("click", parseImport);
  $("importConfirm").addEventListener("click", confirmImport);

  /* ---- 分享安装包 ---- */
  $("shareBtn").addEventListener("click", async () => {
    const btn = $("shareBtn");
    const status = $("shareStatus");
    if (!window.desktop?.shareSetup) {
      status.textContent = "这个能力要在桌面版里用（浏览器预览没有打包权限）";
      showToast("浏览器预览里不能打包，用桌面版打开再试");
      return;
    }
    btn.disabled = true;
    status.textContent = "正在重新打包，可能要一两分钟…";
    try {
      const res = await window.desktop.shareSetup({ version:APP_VERSION });
      if (res?.ok) {
        status.textContent = `已保存到 ${res.path}`;
        logLine("share", `分享安装包 → ${res.path}`);
        showNotice("安装包已保存", res.path, res.rebuilt ? "这一份是刚刚重新打包的" : "用的是本机已有的安装包", NOTICE_SECONDS);
      } else if (res?.canceled) {
        status.textContent = "你取消了保存，可以随时再点一次";
      } else {
        status.textContent = res?.error || "没能打包，把报错发我看看";
        showToast(status.textContent);
      }
    } catch (err) {
      status.textContent = `打包出错：${err.message}`;
    } finally {
      btn.disabled = false;
    }
  });

  /* ---- 补记录提示开关 ---- */
  const backfillPromptSwitch = $("setBackfillPrompt");
  if (backfillPromptSwitch) {
    backfillPromptSwitch.checked = !noBackfillPrompt();
    backfillPromptSwitch.addEventListener("change", () => {
      try {
        if (backfillPromptSwitch.checked) localStorage.removeItem(BACKFILL_NO_PROMPT_KEY);
        else localStorage.setItem(BACKFILL_NO_PROMPT_KEY, "1");
      } catch (err) {}
      showToast(backfillPromptSwitch.checked ? "补记录提示已恢复" : "以后补记录不再弹提示");
    });
  }
'''


def main():
    s = io.open(TARGET, encoding="utf-8").read()
    if MARK in s:
        print("V2.1.0 功能已应用，跳过")
        return

    # 设置页
    assert OLD_EXPORT_ROW in s, "导出行未匹配"
    s = s.replace(OLD_EXPORT_ROW, NEW_EXPORT_ROW, 1)
    assert OLD_HABIT_ANCHOR in s, "操作习惯未匹配"
    s = s.replace(OLD_HABIT_ANCHOR, NEW_HABIT_ANCHOR, 1)

    # 导入弹窗：放在 noticeModal 之前
    anchor = '<div class="modal-mask" id="noticeModal" hidden>'
    assert anchor in s
    s = s.replace(anchor, IMPORT_MODAL.strip() + "\n\n" + anchor, 1)

    # notice 复选框
    assert OLD_NOTICE_FOOT in s, "notice 底部未匹配"
    s = s.replace(OLD_NOTICE_FOOT, NEW_NOTICE_FOOT, 1)

    # 补记录 CSS
    assert OLD_BACKFILL_CSS in s, "补记录 CSS 未匹配"
    s = s.replace(OLD_BACKFILL_CSS, NEW_BACKFILL_CSS, 1)

    # 更新日志
    assert OLD_RELEASE in s, "更新日志未匹配"
    s = s.replace(OLD_RELEASE, NEW_RELEASE, 1)

    # 版本号（界面内）
    s = s.replace("健身记录生成器 · V2.0.0", "Repy · 撰写与复盘 · V2.1.0")
    s = s.replace('const APP_VERSION = "2.0.0";', 'const APP_VERSION = "2.1.0";')
    s = s.replace('const RELEASE_VERSION = "2.0.0";', 'const RELEASE_VERSION = "2.1.0";')
    s = s.replace("当前 V2.0.0 · 点「检查更新」", "当前 V2.1.0 · 点「检查更新」")
    s = s.replace("更新日志 · 2026.11.23", "更新日志 · 2026.11.24")

    # showNotice 支持 opts / closeNotice 记住勾选
    old_show = '''  function showNotice(title, text, sub, seconds = NOTICE_SECONDS){
    $("noticeTitle").textContent = title;
    $("noticeText").textContent = text || "";
    $("noticeSub").textContent = sub || "";
    $("noticeSub").hidden = !sub;
    $("noticeModal").hidden = false;
    armAutoClose($("noticeModal"), seconds, closeNotice);
  }

  function closeNotice(){
    stopAutoClose($("noticeModal"));
    $("noticeModal").hidden = true;
  }'''
    new_show = '''  function showNotice(title, text, sub, seconds = NOTICE_SECONDS, opts = {}){
    $("noticeTitle").textContent = title;
    $("noticeText").textContent = text || "";
    $("noticeSub").textContent = sub || "";
    $("noticeSub").hidden = !sub;
    const optBox = $("noticeOpt");
    const opt = $("noticeNoMore");
    if (optBox && opt) {
      opt.checked = false;
      opt.dataset.key = opts.noMoreKey || "";
      optBox.hidden = !opts.noMore;
    }
    $("noticeModal").hidden = false;
    armAutoClose($("noticeModal"), seconds, closeNotice);
  }

  function closeNotice(){
    const opt = $("noticeNoMore");
    if (opt && opt.checked && opt.dataset.key) {
      try { localStorage.setItem(opt.dataset.key, "1"); } catch (err) {}
    }
    stopAutoClose($("noticeModal"));
    $("noticeModal").hidden = true;
  }'''
    assert old_show in s, "showNotice 未匹配"
    s = s.replace(old_show, new_show, 1)

    # startBackfill：不再提醒时跳过弹窗
    old_notice = '''    showNotice(
      "可以补记录了",
      "日历上的日期已经全部变成绿色。关掉这条提示后，点日历上任意一天，就会带着那一天回到「健身记录生成器」。",
      "点哪一天，就补哪一天的记录",
      NOTICE_SECONDS
    );'''
    new_notice = '''    if (noBackfillPrompt()) {
      showToast("补记录已开启 · 点日历上的绿色日期");
    } else {
      showNotice(
        "可以补记录了",
        "日历上空白的日期已经变成绿色。关掉这条提示后，点其中任意一天，就会带着那一天回到「撰写」。",
        "点哪一天，就补哪一天的记录",
        NOTICE_SECONDS,
        { noMore:true, noMoreKey:BACKFILL_NO_PROMPT_KEY }
      );
    }'''
    assert old_notice in s, "补记录弹窗未匹配"
    s = s.replace(old_notice, new_notice, 1)
    s = s.replace('"补记录模式 · 点一天开始补"', '"补记录模式 · 绿色日期可补"', 1)

    # snapshot 带上格式说明，本地 AI 接口能直接读
    old_snap = '''      weekPlan:plan,
      records:recordDb
    };'''
    new_snap = '''      weekPlan:plan,
      records:recordDb,
      importSchema:repyImportSchema()
    };'''
    assert old_snap in s, "snapshot 未匹配"
    s = s.replace(old_snap, new_snap, 1)

    # CSS / JS
    s = s.replace("</style>", CSS + "\n</style>", 1)
    last_script = s.rindex("</script>")
    s = s[:last_script] + JS + "\n" + s[last_script:]

    io.open(TARGET, "w", encoding="utf-8", newline="").write(s)
    print("V2.1.0 功能已应用：导入 / 分享 / 补记录 / 版本")


if __name__ == "__main__":
    main()
