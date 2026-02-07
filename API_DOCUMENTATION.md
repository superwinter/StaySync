# StaySync API Documentation

台灣民宿訂房系統 API 完整文件

## 基本資訊

- **Base URL**: `http://localhost:3000/api/v1`
- **Authentication**: 目前不需要認證（開發版本）
- **Content-Type**: `application/json`
- **Rate Limiting**: 每 15 分鐘最多 100 個請求

## 通用回應格式

### 成功回應
```json
{
  "success": true,
  "message": "操作成功訊息（可選）",
  "data": {
    // 回應資料
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```

### 錯誤回應
```json
{
  "success": false,
  "error": "錯誤描述",
  "code": "ERROR_CODE",
  "details": {
    // 額外錯誤資訊（可選）
  }
}
```

---

## 用戶管理 API

### 1. 獲取用戶列表
```
GET /users?page=1&limit=10
```

**查詢參數：**
- `page` (integer): 頁數，預設 1
- `limit` (integer): 每頁筆數，預設 10

**回應範例：**
```json
{
  "success": true,
  "data": [
    {
      "user_id": 1,
      "full_name": "王小明",
      "email": "wang@example.com",
      "company_tax_id": "12345678",
      "phone": "0912-345-678",
      "bank_code": "822",
      "bank_account": "1234567890123",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### 2. 獲取特定用戶
```
GET /users/:id
```

**回應包含用戶統計資訊：**
```json
{
  "success": true,
  "data": {
    "user_id": 1,
    "full_name": "王小明",
    "statistics": {
      "properties": 3,
      "total_bookings": 25,
      "total_revenue": 87500,
      "active_bookings": 5
    }
  }
}
```

### 3. 創建新用戶
```
POST /users
```

**請求範例：**
```json
{
  "full_name": "李小華",
  "email": "li@example.com",
  "company_tax_id": "87654321",
  "phone": "0922-456-789",
  "bank_code": "007",
  "bank_account": "9876543210987"
}
```

### 4. 更新用戶
```
PUT /users/:id
```

### 5. 刪除用戶
```
DELETE /users/:id
```
*注意：只能刪除沒有房源的用戶*

### 6. 獲取用戶的房源
```
GET /users/:id/properties
```

---

## 房源管理 API

### 1. 獲取房源列表（支持搜索）
```
GET /properties?city=宜蘭縣&district=礁溪鄉&min_price=2000&max_price=5000&check_in=2024-04-01&check_out=2024-04-03
```

**查詢參數：**
- `page`, `limit`: 分頁參數
- `city`: 縣市篩選
- `district`: 鄉鎮市區篩選
- `min_price`, `max_price`: 價格範圍
- `check_in`, `check_out`: 可用日期範圍

### 2. 獲取房源詳細資訊
```
GET /properties/:id
```

**回應包含房源統計和近期訂房：**
```json
{
  "success": true,
  "data": {
    "property_id": 1,
    "title": "礁溪溫泉villa",
    "city": "宜蘭縣",
    "district": "礁溪鄉",
    "base_price_twd": 3500,
    "statistics": {
      "total_bookings": 15,
      "total_revenue": 52500,
      "occupancy_rate": 75.5
    },
    "recent_bookings": [...],
    "upcoming_bookings": [...]
  }
}
```

### 3. 創建房源
```
POST /properties
```

**請求範例：**
```json
{
  "owner_id": 1,
  "title": "日月潭湖景民宿",
  "city": "南投縣",
  "district": "魚池鄉",
  "address": "日月潭環湖路888號",
  "legal_license_no": "NT-003-2024",
  "base_price_twd": 4800
}
```

### 4. 更新房源
```
PUT /properties/:id
```

### 5. 刪除房源
```
DELETE /properties/:id
```
*注意：只能刪除沒有訂房紀錄的房源*

### 6. 檢查房源可用性
```
GET /properties/:id/availability?start_date=2024-04-01&end_date=2024-04-03
```

### 7. 獲取城市列表
```
GET /properties/search/cities
```

### 8. 獲取區域列表
```
GET /properties/search/districts?city=宜蘭縣
```

---

## 訂房管理 API

### 1. 獲取訂房列表（支持過濾）
```
GET /bookings?status=已預訂&source_channel=Airbnb&property_id=1&guest_name=王小明
```

**查詢參數：**
- `page`, `limit`: 分頁參數
- `status`: 訂房狀態（已預訂、已入住、已退房、已取消）
- `source_channel`: 訂房管道（官網直訂、Airbnb、Booking.com、Agoda）
- `property_id`: 房源ID
- `guest_name`: 客人姓名
- `start_date`, `end_date`: 日期範圍

### 2. 獲取訂房詳細資訊
```
GET /bookings/:id
```

### 3. 創建新訂房
```
POST /bookings
```

**請求範例：**
```json
{
  "property_id": 1,
  "source_channel": "官網直訂",
  "guest_name": "張小芳",
  "guest_id_no": "A123456789",
  "check_in": "2024-04-15",
  "check_out": "2024-04-17",
  "total_amount": 7000,
  "is_tax_included": true,
  "breakfast_included": true,
  "special_note": "素食早餐"
}
```

**系統會自動檢查：**
- 房源是否存在
- 日期是否衝突
- 自動計算建議金額

### 4. 更新訂房
```
PUT /bookings/:id
```

### 5. 更新訂房狀態
```
PATCH /bookings/:id/status
```

**請求範例：**
```json
{
  "status": "已入住"
}
```

**有效的狀態轉換：**
- 已預訂 → 已入住、已取消
- 已入住 → 已退房
- 已退房、已取消：不可再變更

### 6. 刪除訂房
```
DELETE /bookings/:id
```
*注意：只能刪除已取消的訂房*

### 7. 批次檢查可用性
```
POST /bookings/check-availability
```

**請求範例：**
```json
{
  "property_ids": [1, 2, 3],
  "check_in": "2024-04-15",
  "check_out": "2024-04-17"
}
```

### 8. 訂房儀表板摘要
```
GET /bookings/dashboard/summary
```

**回應包含：**
- 總體統計
- 今日統計
- 月度統計
- 訂房管道統計

---

## 報表分析 API

### 1. 營收報表
```
GET /reports/revenue?group_by=month&start_date=2024-01-01&end_date=2024-12-31&property_id=1
```

**參數：**
- `group_by`: day, week, month, year
- `start_date`, `end_date`: 日期範圍
- `property_id`: 特定房源（可選）
- `source_channel`: 特定管道（可選）

### 2. 房源績效報表
```
GET /reports/property-performance?sort_by=revenue&sort_order=desc
```

**參數：**
- `sort_by`: revenue, bookings, occupancy, rating
- `sort_order`: asc, desc

### 3. 訂房管道分析
```
GET /reports/booking-channels?start_date=2024-01-01&end_date=2024-12-31
```

### 4. 客戶分析報表
```
GET /reports/guest-analysis?min_bookings=2&sort_by=revenue
```

**參數：**
- `min_bookings`: 最少訂房次數
- `sort_by`: bookings, revenue, avg_stay, last_visit

### 5. 入住率分析
```
GET /reports/occupancy?group_by=month&property_id=1
```

### 6. 財務摘要報表（稅務申報用）
```
GET /reports/financial-summary?year=2024&month=3&include_tax_details=true
```

**特色：**
- 支援台灣營業稅計算（5%）
- 按房主分組收入統計
- 包含統編和民宿執照資訊

---

## 測試情境範例

### 1. 完整訂房流程測試

```javascript
// 1. 搜尋可用房源
GET /properties?city=宜蘭縣&check_in=2024-04-15&check_out=2024-04-17

