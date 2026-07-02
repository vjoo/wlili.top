@echo off
chcp 65001 >nul

set SERVER_URL=http://192.168.0.16:8080/index.html

start %SERVER_URL%
