@echo off
setlocal
start "AutoScore Server" cmd /k "cd /d %~dp0server && npm run dev"
start "AutoScore Client" cmd /k "cd /d %~dp0client && npm run dev"
echo Started AutoScore Advisor server and client in separate terminals.