// 2. 檢查特定房源可用性
GET /properties/1/availability?start_date=2024-04-15&end_date=2024-04-17

// 3. 創建訂房
POST /bookings
{
  "property_id": 1,
  "guest_name": "測試客戶",
  "guest_id_no": "A123456789",
  "check_in": "2024-04-15",
  "check_out": "2024-04-17"
}

// 4. 入住流程
PATCH /bookings/1/status { "status": "已入住" }

// 5. 退房流程
PATCH /bookings/1/status { "status": "已退房" }
```

### 2. 房源管理流程測試

```javascript
// 1. 創建房主
POST /users
{
  "full_name": "新房主",
  "email": "new-owner@example.com",
  "company_tax_id": "99887766"
}

// 2. 創建房源
POST /properties
{
  "owner_id": 1,
  "title": "測試民宿",
  "city": "台北市",
  "district": "大安區",
  "base_price_twd": 3000
}

// 3. 查看房源統計
GET /properties/1
```

### 3. 報表分析測試

```javascript
// 1. 查看營收趨勢
GET /reports/revenue?group_by=month&start_date=2024-01-01

// 2. 分析房源績效
GET /reports/property-performance

// 3. 客戶分析
GET /reports/guest-analysis?min_bookings=2

// 4. 財務報表
GET /reports/financial-summary?year=2024&include_tax_details=true
```

---

## 錯誤代碼說明

### 通用錯誤
- `VALIDATION_ERROR`: 輸入資料驗證失敗
- `INTERNAL_SERVER_ERROR`: 伺服器內部錯誤
- `ENDPOINT_NOT_FOUND`: 找不到請求的端點
- `RATE_LIMIT_EXCEEDED`: 請求頻率超限

### 用戶相關錯誤
- `USER_NOT_FOUND`: 找不到指定用戶
- `EMAIL_ALREADY_EXISTS`: 電子郵件已被使用
- `USER_HAS_PROPERTIES`: 用戶擁有房源，無法刪除

### 房源相關錯誤
- `PROPERTY_NOT_FOUND`: 找不到指定房源
- `OWNER_NOT_FOUND`: 房主不存在
- `PROPERTY_HAS_BOOKINGS`: 房源有訂房紀錄，無法刪除

### 訂房相關錯誤
- `BOOKING_NOT_FOUND`: 找不到指定訂房
- `DATE_CONFLICT`: 日期衝突
- `INVALID_STATUS_TRANSITION`: 無效的狀態轉換
- `CANNOT_DELETE_ACTIVE_BOOKING`: 無法刪除進行中的訂房

---

## 部署說明

### 1. 環境準備
```bash
# 安裝 Node.js 16+
# 安裝 MySQL 8.0+
# 複製環境設定檔
cp .env.example .env
```

### 2. 資料庫初始化
```bash
# 創建資料庫
mysql -u root -p -e "CREATE DATABASE staysync CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 導入資料庫結構和測試資料
npm run init-db
```

### 3. 啟動服務
```bash
# 開發模式
npm run dev

# 生產模式
npm start
```

### 4. 健康檢查
```bash
curl http://localhost:3000/health
```

---

## 注意事項

1. **台灣特有功能**：
   - 支援統一編號驗證
   - 身分證字號格式檢查
   - 營業稅計算（5%）
   - 民宿執照管理

2. **日期格式**：
   - 使用 ISO 8601 格式（YYYY-MM-DD）
   - 時區為台灣時間（UTC+8）

3. **金額單位**：
   - 所有金額以台幣（TWD）計算
   - 使用整數避免浮點數精度問題

4. **訂房狀態**：
   - 狀態轉換有嚴格限制
   - 已退房和已取消的訂房不可變更

5. **資料驗證**：
   - 台灣手機號碼格式：09xx-xxx-xxx
   - 統一編號：8位數字
   - 身分證：英文字母+9位數字

透過這個 API，您可以完整管理台灣民宿的訂房業務！