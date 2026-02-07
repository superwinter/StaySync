#!/bin/bash

# StaySync 本地設置腳本
# 此腳本將幫助您快速設置本地開發環境

set -e  # 遇到錯誤時停止

echo "🏡 歡迎使用 StaySync 設置嚮導"
echo "================================="
echo ""

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 檢查 Node.js
echo -e "${BLUE}1. 檢查 Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安裝${NC}"
    echo "請先安裝 Node.js 16.0+ : https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js 已安裝: ${NODE_VERSION}${NC}"

# 檢查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm 未安裝${NC}"
    exit 1
fi

echo -e "${GREEN}✅ npm 已安裝: $(npm -v)${NC}"
echo ""

# 檢查 MySQL
echo -e "${BLUE}2. 檢查 MySQL...${NC}"
if ! command -v mysql &> /dev/null; then
    echo -e "${RED}❌ MySQL 未安裝${NC}"
    echo "請先安裝 MySQL："
    echo "  macOS: brew install mysql"
    echo "  Ubuntu: sudo apt install mysql-server"
    echo "  Windows: 下載 MySQL Installer"
    exit 1
fi

MYSQL_VERSION=$(mysql --version)
echo -e "${GREEN}✅ MySQL 已安裝: ${MYSQL_VERSION}${NC}"
echo ""

# 安裝 npm 依賴
echo -e "${BLUE}3. 安裝 Node.js 依賴...${NC}"
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✅ 依賴安裝完成${NC}"
else
    echo -e "${YELLOW}⚠️  node_modules 已存在，跳過安裝${NC}"
fi
echo ""

# 設定環境變數
echo -e "${BLUE}4. 設定環境變數...${NC}"
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${GREEN}✅ .env 檔案已創建${NC}"
    echo -e "${YELLOW}⚠️  請編輯 .env 檔案，設定您的 MySQL 密碼${NC}"
else
    echo -e "${YELLOW}⚠️  .env 檔案已存在，請檢查設定${NC}"
fi
echo ""

# 設定資料庫
echo -e "${BLUE}5. 設定資料庫...${NC}"
echo "請輸入您的 MySQL root 密碼："
read -s MYSQL_PASSWORD

# 測試 MySQL 連接
if ! mysql -u root -p"${MYSQL_PASSWORD}" -e "SELECT 1;" &> /dev/null; then
    echo -e "${RED}❌ MySQL 連接失敗，請檢查密碼${NC}"
    exit 1
fi

# 創建資料庫
echo -e "${YELLOW}🔧 創建資料庫...${NC}"
mysql -u root -p"${MYSQL_PASSWORD}" < setup-database.sql

echo -e "${YELLOW}🔧 創建資料表...${NC}"
mysql -u root -p"${MYSQL_PASSWORD}" staysync < db.sql

echo -e "${YELLOW}🔧 導入測試資料...${NC}"
mysql -u root -p"${MYSQL_PASSWORD}" staysync < mock_data.sql

echo -e "${GREEN}✅ 資料庫設定完成${NC}"
echo ""

# 更新 .env 檔案中的密碼
if [ "$(uname)" = "Darwin" ]; then
    # macOS
    sed -i '' "s/DB_PASSWORD=password/DB_PASSWORD=${MYSQL_PASSWORD}/" .env
else
    # Linux
    sed -i "s/DB_PASSWORD=password/DB_PASSWORD=${MYSQL_PASSWORD}/" .env
fi

echo -e "${GREEN}✅ 環境變數已更新${NC}"
echo ""

# 完成訊息
echo -e "${GREEN}🎉 StaySync 設置完成！${NC}"
echo ""
echo -e "${BLUE}📝 接下來的步驟：${NC}"
echo "1. 啟動服務器："
echo -e "   ${YELLOW}npm run dev${NC}    # 開發模式"
echo -e "   ${YELLOW}npm start${NC}      # 生產模式"
echo ""
echo "2. 測試 API："
echo -e "   ${YELLOW}node test-api.js${NC}"
echo ""
echo "3. 瀏覽 API："
echo -e "   ${YELLOW}http://localhost:3000${NC}          # API 首頁"
echo -e "   ${YELLOW}http://localhost:3000/health${NC}   # 健康檢查"
echo ""
echo -e "${BLUE}📚 文件：${NC}"
echo "• README.md - 使用指南"
echo "• API_DOCUMENTATION.md - API 文件"
echo "• booking_test_scenarios.md - 測試情境"
echo ""
echo -e "${GREEN}祝您使用愉快！ 🏡✨${NC}"