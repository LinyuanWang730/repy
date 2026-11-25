const { ensureStore } = require('./utils/store');

App({
  globalData: {
    appName: 'RepyNeo',
    version: '1.0.3',
    // 首页与复盘页之间传日期用
    jumpDate: '',
    // 设置页「编辑某天」跳到撰写页打开改安排弹窗时带的目标星期
    planEditorDay: null
  },

  onLaunch() {
    ensureStore();
  }
});
