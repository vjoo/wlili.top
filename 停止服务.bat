@echo off
chcp 65001 >nul

echo 正在停止服务...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080 "') do (
    taskkill /F /PID %%a >nul 2>&1
    if %errorlevel% == 0 (
        echo 服务已停止。
    ) else (
        echo 停止失败，请手动结束进程 PID %%a。
    )
    pause
    exit
)
echo 服务未在运行。
pause
