@echo off
cd /d "%~dp0"
echo.
echo   发布 Repy 网站到 Cloudflare Pages
echo   ------------------------------------------------------------
echo   先同步版本号和更新日志，再上传 site/ 目录。
echo   第一次跑会要求 npx wrangler login，浏览器点一下授权就行。
echo.
node scripts/deploy-site.js
echo.
pause
