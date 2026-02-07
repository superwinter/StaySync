@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: StaySync Windows 自動安裝腳本
echo.
echo ============================================
echo    StaySync 台灣民宿訂房系統 Windows 安裝
echo ============================================
echo.

:: 顏色設定 (Windows 10+)
for /f "tokens=2 delims=[]" %%A in ('ver') do set "winver=%%A"

:: 檢查管理員權限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [警告] 建議以管理員身分執行此腳本以確保 MySQL 服務正常運作
    echo.
    pause
)

:: 步驟 1: 檢查系統需求
echo [1/6] 檢查系統需求...
echo.

:: 檢查 Node.js
echo 檢查 Node.js...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [錯誤] 未找到 Node.js，請先安裝 Node.js 16.0+
    echo 下載連結: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=* delims=" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✓ Node.js 版本: !NODE_VERSION!

:: 檢查 npm
echo 檢查 npm...
npm --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [錯誤] 未找到 npm
    pause
    exit /b 1
)

for /f "tokens=* delims=" %%i in ('npm --version') do set NPM_VERSION=%%i
echo ✓ npm 版本: !NPM_VERSION!

:: 檢查 MySQL
echo 檢查 MySQL...
mysql --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [警告] 未找到 MySQL 命令列工具
    echo 請確保 MySQL 8.0+ 已安裝並添加到 PATH 環境變數
    echo 下載連結: https://dev.mysql.com/downloads/mysql/
    echo.
    set /p CONTINUE="是否繼續安裝? (y/n): "
    if /i "!CONTINUE!" neq "y" (
        echo 安裝已取消
        pause
        exit /b 1
    )
) else (
    for /f "tokens=* delims=" %%i in ('mysql --version') do set MYSQL_VERSION=%%i
    echo ✓ MySQL 版本: !MYSQL_VERSION!
)

echo.
echo 系統需求檢查完成！
echo.

:: 步驟 2: 安裝 Node.js 相依套件
echo [2/6] 安裝相依套件...
echo.

echo 執行 npm install...
npm install
if %errorLevel% neq 0 (
    echo [錯誤] npm install 失敗
    pause
    exit /b 1
)

echo ✓ 相依套件安裝完成
echo.

:: 步驟 3: 設定環境變數
echo [3/6] 設定環境變數...
echo.

if exist .env (
    echo 發現現有的 .env 檔案
    set /p OVERWRITE="是否要重新設定? (y/n): "
    if /i "!OVERWRITE!" neq "y" (
        echo 跳過環境變數設定
        goto :database_setup
    )
)

if not exist .env.example (
    echo [錯誤] 找不到 .env.example 檔案
    pause
    exit /b 1
)

echo 複製 .env.example 到 .env...
copy .env.example .env >nul

echo.
echo 請輸入資料庫設定資訊:
echo.

:input_db_password
set /p DB_PASSWORD="MySQL root 密碼: "
if "!DB_PASSWORD!" equ "" (
    echo 密碼不能為空，請重新輸入
    goto :input_db_password
)

set /p DB_NAME="資料庫名稱 [預設: staysync]: "
if "!DB_NAME!" equ "" set DB_NAME=staysync

set /p DB_PORT="MySQL 埠號 [預設: 3306]: "
if "!DB_PORT!" equ "" set DB_PORT=3306

set /p API_PORT="API 服務埠號 [預設: 3000]: "
if "!API_PORT!" equ "" set API_PORT=3000

echo.
echo 更新 .env 檔案...

:: 使用 PowerShell 來更新 .env 檔案（處理特殊字元）
powershell -Command "& {(Get-Content .env) -replace 'DB_PASSWORD=.*', 'DB_PASSWORD=!DB_PASSWORD!' | Set-Content .env}"
powershell -Command "& {(Get-Content .env) -replace 'DB_NAME=.*', 'DB_NAME=!DB_NAME!' | Set-Content .env}"
powershell -Command "& {(Get-Content .env) -replace 'DB_PORT=.*', 'DB_PORT=!DB_PORT!' | Set-Content .env}"
powershell -Command "& {(Get-Content .env) -replace 'PORT=.*', 'PORT=!API_PORT!' | Set-Content .env}"

echo ✓ 環境變數設定完成
echo.

:: 步驟 4: 設定資料庫
:database_setup
echo [4/6] 設定資料庫...
echo.

