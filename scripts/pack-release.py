#!/usr/bin/env python3
"""把 dist 里的安装包整理成 GitHub Release 要用的固定文件名。

为什么要改名：落地页的下载按钮写的是
    https://github.com/<用户名>/repy-downloads/releases/latest/download/Repy-Setup.exe
靠的是 releases/latest 这个"永远指向最新一版"的路径。只有文件名固定，
下个版本发布后旧链接才不会 404。electron-builder 出的包带版本号
（Repy-2.1.2-Setup.exe），所以这里统一复制成不带版本号的名字。

产出在 dist/release/，把里面三个文件整个拖进 GitHub Release 的附件框就行。

用法：python scripts/pack-release.py
"""
import json
import os
import shutil
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
OUT = os.path.join(DIST, "release")

NOTE = """Repy 便携版
================================================

这个文件夹里只有一个文件：Repy-Portable.exe
双击它就能用，不用安装，想删掉直接删文件夹。

第一次打开 Windows 会拦一下：
  1. 出现「Windows 已保护你的电脑」
  2. 点左边的「更多信息」
  3. 底部会出现「仍要运行」，点它

这不是病毒，是没买数字签名证书的正常现象。

训练记录存在这个 exe 旁边的数据目录里，
换电脑时把整个文件夹一起拷走就行。
"""


def main():
    with open(os.path.join(ROOT, "package.json"), encoding="utf-8") as f:
        version = json.load(f)["version"]

    os.makedirs(OUT, exist_ok=True)
    print("整理 V%s 的发布文件" % version)

    pairs = [
        ("Repy-%s-Setup.exe" % version, "Repy-Setup.exe"),
        ("Repy-%s-Portable.exe" % version, "Repy-Portable.exe"),
    ]

    made = []
    for src_name, dst_name in pairs:
        src = os.path.join(DIST, src_name)
        if not os.path.exists(src):
            print("  ✗ 没找到 %s（先跑 2-打包出exe.bat）" % src_name)
            continue
        dst = os.path.join(OUT, dst_name)
        shutil.copy2(src, dst)
        made.append(dst)
        print("  ✓ %-22s %5d MB" % (dst_name, round(os.path.getsize(dst) / 1024 / 1024)))

    portable = os.path.join(OUT, "Repy-Portable.exe")
    if os.path.exists(portable):
        zip_path = os.path.join(OUT, "Repy-Portable.zip")
        # 里面的 exe 本身已经是压缩过的自解压包，再 deflate 一点也省不下来，
        # 反而慢，所以直接 store。
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as z:
            z.write(portable, "Repy-Portable.exe")
            z.writestr("使用说明.txt", NOTE)
        made.append(zip_path)
        print("  ✓ %-22s %5d MB" % ("Repy-Portable.zip", round(os.path.getsize(zip_path) / 1024 / 1024)))

    if not made:
        print("\n一个文件都没生成，检查 dist/ 里有没有 V%s 的安装包。" % version)
        return

    print("\n产出目录：dist/release/")
    print("下一步：打开 GitHub 仓库 → Releases → Create a new release")
    print("  Tag 填 v%s，把这 %d 个文件拖进附件框，Publish。" % (version, len(made)))
    print("  文件名不要改，落地页的下载链接就是按这几个名字写的。")


if __name__ == "__main__":
    main()
