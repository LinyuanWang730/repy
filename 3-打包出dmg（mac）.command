#!/bin/bash
# 双击我：在 macOS 上打出 dmg 安装包（拖进「应用程序」的那种）。
# 逻辑和 Windows 的 2-打包出exe.bat 一样，只是换成苹果的封装方式。

cd "$(dirname "$0")" || exit 1

echo "训练记录生成器 · macOS 打包"
echo "----------------------------------------"

# 1) Node.js
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "这台机器还没装 Node.js。"
  echo "去 https://nodejs.org 下 macOS 版（选 LTS 那个），装完再双击我。"
  echo ""
  read -n 1 -s -r -p "按任意键关闭窗口"
  exit 1
fi
echo "Node 版本：$(node -v)"

# 2) Python 3：dmg 的窗口布局（图标位置、Applications 快捷方式）靠它，
#    它是随 Xcode 命令行工具一起装的，macOS 12 以后系统不自带。
if ! command -v python3 >/dev/null 2>&1; then
  echo ""
  echo "还差一个打包要用的小工具（Python 3），它跟着 Xcode 命令行工具一起装，免费。"
  echo "现在帮你打开安装窗口，装完（几分钟）再双击我一次就行。"
  xcode-select --install >/dev/null 2>&1
  echo ""
  read -n 1 -s -r -p "按任意键关闭窗口"
  exit 1
fi

# 3) 从 Windows 拷过来的 node_modules 里是 Windows 版 Electron，必须重装
if [ -d node_modules/electron/dist ] && [ ! -f "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" ]; then
  echo "检测到 Windows 版的依赖包，先清掉（只删 node_modules，代码和训练记录都不动）…"
  rm -rf node_modules
fi

# 4) 装依赖
if [ ! -d node_modules ]; then
  echo "安装依赖（第一次要几分钟，装完就不用再装）…"
  if ! npm install; then
    echo ""
    echo "依赖没装上。如果卡在下载 Electron，先在终端里跑这两行，再双击我："
    echo "  export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
    echo "  export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/"
    echo ""
    read -n 1 -s -r -p "按任意键关闭窗口"
    exit 1
  fi
fi

# 5) 打包
npm run build:mac
status=$?

echo ""
if [ $status -eq 0 ]; then
  echo "打包完成：dmg 在 dist/ 里，桌面也放了一份。"
  open dist >/dev/null 2>&1
else
  echo "打包失败（退出码 $status），把上面的报错发我。"
fi
read -n 1 -s -r -p "按任意键关闭窗口"
