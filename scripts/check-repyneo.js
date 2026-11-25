/**
 * RepyNeo 小程序工程静态自检。
 * 用法：node scripts/check-repyneo.js
 * 检查：JSON 可解析 / 页面四件套齐全 / 图标存在 / 所有 js 语法 /
 *       wxml 里绑定的方法在对应 page 里真的存在 / 版本号只出现在设置页 /
 *       部位标签底色必须用高透明度 tint（不许回退成不透明的部位原色）/
 *       数值框必须弹数字键盘、文本描述框必须保留全键盘。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', 'repyneo');
const problems = [];
const notes = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

/* 1. 所有 JSON */
const jsonFiles = [];
(function walk(dir) {
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).forEach(entry => {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel);
    else if (entry.name.endsWith('.json')) jsonFiles.push(rel);
  });
})('.');
jsonFiles.forEach(rel => {
  try {
    JSON.parse(read(rel));
  } catch (err) {
    problems.push(`${rel} 不是合法 JSON：${err.message}`);
  }
});
notes.push(`JSON 文件 ${jsonFiles.length} 个`);

/* 2. app.json 的页面与图标 */
const app = JSON.parse(read('app.json'));
app.pages.forEach(page => {
  ['.js', '.wxml', '.wxss', '.json'].forEach(ext => {
    if (!exists(page + ext)) problems.push(`缺文件 ${page + ext}`);
  });
});
(app.tabBar.list || []).forEach(tab => {
  if (app.pages.indexOf(tab.pagePath) < 0) problems.push(`tabBar 页面没注册 ${tab.pagePath}`);
  [tab.iconPath, tab.selectedIconPath].forEach(icon => {
    if (!exists(icon)) problems.push(`缺图标 ${icon}`);
  });
});
notes.push(`页面 ${app.pages.length} 个 / tab ${app.tabBar.list.length} 个`);

/* 3. js 语法 + wxml 绑定的方法是否存在 */
const jsFiles = [];
(function walk(dir) {
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).forEach(entry => {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel);
    else if (entry.name.endsWith('.js')) jsFiles.push(rel);
  });
})('.');
jsFiles.forEach(rel => {
  const code = read(rel);
  try {
    new vm.Script(code, { filename: rel });
  } catch (err) {
    problems.push(`${rel} 语法错误：${err.message}`);
  }
});
notes.push(`JS 文件 ${jsFiles.length} 个`);

app.pages.forEach(page => {
  const js = read(page + '.js');
  const wxml = read(page + '.wxml');
  const defined = new Set();
  const methodPattern = /\n\s{2}([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g;
  let match;
  while ((match = methodPattern.exec(js))) defined.add(match[1]);
  const bound = new Set();
  const eventPattern = /\b(?:bind|catch)[a-zA-Z]*\s*=\s*"([^"{}]+)"/g;
  while ((match = eventPattern.exec(wxml))) bound.add(match[1].trim());
  bound.forEach(name => {
    if (!defined.has(name)) problems.push(`${page}.wxml 绑定了 ${name}，但 ${page}.js 里没有这个方法`);
  });
  notes.push(`${page.split('/').pop()}：${defined.size} 个方法 / ${bound.size} 个绑定`);
});

/* 4. 版本号只出现在设置页 */
app.pages.forEach(page => {
  const wxml = read(page + '.wxml');
  const js = read(page + '.js');
  const hit = /version|V\d+\.\d+|版本号/.test(wxml + js);
  const isSettings = page.indexOf('settings') >= 0;
  if (hit && !isSettings && /\{\{version\}\}|V\d+\.\d+/.test(wxml)) {
    problems.push(`${page} 出现了版本号（要求只在设置页显示）`);
  }
});

/* 5. 设置页不能出现被删掉的五个抽屉 */
const settingsText = read('pages/settings/settings.wxml') + read('pages/settings/settings.js');
['Repy 说', '分享软件给朋友', 'AI 接入', 'AI接入', '数据位置', '卸载'].forEach(word => {
  if (settingsText.indexOf(word) >= 0) problems.push(`设置页还留着「${word}」`);
});

/* 6. 固定台词（两行：问候一行，提示一行） */
const BOT_HALF = ['你好，我是RepyNeo。', '选动作、定组次、保存复制。'];
app.pages.forEach(page => {
  const text = read(page + '.wxml') + read(page + '.js');
  if (text.indexOf('botLine') >= 0 && BOT_HALF.some(half => text.indexOf(half) < 0)) {
    problems.push(`${page} 的机器人台词不是固定的「${BOT_HALF.join('')}」`);
  }
});

/* 7. 补记录 / 一周安排编辑器 / 深灰文字 / 圆角选项卡 */
const writeJs = read('pages/write/write.js');
const writeWxml = read('pages/write/write.wxml');
const reviewJs = read('pages/review/review.js');
const reviewWxml = read('pages/review/review.wxml');
const settingsJs = read('pages/settings/settings.js');

