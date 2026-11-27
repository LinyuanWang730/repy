#!/bin/bash
# 双击我：提交本地改动 -> 从 iCloud 拉取 -> 推回去。
# 开工前一次、收工后一次，都是这一个。

cd "$(dirname "$0")" || exit 1

echo
echo "  训练记录生成器 · 同步"
echo "  ----------------------------------------"
echo "  开工前、收工后各点一次。"
echo

if ! command -v git >/dev/null 2>&1; then
  echo "  没找到 git。终端跑一次：xcode-select --install"
  echo
  read -n 1 -s -r -p "  按任意键关闭"
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "  这个文件夹不是 git 仓库。"
  echo
  read -n 1 -s -r -p "  按任意键关闭"
  exit 1
fi

# ---------- 1. 提交本地改动 ----------
git add -A
if git diff --cached --quiet; then
  echo "  [1/3] 没有新的改动"
else
  echo "  [1/3] 这些文件会被提交："
  git -c core.quotepath=false diff --cached --name-status
  echo
  printf "  用一句话说清改了什么（直接回车 = 自动时间戳）: "
  read -r msg
  [ -z "$msg" ] && msg="auto commit $(date '+%Y-%m-%d %H:%M')"
  if ! git commit -q -m "$msg"; then
    echo
    echo "  提交失败，把上面的报错发我。"
    echo
    read -n 1 -s -r -p "  按任意键关闭"
    exit 1
  fi
  echo "  已提交"
fi
echo

# ---------- 2. 拉取 ----------
if ! git remote get-url origin >/dev/null 2>&1; then
  echo "  [2/3] 没有配置远端，跳过拉取和推送"
  echo "  改动只存在这台机器上。"
  echo
  read -n 1 -s -r -p "  按任意键关闭"
  exit 0
fi

echo "  [2/3] 从 iCloud 拉取..."
if ! git pull --rebase --autostash origin main; then
  echo
  echo "  拉取失败。"
  echo "  - 说 conflict：改好文件里的冲突标记，再跑 git rebase --continue"
  echo "  - 说 bad object / unable to read tree：iCloud 那份坏了，先别动，找我看"
  echo
  echo "  你自己的提交在这台机器上是安全的。"
  echo
  read -n 1 -s -r -p "  按任意键关闭"
  exit 1
fi

# ---------- 3. 推送 ----------
echo
echo "  [3/3] 推送..."
if ! git push origin main; then
  echo
  echo "  推送失败。检查 iCloud 里的 训练记录生成器.git 还在不在。"
  echo "  你自己的提交在这台机器上是安全的。"
  echo
  read -n 1 -s -r -p "  按任意键关闭"
  exit 1
fi

echo
echo "  已同步。最近三条："
git log --oneline -3
echo
echo "  去另一台机器前，等 iCloud 同步图标转完。"
echo
read -n 1 -s -r -p "  按任意键关闭窗口"
