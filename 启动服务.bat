@echo off
chcp 65001 >nul
cd /d "%~dp0"

:: 检查服务是否已在运行
netstat -ano | findstr ":8080 " >nul 2>&1
if %errorlevel% == 0 (
    exit
)

:: 在隐藏窗口中后台启动服务
powershell -WindowStyle Hidden -Command "Start-Process python -ArgumentList '-u','server.py' -WindowStyle Hidden -WorkingDirectory '%~dp0'"

:: 等待服务就绪
timeout /t 2 /nobreak >nul
