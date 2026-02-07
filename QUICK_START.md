# 🚀 StaySync 快速開始指南

## 自動設置（推薦）

選擇您的作業系統：

### macOS / Linux
```bash
# 1. 執行自動設置腳本
./setup.sh

# 2. 啟動服務器
npm run dev

# 3. 測試 API
node test-api.js
```

### Windows
```cmd
# 1. 執行自動設置腳本
setup.bat

# 2. 啟動服務器
npm run dev

# 3. 測試 API
node test-api.js
```

## 手動設置

如果自動設置失敗，請按照以下步驟：

### 1. 安裝 MySQL

#### macOS (Homebrew)
```bash
brew install mysql
brew services start mysql
mysql_secure_installation
```

#### Windows
下載並安裝 [MySQL Installer](https://dev.mysql.com/downloads/installer/)

#### Ubuntu/Linux
```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
sudo mysql_secure_installation
```

### 2. 安裝 Node.js 依賴
```bash
npm install
```

### 3. 設定環境變數
```bash
cp .env.example .env
# 編輯 .env 檔案，設定您的 MySQL 密碼
```

### 4. 建立資料庫
```bash
# 登入 MySQL（輸入您的 root 密碼）
mysql -u root -p

# 在 MySQL 命令列中執行：
mysql> SOURCE setup-database.sql;
mysql> SOURCE db.sql;
mysql> SOURCE mock_data.sql;
mysql> exit;
```

### 5. 啟動服務器
```bash
# 開發模式（支援熱重載）
npm run dev

# 或生產模式
npm start
```

### 6. 測試系統
```bash
# 執行自動化測試
node test-api.js

# 或手動測試
curl http://localhost:3000/health
```

## 🔧 故障排除

### MySQL 連接失敗
```bash
# 檢查 MySQL 是否運行
# macOS
brew services list | grep mysql

# Linux
sudo systemctl status mysql

# 重啟 MySQL
# macOS
brew services restart mysql

# Linux
sudo systemctl restart mysql
```

### 端口被占用
如果 3000 端口被占用，修改 `.env` 中的 `PORT=3001`

### 權限問題 (Linux/macOS)
```bash
# 給設置腳本執行權限
chmod +x setup.sh
```

## 📊 驗證安裝

成功設置後，您應該能夠：

1. **訪問 API 首頁**：http://localhost:3000
2. **健康檢查**：http://localhost:3000/health
3. **查看房源**：http://localhost:3000/api/v1/properties
4. **查看測試資料**：
   - 7 位房主
   - 12 間民宿（宜蘭、花蓮、台東等）
   - 16 筆訂房記錄

## 🎯 快速測試

```bash
# 查看所有房源
curl http://localhost:3000/api/v1/properties

# 搜索宜蘭民宿
curl "http://localhost:3000/api/v1/properties?city=宜蘭縣"

# 查看營收報表
curl "http://localhost:3000/api/v1/reports/revenue?group_by=month"

# 查看訂房統計
curl http://localhost:3000/api/v1/bookings/dashboard/summary
```

## 📚 文檔

- [README.md](./README.md) - 完整使用指南
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API 詳細文件
- [booking_test_scenarios.md](./booking_test_scenarios.md) - 測試情境說明

---

遇到問題？請檢查上述故障排除步驟或查看詳細文檔！ 🏡✨