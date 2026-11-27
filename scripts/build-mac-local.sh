#!/bin/bash
# 不依赖 npm / electron-builder 的 mac 打包：直取 Electron 内核 → 组装 .app → hdiutil 出 dmg。
#
#   ./scripts/build-mac-local.sh              # 按当前机器的芯片打
#   ./scripts/build-mac-local.sh --arm64      # M 系列
#   ./scripts/build-mac-local.sh --x64        # Intel
#   ./scripts/build-mac-local.sh --both       # 两个都打
#
# 为什么不用 npm run build:mac：那条路要装 300 多个包，国内小水管能拖一小时。
# 这里只下一个包（Electron 内核，约 100 MB），并且走华为云镜像 + 8 线程分段，
# 实测比 npm 快 4 倍以上。
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(grep -m1 '"version"' package.json | grep -o '[0-9][0-9.]*' | head -1)"
# 优先用 package-lock 里锁定的 Electron 版本，没有就退回 package.json 的声明值
ELECTRON_VERSION="$(grep -A3 '"node_modules/electron": {' package-lock.json 2>/dev/null | grep -m1 '"version"' | grep -o '[0-9][0-9.]*')"
[ -n "$ELECTRON_VERSION" ] || ELECTRON_VERSION="$(grep -m1 '"electron":' package.json | grep -o '[0-9][0-9.]*' | head -1)"
[ -n "$VERSION" ] && [ -n "$ELECTRON_VERSION" ] || { echo "读不出 package.json 里的版本号"; exit 1; }
APP_NAME="Repy"
MIRROR="https://mirrors.huaweicloud.com/electron"
WORK="${TMPDIR:-/tmp}/macbuild"

case "${1:-}" in
  --arm64) ARCHS="arm64" ;;
  --x64)   ARCHS="x64" ;;
  --both)  ARCHS="arm64 x64" ;;
  "")      ARCHS="$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')" ;;
  *)       echo "未知参数：$1（可用 --arm64 / --x64 / --both）"; exit 1 ;;
esac

echo "Repy V$VERSION · Electron $ELECTRON_VERSION · $ARCHS"
echo "----------------------------------------"

# 1) 下载 Electron 内核（分段并行 + 断点续传，已存在则跳过）
fetch_electron() {
  local arch="$1"
  local zip="$WORK/electron-$arch.zip"
  local url="$MIRROR/$ELECTRON_VERSION/electron-v$ELECTRON_VERSION-darwin-$arch.zip"
  mkdir -p "$WORK"

  if [ -f "$zip" ] && unzip -t "$zip" >/dev/null 2>&1; then
    echo "内核已存在，跳过下载：$(du -h "$zip" | cut -f1)"
    return
  fi

  local size
  size="$(curl -sIL -m 30 "$url" | awk 'tolower($1)=="content-length:"{v=$2} END{gsub(/\r/,"",v); print v}')"
  [ -n "$size" ] || { echo "拿不到文件大小，检查网络：$url"; exit 1; }

  local n=8 chunk start end i
  chunk=$(( (size + n - 1) / n ))
  echo "下载内核（$((size / 1024 / 1024)) MB，8 线程）…"
  for i in $(seq 0 $((n - 1))); do
    start=$((i * chunk)); end=$((start + chunk - 1))
    [ $end -ge "$size" ] && end=$((size - 1))
    curl -sL --retry 5 --retry-delay 2 -r "$start-$end" -o "$WORK/part.$i.$arch" "$url" &
  done
  wait
  cat "$WORK"/part.*."$arch" > "$zip"
  rm -f "$WORK"/part.*."$arch"
  unzip -t "$zip" >/dev/null || { echo "下载的内核校验失败，重跑一次"; rm -f "$zip"; exit 1; }
  echo "内核就绪：$(du -h "$zip" | cut -f1)"
}

