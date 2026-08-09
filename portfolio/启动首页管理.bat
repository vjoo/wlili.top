@echo off
chcp 65001 >nul
title WLi 首页内容管理平台
cd /d "%~dp0\.."
echo ============================================
echo   正在启动 首页内容管理平台 ...
echo   管理界面: http://localhost:8080/portfolio/manager.html
echo   作品集:   http://localhost:8080/portfolio/index.html
echo   按 Ctrl+C 停止服务
echo ============================================
python server.py
pause
