#!/bin/bash

# StaySync 手動設置腳本
# 當自動設置遇到問題時使用

echo "🔧 StaySync 手動設置"
echo "==================="
echo ""

# 安裝依賴
echo "📦 安裝 Node.js 依賴..."
npm install
echo "✅ 依賴安裝完成"
echo ""

# 創建環境變數檔案
echo "⚙️  創建環境配置..."
cp .env.example .env
echo "✅ .env 檔案已創建"
echo ""

echo "📝 請手動完成以下步驟："
echo ""
echo "1. 啟動 MySQL："
echo "   brew services start mysql@8.4"
echo "   # 或者"
echo "   sudo mysqld_safe --user=mysql &"
echo ""
echo "2. 連接 MySQL 並創建資料庫："
echo "   mysql -u root -p"
echo "   mysql> SOURCE setup-database.sql;"
echo "   mysql> SOURCE db.sql;"
echo "   mysql> SOURCE mock_data.sql;"
echo "   mysql> exit;"
echo ""
echo "3. 編輯 .env 檔案，設定您的 MySQL 密碼"
echo ""
echo "4. 啟動 StaySync："
echo "   npm run dev"
echo ""
echo "5. 測試 API："
echo "   node test-api.js"
echo ""

# 檢查 MySQL 是否運行
if pgrep -f mysqld > /dev/null; then
    echo "✅ MySQL 正在運行"

    echo "🔧 嘗試自動創建資料庫..."
    echo "請輸入 MySQL root 密碼（如果沒有密碼請直接按 Enter）:"
    read -s password

    if [ -z "$password" ]; then
        # 無密碼
        mysql -u root < setup-database.sql 2>/dev/null && \
        mysql -u root staysync < db.sql 2>/dev/null && \
        mysql -u root staysync < mock_data.sql 2>/dev/null && \
        echo "✅ 資料庫設置完成！" || echo "❌ 資料庫設置失敗，請手動執行"
    else
        # 有密碼
        mysql -u root -p"$password" < setup-database.sql 2>/dev/null && \
        mysql -u root -p"$password" staysync < db.sql 2>/dev/null && \
        mysql -u root -p"$password" staysync < mock_data.sql 2>/dev/null && \
        echo "✅ 資料庫設置完成！" || echo "❌ 資料庫設置失敗，請手動執行"
    fi

    echo ""
    echo "🚀 現在可以啟動服務器："
    echo "   npm run dev"

else
    echo "❌ MySQL 未運行，請先啟動 MySQL"
fi