# 2) 组装 .app（替换 Electron 默认壳里的应用代码、图标、Info.plist）
assemble() {
  local arch="$1"
  local stage="$WORK/stage-$arch"
  local app="$stage/$APP_NAME.app"

  # base 目录必须清空重解，否则 unzip 会停下来问「要不要覆盖」
  rm -rf "$stage" "$WORK/base-$arch" && mkdir -p "$stage"
  unzip -q -o "$WORK/electron-$arch.zip" -d "$WORK/base-$arch"
  cp -R "$WORK/base-$arch/Electron.app" "$app"
  rm -rf "$app/Contents/Resources/default_app.asar"

  mkdir -p "$app/Contents/Resources/app"
  cp main.js preload.js package.json "$app/Contents/Resources/app/"
  cp -R src "$app/Contents/Resources/app/src"
  cp update.json "$app/Contents/Resources/update.json"
  cp build/icon.icns "$app/Contents/Resources/icon.icns"

  local P="$app/Contents/Info.plist"
  pb() { /usr/libexec/PlistBuddy -c "$1" "$P"; }
  pb "Delete :ElectronAsarIntegrity" 2>/dev/null || true

  # 主可执行文件也改成应用名：否则活动监视器、崩溃报告、Dock 右键都写着 Electron
  if [ -f "$app/Contents/MacOS/Electron" ]; then
    mv "$app/Contents/MacOS/Electron" "$app/Contents/MacOS/$APP_NAME"
  fi
  pb "Set :CFBundleExecutable $APP_NAME"
  pb "Set :CFBundleName $APP_NAME"
  pb "Set :CFBundleDisplayName $APP_NAME"
  pb "Set :CFBundleIdentifier com.yuanzi.fitnesslog"
  pb "Set :CFBundleShortVersionString $VERSION"
  pb "Set :CFBundleVersion $VERSION"
  pb "Set :CFBundleIconFile icon.icns"
  pb "Set :LSMinimumSystemVersion 10.15.0"
  pb "Set :LSApplicationCategoryType public.app-category.healthcare-fitness"
  pb "Set :NSRequiresAquaSystemAppearance true"
  pb "Set :NSHumanReadableCopyright 源子 · 自用工具" 2>/dev/null || \
    pb "Add :NSHumanReadableCopyright string 源子 · 自用工具"

  xattr -cr "$app"
  codesign --force --deep --sign - "$app"
  codesign --verify --strict "$app"
  echo "组装完成：$APP_NAME.app（$(du -sh "$app" | cut -f1)）"
}

# 3) 封装 dmg（先做可写镜像 → 写窗口布局 → 再压缩）
#
# 直接 hdiutil create -srcfolder 出的是压缩镜像，没有机会写 .DS_Store，
# 打开后图标位置随 Finder 心情摆。苹果的标准做法是两步：
#   UDRW 可写镜像 → 挂载 → AppleScript 摆好图标和窗口 → 卸载 → 转 UDZO。
make_dmg() {
  local arch="$1"
  local app="$WORK/stage-$arch/$APP_NAME.app"
  local out="$ROOT/dist/FitnessLog-$VERSION-$arch.dmg"
  local src="$WORK/dmg-$arch"
  local rw="$WORK/rw-$arch.dmg"
  local mnt="$WORK/mnt-$arch"
  local vol="$APP_NAME V$VERSION"

  mkdir -p "$ROOT/dist"
  rm -rf "$src" && mkdir -p "$src"
  cp -R "$app" "$src/"
  ln -sf /Applications "$src/Applications"

  rm -f "$rw" && rm -rf "$mnt"
  hdiutil create -volname "$vol" -srcfolder "$src" -fs HFS+ -format UDRW -ov "$rw" >/dev/null
  mkdir -p "$mnt"
  hdiutil attach "$rw" -nobrowse -readwrite -mountpoint "$mnt" >/dev/null
  sleep 1

  # 560×380 的窗口，两个图标同高，底色跟应用界面一致（#f3f2ed）
  osascript <<APPLESCRIPT >/dev/null 2>&1 || echo "  · Finder 布局跳过（可能没给「控制 Finder」权限），dmg 照常能用"
on run
  tell application "Finder"
    tell disk "$vol"
      open
      set current view of container window to icon view
      set toolbar visible of container window to false
      set statusbar visible of container window to false
      set the bounds of container window to {240, 200, 800, 580}
      set opts to the icon view options of container window
      set arrangement of opts to not arranged
      set icon size of opts to 110
      set background color of opts to {62451, 62207, 60909}
      set position of item "$APP_NAME.app" of container window to {150, 180}
      set position of item "Applications" of container window to {410, 180}
      close
      open
      update without registering applications
      delay 1
    end tell
  end tell
end run
APPLESCRIPT

  sync
  hdiutil detach "$mnt" -force >/dev/null 2>&1 || true

  rm -f "$out"
  hdiutil convert "$rw" -format UDZO -imagekey zlib-level=9 -o "${out%.dmg}" >/dev/null
  rm -f "$rw"
  echo "✔ $(basename "$out")  $(du -h "$out" | cut -f1)"

  cp "$out" "$HOME/Desktop/" 2>/dev/null && echo "  → 已复制到桌面" || true
}

for arch in $ARCHS; do
  echo ""
  echo "[$arch]"
  fetch_electron "$arch"
  assemble "$arch"
  make_dmg "$arch"
done

echo ""
echo "装法：双击 dmg，把「${APP_NAME}」拖进 Applications。"
echo "首次打开若提示无法验证开发者：右键图标 → 打开 → 再点「打开」（只需一次）。"