echo 檢查 MySQL 服務狀態...
sc query MySQL80 >nul 2>&1
if %errorLevel% equ 0 (
    echo ✓ MySQL 服務已安裝
) else (
    sc query MySQL >nul 2>&1
    if %errorLevel% equ 0 (
        echo ✓ MySQL 服務已安裝
    ) else (
        echo [警告] 無法確認 MySQL 服務狀態
        echo 請手動確認 MySQL 服務正在運行
        echo.
    )
)

echo 測試 MySQL 連接...
echo exit | mysql -u root -p!DB_PASSWORD! >nul 2>&1
if %errorLevel% neq 0 (
    echo [錯誤] MySQL 連接失敗
    echo 請檢查:
    echo   1. MySQL 服務是否正在運行
    echo   2. root 密碼是否正確
    echo   3. MySQL 是否允許本地連接
    echo.
    echo 手動啟動 MySQL 服務:
    echo   net start MySQL80  或  net start MySQL
    echo.
    pause
    exit /b 1
)

echo ✓ MySQL 連接成功

echo.
echo 創建資料庫...
echo CREATE DATABASE IF NOT EXISTS !DB_NAME! CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; | mysql -u root -p!DB_PASSWORD!
if %errorLevel% neq 0 (
    echo [錯誤] 資料庫創建失敗
    pause
    exit /b 1
)

echo ✓ 資料庫 "!DB_NAME!" 創建成功

echo.
echo 導入資料庫結構...
if not exist db.sql (
    echo [錯誤] 找不到 db.sql 檔案
    pause
    exit /b 1
)

mysql -u root -p!DB_PASSWORD! !DB_NAME! < db.sql
if %errorLevel% neq 0 (
    echo [錯誤] 資料庫結構導入失敗
    pause
    exit /b 1
)

echo ✓ 資料庫結構導入成功

echo.
echo 導入測試資料...
if not exist mock_data.sql (
    echo [警告] 找不到 mock_data.sql 檔案，跳過測試資料導入
) else (
    mysql -u root -p!DB_PASSWORD! !DB_NAME! < mock_data.sql
    if %errorLevel% neq 0 (
        echo [警告] 測試資料導入失敗，但不影響基本功能
    ) else (
        echo ✓ 測試資料導入成功
    )
)

echo.

:: 步驟 5: 測試安裝
echo [5/6] 測試安裝...
echo.

echo 測試資料庫連接...
if exist debug-test.js (
    echo 執行資料庫測試...
    node debug-test.js
    if %errorLevel% neq 0 (
        echo [警告] 資料庫測試失敗，請檢查設定
    ) else (
        echo ✓ 資料庫測試通過
    )
) else (
    echo [警告] 找不到 debug-test.js，跳過資料庫測試
)

echo.

:: 步驟 6: 完成安裝
echo [6/6] 完成安裝
echo.

echo ============================================
echo            安裝完成！
echo ============================================
echo.
echo 📊 安裝摘要:
echo   • Node.js: !NODE_VERSION!
echo   • 資料庫: !DB_NAME! (MySQL)
echo   • API 埠號: !API_PORT!
echo   • 環境: 開發模式
echo.
echo 🚀 啟動應用程式:
echo   npm run dev     (開發模式，支援熱重載)
echo   npm start       (生產模式)
echo.
echo 🔗 重要連結:
echo   • API 首頁: http://localhost:!API_PORT!
echo   • 健康檢查: http://localhost:!API_PORT!/health
echo   • API 文件: README.md 和 API_DOCUMENTATION.md
echo.
echo 🧪 執行測試:
echo   node test-api.js
echo.
echo 💡 提示:
echo   • 開發時建議使用 'npm run dev' 啟動
echo   • 如遇到問題，請查看 README.md 故障排除章節
echo   • 預設已包含完整的測試資料供您使用
echo.

set /p START_SERVER="現在啟動開發伺服器嗎? (y/n): "
if /i "!START_SERVER!" equ "y" (
    echo.
    echo 啟動開發伺服器...
    echo 按 Ctrl+C 停止服務器
    echo.
    npm run dev
) else (
    echo.
    echo 稍後可使用以下指令啟動:
    echo   npm run dev
    echo.
)

echo 感謝使用 StaySync！🏡
pause