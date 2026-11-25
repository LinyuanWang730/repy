# -*- coding: utf-8 -*-
"""V2.1.0.1：导入逻辑重做 —— 选择 JSON 文件 → 翻译成 Repy 记录 → 解析并预览。

一次性脚本，按注释锚点整段替换 src/index.html 里的导入 JS 模块，可重复执行。
弹窗 HTML 与 CSS 覆盖层由本轮直接编辑 src/index.html，脚本不覆盖它们。
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "src" / "index.html"
START_OLD = "  /* ---------- V2.1.0：导入 / 分享 / 补记录提示 ---------- */"
START_NEW = "  /* ---------- 导入：选择 JSON 文件 → 翻译成 Repy 记录 → 预览 ---------- */"
END = "  /* ---- 分享安装包 ---- */"

NEW = r'''  /* ---------- 导入：选择 JSON 文件 → 翻译成 Repy 记录 → 预览 ---------- */
  const BACKFILL_NO_PROMPT_KEY = "repy-backfill-no-prompt-v1";

  function repyImportSchema(){
    return [
      "Repy 训练记录 · 推荐 JSON 格式",
      "",
      "最稳妥的写法：",
      JSON.stringify({records:{"2026-11-05":[{times:"第 1 次",items:[
        {name:"平板卧推",group:"胸",sets:4,reps:[12,12,10,8],weight:60,isKey:true},
        {name:"上斜卧推",group:"胸",sets:3,reps:10,weight:50}
      ]}]}}, null, 2),
      "",
      "字段：date / times / note / items；items 里写 name、group、sets、",
      "reps（数字或数组）、weight、eachSide、isKey、note，缺的字段可以省略。",
      "",
      "Repy 也能读别的写法：按日期分组的对象、每条带 date 的数组、",
      "训练 App 导出的分组，以及 Repy 自己导出的备份（含 loads 的完整记录）；",
      "日期、部位、组次和重量会自动补齐。",
      "",
      "翻译要求：只输出 JSON（不要代码块标记、不要解释），存成一个 .json 文件；",
      "日期一律 YYYY-MM-DD；无法确定的字段就省略，不要编造动作；",
      "同一天多次训练写成同一天的多个条目。"
    ].join("\n");
  }

  function noBackfillPrompt(){
    try { return localStorage.getItem(BACKFILL_NO_PROMPT_KEY) === "1"; } catch (err) { return false; }
  }

  async function copyText(text){
    if (window.desktop?.copy) {
      try { await window.desktop.copy(text); return true; } catch (err) {}
    }
    try { await navigator.clipboard.writeText(text); return true; } catch (err) {}
    return false;
  }

  /* ---- 导入：翻译层 ---- */
  let importDraft = null;
  let importStats = null;
  let importFileText = "";
  let importFileName = "";

  const IMPORT_META_KEYS = ["app","version","exportedAt","generatedAt","meta","schema","count","total","user","profile","actions","settings","source","generator"];
  const IMPORT_WRAPPER_KEYS = ["records","data","logs","workouts","sessions","trainings","training","history","entries","days","result","payload","记录","训练记录","日记"];
  const IMPORT_DATE_FIELDS = ["date","day","savedDate","workoutDate","trainingDate","logDate","sessionDate","日期","训练日期","时间"];
  const IMPORT_NAME_FIELDS = ["name","action","exercise","movement","move","动作","动作名","名称","项目","title"];
  const IMPORT_LIST_FIELDS = ["items","exercises","movements","moves","exerciseList","workoutItems","动作","动作列表","训练动作","动作记录"];
  const IMPORT_GROUP_MAP = {
    "胸":"胸","胸部":"胸","胸肌":"胸","chest":"胸",
    "背":"背","背部":"背","背肌":"背","back":"背",
    "腿":"腿","腿部":"腿","下肢":"腿","leg":"腿","legs":"腿",
    "肩":"肩","肩部":"肩","三角肌":"肩","shoulder":"肩","shoulders":"肩"
  };

  function importPick(obj, fields){
    if (!obj || typeof obj !== "object") return undefined;
    for (const key of fields){
      const v = obj[key];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return undefined;
  }
  function importStr(value){ return value === undefined || value === null ? "" : String(value).trim(); }
  function importBool(value){
    if (typeof value === "string") return /^(true|1|yes|y|是|每边|对|✓|有)$/i.test(value.trim());
    return Boolean(value);
  }
  function importName(raw){
    const v = importPick(raw, IMPORT_NAME_FIELDS);
    return (typeof v === "string" || typeof v === "number") ? v : undefined;
  }
  function importGroup(raw){
    const g = importStr(importPick(raw, ["group","part","muscle","category","bodyPart","部位","肌群","分类"]));
    return IMPORT_GROUP_MAP[g] || IMPORT_GROUP_MAP[g.toLowerCase()] || "其他";
  }
  function isDateLikeKey(key){
    const s = String(key).trim();
    return /^\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}/.test(s) || /^\d{8}$/.test(s) || /^\d{1,2}[-/.月]\d{1,2}日?$/.test(s);
  }
  function importDateKey(value, fallback){
    if (value === undefined || value === null) return fallback || "";
    if (typeof value === "number" && Number.isFinite(value)){
      const d = new Date(value < 1e11 ? value * 1000 : value);
      return Number.isNaN(d.getTime()) ? (fallback || "") : dateKey(d);
    }
    const s = String(value).trim();
    if (!s) return fallback || "";
    const build = (y, m, d) => {
      const yy = Number(y), mm = Number(m), dd = Number(d);
      if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return fallback || "";
      if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return fallback || "";
      const check = new Date(yy, mm - 1, dd);
      if (check.getFullYear() !== yy || check.getMonth() !== mm - 1 || check.getDate() !== dd) return fallback || "";
      return `${yy}-${pad2(mm)}-${pad2(dd)}`;
    };
    let m = s.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
    if (m) return build(m[1], m[2], m[3]);
    m = s.match(/^(\d{4})(\d{2})(\d{2})(?:\D|$)/);
    if (m) return build(m[1], m[2], m[3]);
    m = s.match(/^(\d{1,2})[-/.月](\d{1,2})日?$/);
    if (m) return build(new Date().getFullYear(), m[1], m[2]);
    return fallback || "";
  }
  function importReps(value){
    if (value === undefined || value === null || value === "") return [];
    if (Array.isArray(value)) return value.map(v => {
      if (v && typeof v === "object") return importStr(importPick(v, ["reps","rep","次数","数量"]));
      return importStr(v);
    });
    if (typeof value === "number") return [String(value)];
    const s = importStr(value);
    if (s.startsWith("[")) {
      try { return importReps(JSON.parse(s)); } catch (err) {}
    }
    const compact = s.match(/^(\d+)\s*[×xX*]\s*(\d+)\s*(?:次|个|下)?$/);
    if (compact) return Array.from({length:Math.min(30, Number(compact[1]))}, () => compact[2]);
    return s.split(/[\/,、，|\s]+/)
      .map(v => v.replace(/^(?:共)?\d+\s*组$/, "").replace(/(次|个|下)$/, "").trim())
      .filter(Boolean);
  }
  function importMakeLoad(weight, sets, reps, eachSide, target){
    const count = Math.max(1, Math.min(30, Math.floor(Number(sets) || 1)));
    const list = Array.from({length:count}, (_, i) => importStr(reps[i] ?? reps[reps.length - 1] ?? ""));
    const filled = list.filter(Boolean);
    const same = !filled.length || new Set(filled).size === 1;
    return {
      weight:importStr(weight),
      eachSide:Boolean(eachSide),
      sets:count,
      setsExplicit:true,
      repMode:same ? "same" : "each",
      sameRep:same ? (filled[0] || "") : "",
      reps:list,
      target:importStr(target)
    };
  }
  function importNormalizeLoad(load){
    return importMakeLoad(
      load.weight, load.sets,
      Array.isArray(load.reps) ? load.reps : (load.sameRep ? [load.sameRep] : []),
      load.eachSide, load.target
    );
  }
  function importLoad(raw){
    if (Array.isArray(raw.loads) && raw.loads.length){
      const loads = raw.loads.filter(l => l && typeof l === "object").map(importNormalizeLoad);
      if (loads.length) return loads;
    }
    const eachSide = importBool(importPick(raw, ["eachSide","perSide","each","每边","单侧"]));
    const target = importStr(importPick(raw, ["target","目标","目标次数"]));
    const groupSets = Array.isArray(raw.sets) && raw.sets.length &&
      raw.sets.every(s => s && typeof s === "object" && (s.weight !== undefined || s.reps !== undefined || s.weightKg !== undefined))
      ? raw.sets : null;
    if (groupSets){
      const reps = groupSets.map(s => importStr(importPick(s, ["reps","rep","次数","数量"])));
      const weight = importStr(importPick(groupSets[0], ["weight","weightKg","kg","重量"]));
      return [importMakeLoad(weight, groupSets.length, reps, eachSide, target)];
    }
    let setsRaw = importPick(raw, ["sets","set","setCount","组数","组"]);
    let repsRaw = importPick(raw, ["reps","rep","repetitions","次数","每组次数","每组数量","数量","repCount"]);
    let sets = Math.max(1, Math.min(30, Math.floor(Number(setsRaw) || 1)));
    if (typeof repsRaw === "string"){
      const m = importStr(repsRaw).match(/^(\d+)\s*组\s*/);
      if (m){
        sets = Math.max(1, Math.min(30, Number(m[1])));
        repsRaw = importStr(repsRaw).slice(m[0].length);
      }
    }
    let reps = importReps(repsRaw);
    if (!setsRaw && reps.length > 1) sets = Math.min(30, reps.length);
    const weight = importStr(importPick(raw, ["weight","weightKg","kg","load","重量","负荷","负重"]));
    return [importMakeLoad(weight, sets, reps, eachSide, target)];
  }

  /* 把任意外来 JSON 展平成「日期 + 动作」，再逐条转成 Repy 内部记录 */
  function translateToRepy(data){
    if (!data || typeof data !== "object") throw new Error("文件里没有训练记录");
    const rawRecords = [];
    const batches = new Map();
    let batchSeq = 0;
    let lastDate = "";
    let noDate = 0;

    const pushAction = (raw, date, batchId) => {
      if (!date){ noDate += 1; return; }
      const key = `${date}||${batchId || `s${rawRecords.length}`}`;
      let rec = batches.get(key);
      if (!rec){
        rec = {date, times:"", note:"", rawItems:[], savedAt:undefined};
        batches.set(key, rec);
        rawRecords.push(rec);
      }
      rec.rawItems.push(raw);
      lastDate = date;
    };
    const firstList = obj => {
      for (const key of IMPORT_LIST_FIELDS){
        if (Array.isArray(obj[key]) && obj[key].length) return obj[key];
      }
      if (Array.isArray(obj.sets) && obj.sets.length && obj.sets.some(s => s && typeof s === "object" && importName(s))) return obj.sets;
      return null;
    };
    const walk = (node, dateHint, batchId, depth) => {
      if (depth > 10 || node === null || node === undefined) return;
      if (Array.isArray(node)){
        const id = `a${++batchSeq}`;
        node.forEach(v => walk(v, dateHint, id, depth + 1));
        return;
      }
      if (typeof node !== "object") return;
      const keys = Object.keys(node);
      const dateKeys = keys.filter(isDateLikeKey);
      if (dateKeys.length && keys.every(k => dateKeys.includes(k) || IMPORT_META_KEYS.includes(k))){
        dateKeys.forEach(k => walk(node[k], importDateKey(k, ""), null, depth + 1));
        return;
      }
      const ownDate = importDateKey(importPick(node, IMPORT_DATE_FIELDS), "");
      const date = ownDate || dateHint || lastDate;
      if (ownDate) lastDate = ownDate;
      const list = firstList(node);
      if (list){
        rawRecords.push({
          date,
          times:importStr(importPick(node, ["times","session","第几次","训练次数","场次"])),
          note:importStr(importPick(node, ["note","notes","remark","备注","说明"])),
          savedAt:node.savedAt,
          rawItems:list.slice()
        });
        return;
      }
      if (importName(node)){ pushAction(node, date, batchId); return; }
      const wrapper = IMPORT_WRAPPER_KEYS.find(k => node[k] && typeof node[k] === "object");
      if (wrapper){ walk(node[wrapper], date, null, depth + 1); return; }
      keys.forEach(k => {
        if (IMPORT_META_KEYS.includes(k)) return;
        const v = node[k];
        if (!v || typeof v !== "object") return;
        const kd = isDateLikeKey(k) ? importDateKey(k, date) : date;
        walk(v, kd, batchId, depth + 1);
      });
    };
    walk(data, "", null, 0);
    if (!rawRecords.length) throw new Error("没找到带动作的训练记录，这个文件的结构没认出来");

    const out = {};
    let translated = 0;
    rawRecords.forEach(rec => {
      const date = importDateKey(rec.date, "");
      if (!date){ noDate += 1; return; }
      const items = rec.rawItems
        .filter(raw => raw && typeof raw === "object" && importName(raw))
        .map(raw => {
          if (!Array.isArray(raw.loads) || !raw.loads.length) translated += 1;
          return {
            actionId:`imported-${importStr(importName(raw))}`,
            name:importStr(importName(raw)),
            group:importGroup(raw),
            isKey:importBool(importPick(raw, ["isKey","key","isPR","pr","关键重量","重点"])),
            note:importStr(importPick(raw, ["note","notes","remark","备注","说明"])),
            loads:importLoad(raw)
          };
        });
      if (!items.length) return;
      if (!Array.isArray(out[date])) out[date] = [];
      const stamp = Number(rec.savedAt);
      out[date].push({
        id:uid("rec"),
        savedAt:Number.isFinite(stamp) && stamp > 0 ? stamp : new Date(`${date}T20:00:00`).getTime(),
        savedDate:date,
        imported:true,
        times:importStr(rec.times),
        note:importStr(rec.note),
        text:textFromItems(items),
        items
      });
    });
    if (!Object.keys(out).length){
      throw new Error(noDate
        ? "记录里没写清日期，至少给个 2026-11-05 或 11/5 这样的日期"
        : "没有可导入的动作");
    }
    const format = data && data.app === "fitness-log-generator" ? "Repy 备份"
      : (!Array.isArray(data) && data && data.records ? "标准记录文件" : "外来训练记录");
    return {
      records:out,
      days:Object.keys(out).length,
      recs:Object.values(out).reduce((n, l) => n + l.length, 0),
      acts:Object.values(out).reduce((n, l) => n + l.reduce((m, r) => m + r.items.length, 0), 0),
      translated,
      format
    };
  }

  /* ---- 导入：文件与界面 ---- */
  function resetImport(){
    importDraft = null;
    importStats = null;
    importFileText = "";
    importFileName = "";
    $("importFile").value = "";
    $("importFileName").textContent = "还没选择文件";
    $("importFileMeta").textContent = "支持 .json，单个文件";
    $("importDrop").classList.remove("has-file", "is-over");
    const preview = $("importPreview");
    preview.hidden = true;
    preview.innerHTML = "";
    preview.classList.remove("is-error");
    $("importHint").textContent = "还没选择文件";
    $("importParse").disabled = true;
    $("importSaveFile").disabled = true;
    $("importConfirm").disabled = true;
  }
  function openImport(){
    resetImport();
    $("importSchemaText").textContent = repyImportSchema();
    $("importAiBox").open = false;
    $("importModal").hidden = false;
  }
  function closeImport(){
    $("importModal").hidden = true;
    importDraft = null;
    importStats = null;
    importFileText = "";
  }
  function importFail(message){
    const preview = $("importPreview");
    preview.hidden = false;
    preview.classList.add("is-error");
    preview.innerHTML = `<b>没能解析</b>：${escapeHtml(message)}<p>手头是文字或表格的话，展开下面让 AI 帮你转成一个 .json 文件。</p>`;
    $("importHint").textContent = "解析失败";
    $("importSaveFile").disabled = true;
    $("importConfirm").disabled = true;
    importDraft = null;
    importStats = null;
  }
  function readImportFile(file){
    if (!file) return;
    if (file.size > 8 * 1024 * 1024){ importFail("文件超过 8 MB，拆小一点再来"); return; }
    const reader = new FileReader();
    reader.onerror = () => importFail("文件读不出来，换一个试试");
    reader.onload = () => {
      importFileText = String(reader.result || "").replace(/^\uFEFF/, "");
      importFileName = file.name;
      importDraft = null;
      importStats = null;
      $("importFileName").textContent = file.name;
      $("importFileMeta").textContent = `${Math.max(1, Math.round(file.size / 1024))} KB · 已读好，可以解析了`;
      $("importDrop").classList.add("has-file");
      $("importPreview").hidden = true;
      $("importSaveFile").disabled = true;
      $("importConfirm").disabled = true;
      $("importParse").disabled = false;
      $("importHint").textContent = "文件已读好，点「解析并预览」";
    };
    reader.readAsText(file, "utf8");
  }
  function parseImportJson(raw){
    const clean = raw.replace(/^\uFEFF/, "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    if (!clean) throw new Error("文件是空的");
    try { return JSON.parse(clean); } catch (err) {}
    const parts = clean.split(/\r?\n/)
      .map(s => s.trim().replace(/,$/, ""))
      .filter(Boolean)
      .map(s => { try { return JSON.parse(s); } catch (err) { return null; } })
      .filter(Boolean);
    if (parts.length) return parts.length === 1 ? parts[0] : parts;
    throw new Error("这不是完整的 JSON 文件，内容可能被截断了");
  }
  function parseImport(){
    const preview = $("importPreview");
    if (!importFileText.trim()){ importFail("先在第 01 步选一个 JSON 文件"); return; }
    try {
      const result = translateToRepy(parseImportJson(importFileText));
      importDraft = result.records;
      importStats = result;
      preview.hidden = false;
      preview.classList.remove("is-error");
      const days = Object.keys(importDraft).sort();
      const sample = days.slice(0, 4).map(key => {
        const r = importDraft[key][0];
        const names = r.items.slice(0, 3).map(i => i.name).join("、");
        return `<li><b>${key}</b> · ${r.items.length} 个动作 · ${escapeHtml(names)}${r.items.length > 3 ? "…" : ""}</li>`;
      }).join("");
      const lines = days.slice(0, 2).map(key => {
        const r = importDraft[key][0];
        return `${key}${r.times ? " · " + r.times : ""}\n` +
          r.items.slice(0, 4).map(i => "  " + textFromItems([i])).join("\n");
      }).join("\n");
      preview.innerHTML = `
        <div class="imp-summary"><b>翻译完成</b>：${escapeHtml(result.format)} → ${result.days} 天 / ${result.recs} 条记录 / ${result.acts} 个动作${result.translated ? `，其中 ${result.translated} 个外来动作已转成 Repy 记录` : ""}。确认后会并进已有记录，不会覆盖。</div>
        <ul>${sample}</ul>
        <div class="imp-lines">Repy 读到的内容：\n${escapeHtml(lines)}</div>`;
      $("importHint").textContent = `${result.days} 天 · ${result.recs} 条 · ${result.acts} 个动作`;
      $("importSaveFile").disabled = false;
      $("importConfirm").disabled = false;
      logLine("import", `翻译待导入 ${result.days} 天 / ${result.recs} 条 · ${result.format}`);
    } catch (err) {
      importFail(err && err.message ? err.message : String(err));
    }
  }
  function saveTranslatedFile(){
    if (!importDraft) return;
    const payload = {app:"fitness-log-generator", version:APP_VERSION, exportedAt:new Date().toISOString(), records:importDraft};
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `repy-${dateKey(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    showToast("已保存成 Repy 能读的记录文件");
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
  $("importPickFile").addEventListener("click", event => {
    event.stopPropagation();
    $("importFile").click();
  });
  $("importDrop").addEventListener("click", event => {
    if (event.target.closest("button")) return;
    $("importFile").click();
  });
  $("importDrop").addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " "){ event.preventDefault(); $("importFile").click(); }
  });
  $("importFile").addEventListener("change", event => {
    const file = event.target.files && event.target.files[0];
    readImportFile(file);
    event.target.value = "";
  });
  ["dragenter", "dragover"].forEach(type => $("importDrop").addEventListener(type, event => {
    event.preventDefault();
    $("importDrop").classList.add("is-over");
  }));
  ["dragleave", "dragend"].forEach(type => $("importDrop").addEventListener(type, () => {
    $("importDrop").classList.remove("is-over");
  }));
  $("importDrop").addEventListener("drop", event => {
    event.preventDefault();
    $("importDrop").classList.remove("is-over");
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    readImportFile(file);
  });
  $("importCopyPrompt").addEventListener("click", async () => {
    const prompt = `${repyImportSchema()}\n\n---------------- 怎么给我文件 ----------------\n把你的训练记录（表格、备忘录、打卡文字）连同上面的格式一起发给 AI agent，请它翻译好并把结果存成一个 .json 文件，再回到 Repy 的第 01 步选这个文件。\n\n请只输出 JSON，不要解释。`;
    const ok = await copyText(prompt);
    showToast(ok ? "提示词已复制，连记录一起发给 AI 就行" : "复制失败，手动选中上面的格式说明");
    logLine("import", "复制 AI 提示词");
  });
  $("importCopySchema").addEventListener("click", async () => {
    const ok = await copyText(repyImportSchema());
    showToast(ok ? "格式说明已复制" : "复制失败");
  });
  $("importSaveFile").addEventListener("click", saveTranslatedFile);
  $("importParse").addEventListener("click", parseImport);
  $("importConfirm").addEventListener("click", confirmImport);

'''

html = TARGET.read_text(encoding="utf-8")
start = START_NEW if START_NEW in html else (START_OLD if START_OLD in html else None)
if not start or END not in html:
    raise SystemExit("锚点没找到，脚本未改动任何内容")
a = html.index(start)
b = html.index(END, a)
with open(TARGET, "w", encoding="utf-8", newline="\n") as f:
    f.write(html[:a] + NEW + html[b:])
print("导入模块已替换：", a, "→", b, "字符", len(NEW))
