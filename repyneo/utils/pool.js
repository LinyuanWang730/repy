/**
 * Repy 动作池 —— 由 scripts/gen-repyneo-pool.js 从桌面版 src/index.html 生成，不要手改。
 * actionId 与桌面版完全一致，两边互传的 JSON 才对得上动作和趋势。
 */

const GROUPS = {
    "胸": {color:"#e08f4a", order:1},
    "背": {color:"#54ad7c", order:2},
    "腿": {color:"#4f9fd4", order:3},
    "肩": {color:"#9078cf", order:4},
    "手臂": {color:"#dfb43c", order:5},
    "腹/核心": {color:"#e6908f", order:6},
    "有氧": {color:"#5aaeb9", order:7}
  };

const BASE_ACTIONS = [
    {id:"bench", name:"杠铃卧推", aliases:"平板卧推", group:"胸", latest:"", priority:1, common:true},
    {id:"incline-db", name:"哑铃上斜卧推", aliases:"上斜哑铃卧推", group:"胸", latest:"", priority:2, common:true},
    {id:"incline-barbell", name:"杠铃上斜卧推", aliases:"上斜卧推", group:"胸", latest:"", priority:3},
    {id:"seated-machine-press", name:"器械坐姿推胸", aliases:"坐姿推胸", group:"胸", latest:"", priority:4},
    {id:"incline-machine-press", name:"上斜器械推胸", aliases:"上斜推胸", group:"胸", latest:"", priority:5},
    {id:"pec-deck", name:"蝴蝶机夹胸", aliases:"夹胸", group:"胸", latest:"", priority:6, common:true},
    {id:"cable-crossover", name:"绳索夹胸", aliases:"龙门架夹胸", group:"胸", latest:"", priority:7},
    {id:"standing-db-squeeze", name:"站姿哑铃夹胸", aliases:"站姿夹胸", group:"胸", latest:"", priority:8},
    {id:"db-fly", name:"哑铃平板飞鸟", aliases:"平板飞鸟", group:"胸", latest:"", priority:9},
    {id:"push-up", name:"俯卧撑", aliases:"自重推", group:"胸", latest:"", priority:10},
    {id:"dip", name:"双杠臂屈伸", aliases:"双杠撑 / 下胸", group:"胸", latest:"", priority:11},
    {id:"decline-press", name:"哑铃下斜卧推", aliases:"下斜卧推", group:"胸", latest:"", priority:12},
    {id:"smith-bench", name:"史密斯卧推", aliases:"史密斯平板", group:"胸", latest:"", priority:13},

    {id:"lat-pulldown", name:"高位下拉", aliases:"下拉", group:"背", latest:"", priority:1, common:true},
    {id:"seated-row", name:"坐姿划船", aliases:"坐姿绳索划船", group:"背", latest:"", priority:2, common:true},
    {id:"chest-row", name:"胸支撑划船", aliases:"支撑划船", group:"背", latest:"", priority:3},
    {id:"barbell-row", name:"杠铃俯身划船", aliases:"俯身划船", group:"背", latest:"", priority:4},
    {id:"one-arm-row", name:"单手哑铃划船", aliases:"单臂划船", group:"背", latest:"", priority:5},
    {id:"assisted-pullup", name:"辅助引体向上", aliases:"辅助引体", group:"背", latest:"", priority:6},
    {id:"pull-up", name:"引体向上", aliases:"自重引体", group:"背", latest:"", priority:7},
    {id:"straight-arm", name:"直臂下压", aliases:"直臂下拉", group:"背", latest:"", priority:8, common:true},
    {id:"x-frame-pulldown", name:"叉型架下拉", aliases:"", group:"背", latest:"", priority:9},
    {id:"t-bar-row", name:"T 杠划船", aliases:"T 杆划船", group:"背", latest:"", priority:10},
    {id:"shrug", name:"杠铃耸肩", aliases:"耸肩", group:"背", latest:"", priority:11},
    {id:"back-extension", name:"山羊挺身", aliases:"下背伸展", group:"背", latest:"", priority:12},
    {id:"lat-pullover", name:"哑铃直臂上拉", aliases:"仰卧上拉", group:"背", latest:"", priority:13},

    {id:"barbell-squat", name:"杠铃深蹲", aliases:"自由深蹲", group:"腿", latest:"", priority:1},
    {id:"hack-squat", name:"哈克深蹲", aliases:"哈克", group:"腿", latest:"", priority:2, common:true},
    {id:"leg-press", name:"腿举机", aliases:"蹬腿机", group:"腿", latest:"", priority:3, common:true},
    {id:"reverse-leg-press", name:"倒蹬机", aliases:"反向腿举", group:"腿", latest:"", priority:4},
    {id:"bulgarian", name:"保加利亚分腿蹲", aliases:"保加利亚", group:"腿", latest:"", priority:5},
    {id:"lunge", name:"哑铃箭步蹲", aliases:"箭步蹲", group:"腿", latest:"", priority:6},
    {id:"romanian-deadlift", name:"罗马尼亚硬拉", aliases:"直腿硬拉", group:"腿", latest:"", priority:7, common:true},
    {id:"deadlift", name:"传统硬拉", aliases:"硬拉", group:"腿", latest:"", priority:8},
    {id:"leg-extension", name:"器械腿屈伸", aliases:"坐姿腿屈伸", group:"腿", latest:"", priority:9, common:true},
    {id:"leg-curl", name:"俯卧腿弯举", aliases:"腿弯举", group:"腿", latest:"", priority:10, common:true},
    {id:"adductor", name:"腿内收", aliases:"内收肌", group:"腿", latest:"", priority:11},
    {id:"abductor", name:"腿外展", aliases:"外展肌", group:"腿", latest:"", priority:12},
    {id:"calf-raise", name:"站姿提踵", aliases:"提踵", group:"腿", latest:"", priority:13, common:true},
    {id:"hip-thrust", name:"杠铃臀推", aliases:"臀桥", group:"腿", latest:"", priority:14},
    {id:"smith-squat", name:"史密斯深蹲", aliases:"史密斯蹲", group:"腿", latest:"", priority:15},

    {id:"seated-db-shoulder", name:"坐姿哑铃推肩", aliases:"直角臂向上举", group:"肩", latest:"", priority:1, common:true},
    {id:"seated-smith-shoulder", name:"坐姿史密斯推肩", aliases:"史密斯推肩", group:"肩", latest:"", priority:2},
    {id:"barbell-ohp", name:"杠铃站姿推举", aliases:"实力推", group:"肩", latest:"", priority:3},
    {id:"arnold-press", name:"阿诺德推举", aliases:"旋转推举", group:"肩", latest:"", priority:4},
    {id:"face-pull", name:"绳索面拉", aliases:"面拉", group:"肩", latest:"", priority:5, common:true},
    {id:"forehand-lateral", name:"哑铃正手侧平举", aliases:"侧平举", group:"肩", latest:"", priority:6, common:true},
    {id:"reverse-grip-lateral", name:"哑铃反手侧平举", aliases:"反手侧平举", group:"肩", latest:"", priority:7},
    {id:"incline-lateral", name:"上斜哑铃侧平举", aliases:"斜板侧平举", group:"肩", latest:"", priority:8},
    {id:"cable-lateral", name:"绳索侧平举", aliases:"龙门侧平举", group:"肩", latest:"", priority:9},
    {id:"reverse-pec", name:"蝴蝶机反向飞鸟", aliases:"反向蝴蝶机", group:"肩", latest:"", priority:10, common:true},
    {id:"bent-over-fly", name:"哑铃俯身飞鸟", aliases:"俯身飞鸟", group:"肩", latest:"", priority:11},
    {id:"front-raise", name:"哑铃前平举", aliases:"前平举", group:"肩", latest:"", priority:12},
    {id:"upright-row", name:"杠铃直立划船", aliases:"直立划船", group:"肩", latest:"", priority:13},

    {id:"barbell-curl", name:"杠铃弯举", aliases:"直杆弯举 / 二头弯举", group:"手臂", latest:"", priority:1, common:true},
    {id:"db-curl", name:"哑铃交替弯举", aliases:"哑铃弯举 / 交替弯举", group:"手臂", latest:"", priority:2, common:true},
    {id:"hammer-curl", name:"锤式弯举", aliases:"锤式", group:"手臂", latest:"", priority:3, common:true},
    {id:"preacher-curl", name:"牧师凳弯举", aliases:"斜托弯举", group:"手臂", latest:"", priority:4},
    {id:"cable-curl", name:"绳索弯举", aliases:"龙门弯举", group:"手臂", latest:"", priority:5},
    {id:"concentration-curl", name:"集中弯举", aliases:"单臂集中弯举", group:"手臂", latest:"", priority:6},
    {id:"reverse-curl", name:"反握弯举", aliases:"反手弯举", group:"手臂", latest:"", priority:7},
    {id:"close-grip-bench", name:"窄距卧推", aliases:"窄推", group:"手臂", latest:"", priority:8, common:true},
    {id:"triceps-pushdown", name:"绳索下压", aliases:"三头下压 / 直杆下压", group:"手臂", latest:"", priority:9, common:true},
    {id:"overhead-triceps", name:"哑铃颈后臂屈伸", aliases:"过顶臂屈伸", group:"手臂", latest:"", priority:10},
    {id:"skull-crusher", name:"仰卧臂屈伸", aliases:"碎颅者", group:"手臂", latest:"", priority:11},
    {id:"bench-dip", name:"凳上臂屈伸", aliases:"长凳撑体", group:"手臂", latest:"", priority:12},

    {id:"crunch", name:"卷腹", aliases:"仰卧卷腹", group:"腹/核心", latest:"", priority:1, common:true},
    {id:"plank", name:"平板支撑", aliases:"平板", group:"腹/核心", latest:"", priority:2, common:true},
    {id:"hanging-leg-raise", name:"悬垂举腿", aliases:"吊杠举腿", group:"腹/核心", latest:"", priority:3},
    {id:"leg-raise", name:"仰卧举腿", aliases:"平躺举腿", group:"腹/核心", latest:"", priority:4},
    {id:"cable-crunch", name:"绳索卷腹", aliases:"龙门卷腹", group:"腹/核心", latest:"", priority:5},
    {id:"ab-wheel", name:"健腹轮", aliases:"腹肌轮", group:"腹/核心", latest:"", priority:6},
    {id:"russian-twist", name:"俄罗斯转体", aliases:"转体", group:"腹/核心", latest:"", priority:7},
    {id:"side-plank", name:"侧平板支撑", aliases:"侧撑", group:"腹/核心", latest:"", priority:8},
    {id:"mountain-climber", name:"登山跑", aliases:"登山者", group:"腹/核心", latest:"", priority:9},
    {id:"dead-bug", name:"死虫式", aliases:"死虫", group:"腹/核心", latest:"", priority:10},
    {id:"pallof-press", name:"帕洛夫推", aliases:"抗旋转推", group:"腹/核心", latest:"", priority:11},
    {id:"sit-up", name:"仰卧起坐", aliases:"起坐", group:"腹/核心", latest:"", priority:12},

    {id:"running", name:"跑步", aliases:"路跑 / 慢跑", group:"有氧", latest:"", priority:1, common:true, type:"cardio"},
    {id:"treadmill", name:"跑步机", aliases:"机跑", group:"有氧", latest:"", priority:2, common:true, type:"cardio"},
    {id:"stairs", name:"爬楼梯", aliases:"爬楼 / 爬坡", group:"有氧", latest:"", priority:3, common:true, type:"cardio"},
    {id:"cycling", name:"骑行", aliases:"骑车 / 单车", group:"有氧", latest:"", priority:4, type:"cardio"},
    {id:"spinning", name:"动感单车", aliases:"单车课", group:"有氧", latest:"", priority:5, type:"cardio"},
    {id:"swimming", name:"游泳", aliases:"自由泳 / 蛙泳", group:"有氧", latest:"", priority:6, type:"cardio"},
    {id:"rowing", name:"划船机", aliases:"划船", group:"有氧", latest:"", priority:7, type:"cardio"},
    {id:"jump-rope", name:"跳绳", aliases:"跳绳子", group:"有氧", latest:"", priority:8, type:"cardio"},
    {id:"elliptical", name:"椭圆机", aliases:"椭圆", group:"有氧", latest:"", priority:9, type:"cardio"},
    {id:"hiking", name:"爬坡走", aliases:"坡度走", group:"有氧", latest:"", priority:10, type:"cardio"},
    {id:"basketball", name:"篮球", aliases:"打球 / 篮球课", group:"有氧", latest:"", priority:11, type:"cardio"},
    {id:"badminton", name:"羽毛球", aliases:"打球", group:"有氧", latest:"", priority:12, type:"cardio"}
  ];

const isCardio = action => Boolean(action && action.type === 'cardio');

const GROUP_ORDER = Object.keys(GROUPS).sort((a, b) => GROUPS[a].order - GROUPS[b].order);

const PACE_UNITS = ['m/s', 'km/m', 'km/h'];

/** 部位名 → 颜色，查不到就给个中性的 */
function groupColor(group) {
  return (GROUPS[group] && GROUPS[group].color) || '#93aabd';
}

/** 部位名 → 浅色底（高透明度纯色块，和桌面版一个路子） */
function groupTint(group) {
  const color = groupColor(group);
  return hexToRgba(color, 0.16);
}

function hexToRgba(hex, alpha) {
  const value = String(hex || '').replace('#', '');
  const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value;
  const num = parseInt(full || '93aabd', 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

module.exports = {
  GROUPS,
  BASE_ACTIONS,
  GROUP_ORDER,
  PACE_UNITS,
  isCardio,
  groupColor,
  groupTint
};
