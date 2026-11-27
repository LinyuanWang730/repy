; 安装向导：加一页欢迎页，让左侧那张放大的图标（installerSidebar.bmp）当背景露出来
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "安装「Repy」"
  !define MUI_WELCOMEPAGE_TEXT "装好就能用：动作池、一周安排、训练记录都存在这台电脑上，不上传。$\r$\n$\r$\n点「下一步」继续；安装位置在下一页可以改。"
  !insertmacro MUI_PAGE_WELCOME
!macroend