if (reviewWxml.indexOf('补记录') < 0 || reviewJs.indexOf('toggleBackfill') < 0) {
  problems.push('复盘页缺补记录入口');
}
if (writeWxml.indexOf('backfillDate') < 0 || writeJs.indexOf('cancelBackfill') < 0) {
  problems.push('撰写页缺补记录提示条');
}
if (writeJs.indexOf('backfillKey') < 0 || writeJs.indexOf('store.clearBackfill()') < 0) {
  problems.push('撰写页保存时没有把记录补进选中的那天');
}
/* 力量动作的多组重量：第二步要能加一组、删一组，和桌面版「新增重量 / 组次」对齐 */
if (writeJs.indexOf('addLoad(') < 0 || writeJs.indexOf('removeLoad(') < 0) {
  problems.push('撰写页第二步缺多组重量的加 / 删方法');
}
if (writeWxml.indexOf('bindtap="addLoad"') < 0 || writeWxml.indexOf('＋ 新增重量 / 组次') < 0) {
  problems.push('撰写页力量卡片缺「＋ 新增重量 / 组次」按钮');
}
if (writeWxml.indexOf('bindtap="removeLoad"') < 0) {
  problems.push('撰写页的重量行缺删除入口');
}
['copyPlanFrom', 'clearPlanPicked', 'removePlanPicked', 'togglePlanCopy'].forEach(fn => {
  if (writeJs.indexOf(fn) < 0) problems.push(`改一周安排缺 ${fn}`);
});
['openPlanEdit', 'copyPlanFrom', 'clearPlanPicked', 'savePlanEdit'].forEach(fn => {
  if (settingsJs.indexOf(fn) < 0) problems.push(`设置页改一周安排缺 ${fn}`);
});
if (settingsJs.indexOf('planEditorDay') >= 0 || /switchTab[^;]*write/.test(settingsJs)) {
  problems.push('设置页还在跳撰写页改安排，应就地编辑');
}

/* 动作名 / 部位字不许再用部位索引色（底色 background 用索引色是允许的） */
app.pages.forEach(page => {
  const wxml = read(page + '.wxml');
  if (/color:\s*\{\{[^}]*\.color/.test(wxml) || /color:'\s*\+\s*[^}]*\.color/.test(wxml)) {
    problems.push(`${page}.wxml 里动作文字还在用部位索引色`);
  }
});

/* 部位选项卡统一圆角矩形，不再是胶囊 */
['pages/write/write.wxss', 'pages/review/review.wxss', 'pages/settings/settings.wxss'].forEach(rel => {
  const css = read(rel);
  const start = css.indexOf('.group-tab {');
  const end = css.indexOf('.group-tab.on');
  const block = start >= 0 ? css.slice(start, end >= 0 ? end : css.length) : '';
  if (!block || block.indexOf('999rpx') >= 0 || block.indexOf('var(--r)') < 0) {
    problems.push(`${rel} 的部位选项卡不是统一弧度的圆角矩形`);
  }
});

/* 8. 动作/部位标签的底色必须是高透明度纯色块（tint），不许用不透明的部位原色 */
app.pages.forEach(page => {
  const wxml = read(page + '.wxml');
  wxml.split('\n').forEach((line, i) => {
    /* 只看动作/部位标签；耗能评级条（effort-bar / stage / rec-eff）用的是评级色，不在此列 */
    if (!/class="[^"]*(plan-chip|pool-item|entry|picker-item|picked-chip|rec-part)/.test(line)) return;
    const m = line.match(/style="[^"]*background:\{\{([^}]+)\}\}/);
    if (!m) return;
    const expr = m[1].toLowerCase();
    if (expr.indexOf('color') >= 0 && expr.indexOf('tint') < 0) {
      problems.push(`${page}.wxml 第 ${i + 1} 行动作标签底色用了不透明的部位原色，应该改用 tint（高透明度）`);
    }
  });
});
const poolJs = read('utils/pool.js');
const tintAlpha = poolJs.match(/hexToRgba\(color,\s*(0?\.\d+)\)/);
if (!tintAlpha || Number(tintAlpha[1]) > 0.25) {
  problems.push('utils/pool.js 的 groupTint 不是高透明度色块（alpha 应 ≤ 0.25）');
}

/* 9. 数值框必须弹数字键盘；文本描述框必须保留全键盘 */
const numericRules = [
  { re: /placeholder="重量"/, type: 'digit' },
  { re: /placeholder="配速"/, type: 'digit' },
  { re: /placeholder="次数"/, type: 'number' },
  { re: /placeholder="\{\{ri \+ 1\}\}"/, type: 'number' }
];
const textRules = [
  /placeholder="规格/, /placeholder="附加/, /placeholder="备注/,
  /placeholder="搜动作名/, /placeholder="动作名字/, /placeholder="给这天起个名字/
];
['pages/write/write.wxml', 'pages/review/review.wxml'].forEach(rel => {
  read(rel).split('\n').forEach((line, i) => {
    numericRules.forEach(rule => {
      if (rule.re.test(line) && line.indexOf(`type="${rule.type}"`) < 0) {
        problems.push(`${rel} 第 ${i + 1} 行数值框没弹数字键盘（应加 type="${rule.type}"）`);
      }
    });
    if (textRules.some(re => re.test(line)) && /type="(digit|number)"/.test(line)) {
      problems.push(`${rel} 第 ${i + 1} 行文本描述框被设成数字键盘，会打不出中文/单位`);
    }
  });
});

console.log(notes.map(line => '  · ' + line).join('\n'));
if (problems.length) {
  console.log('\n发现 ' + problems.length + ' 个问题：');
  problems.forEach(p => console.log('  ✗ ' + p));
  process.exit(1);
}
console.log('\nRepyNeo 静态自检通过');
