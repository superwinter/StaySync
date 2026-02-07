# StaySync 訂房系統測試情境

## 測試資料概覽

### 用戶資料 (7位房主)
- **王小明**: 擁有宜蘭礁溪和冬山河畔民宿
- **李美惠**: 擁有宜蘭太平山和花蓮太魯閣民宿
- **陳大華**: 擁有花蓮七星潭和瑞穗溫泉民宿
- **林志玲**: 擁有台東知本溫泉和池上民宿
- **張三豐**: 擁有南投清境和日月潭民宿
- **劉備**: 擁有墾丁海灘villa
- **關羽**: 擁有南灣衝浪小屋

### 房源分佈 (12間民宿)
- **宜蘭縣**: 3間 (礁溪溫泉、冬山河畔、太平山森林)
- **花蓮縣**: 3間 (太魯閣峽谷、七星潭海景、瑞穗溫泉)
- **台東縣**: 2間 (知本溫泉、池上稻香)
- **南投縣**: 2間 (清境高山、日月潭湖景)
- **屏東縣**: 2間 (墾丁海灘、南灣衝浪)

## 訂房測試情境

### 1. 新訂房測試
```sql
-- 測試新訂房：官網直訂
INSERT INTO Bookings (property_id, source_channel, guest_name, guest_id_no, check_in, check_out, total_amount, is_tax_included, breakfast_included, special_note, status)
VALUES (1, '官網直訂', '測試用戶', 'T123456789', '2024-04-20', '2024-04-22', 7000, TRUE, TRUE, '測試訂房', '已預訂');

-- 測試新訂房：Airbnb管道
INSERT INTO Bookings (property_id, source_channel, guest_name, guest_id_no, check_in, check_out, total_amount, is_tax_included, breakfast_included, special_note, status)
VALUES (5, 'Airbnb', 'Test User', 'T987654321', '2024-04-25', '2024-04-27', 9000, TRUE, FALSE, 'Test booking from Airbnb', '已預訂');
```

### 2. 訂房狀態更新測試
```sql
-- 測試入住：將已預訂改為已入住
UPDATE Bookings SET status = '已入住' WHERE booking_id = 1;

-- 測試退房：將已入住改為已退房
UPDATE Bookings SET status = '已退房' WHERE booking_id = 4;

-- 測試取消：將已預訂改為已取消
UPDATE Bookings SET status = '已取消' WHERE booking_id = 2;
```

### 3. 日期衝突檢測測試
```sql
-- 檢查特定房源的時間衝突
SELECT * FROM Bookings
WHERE property_id = 1
AND status IN ('已預訂', '已入住')
AND (
    (check_in <= '2024-04-22' AND check_out > '2024-04-20')
    OR (check_in < '2024-04-22' AND check_out >= '2024-04-20')
);
```

### 4. 收入統計測試
```sql
-- 計算單一房源總收入
SELECT p.title, SUM(b.total_amount) as total_revenue, COUNT(b.booking_id) as booking_count
FROM Properties p
LEFT JOIN Bookings b ON p.property_id = b.property_id
WHERE b.status != '已取消'
GROUP BY p.property_id, p.title;

-- 計算各訂房管道收入
SELECT source_channel,
       COUNT(*) as booking_count,
       SUM(total_amount) as total_revenue,
       AVG(total_amount) as avg_booking_value
FROM Bookings
WHERE status != '已取消'
GROUP BY source_channel;
```

### 5. 客戶管理測試
```sql
-- 查找重複客戶
SELECT guest_name, COUNT(*) as booking_count, SUM(total_amount) as total_spent
FROM Bookings
GROUP BY guest_name
HAVING COUNT(*) > 1;

-- 查找高消費客戶
SELECT guest_name, guest_id_no, SUM(total_amount) as total_spent
FROM Bookings
WHERE status != '已取消'
GROUP BY guest_name, guest_id_no
ORDER BY total_spent DESC
LIMIT 10;
```

### 6. 空房查詢測試
```sql
-- 查找特定日期的可用房源
SELECT p.property_id, p.title, p.city, p.district, p.base_price_twd
FROM Properties p
WHERE p.property_id NOT IN (
    SELECT DISTINCT b.property_id
    FROM Bookings b
    WHERE b.status IN ('已預訂', '已入住')
    AND (
        (b.check_in <= '2024-04-15' AND b.check_out > '2024-04-13')
        OR (b.check_in < '2024-04-15' AND b.check_out >= '2024-04-13')
    )
);
```

## 邊界情況測試

### 1. 同日入住/退房測試
```sql
-- 測試當日退房當日入住的情況
INSERT INTO Bookings (property_id, source_channel, guest_name, guest_id_no, check_in, check_out, total_amount, is_tax_included, breakfast_included, special_note, status)
VALUES (1, '官網直訂', '邊界測試A', 'B111111111', '2024-04-10', '2024-04-10', 3500, TRUE, TRUE, '當日來回測試', '已預訂');

INSERT INTO Bookings (property_id, source_channel, guest_name, guest_id_no, check_in, check_out, total_amount, is_tax_included, breakfast_included, special_note, status)
VALUES (1, '官網直訂', '邊界測試B', 'B222222222', '2024-04-10', '2024-04-12', 7000, TRUE, TRUE, '接續入住測試', '已預訂');
```

### 2. 長期住宿測試
```sql
-- 測試月租型訂房
INSERT INTO Bookings (property_id, source_channel, guest_name, guest_id_no, check_in, check_out, total_amount, is_tax_included, breakfast_included, special_note, status)
VALUES (9, '官網直訂', '長期客戶', 'L999999999', '2024-05-01', '2024-05-31', 144000, TRUE, TRUE, '月租住宿，商務差旅', '已預訂');
```

### 3. 特殊需求測試
```sql
-- 測試各種特殊需求
INSERT INTO Bookings (property_id, source_channel, guest_name, guest_id_no, check_in, check_out, total_amount, is_tax_included, breakfast_included, special_note, status)
VALUES (6, '官網直訂', '特殊需求客戶', 'S888888888', '2024-04-18', '2024-04-20', 10400, TRUE, TRUE, '輪椅友善、素食、寵物友善、晚到入住22:00', '已預訂');
```

## 報表測試查詢

### 1. 營運報表
```sql
-- 每月營收報表
SELECT
    DATE_FORMAT(check_in, '%Y-%m') as month,
    COUNT(*) as booking_count,
    SUM(total_amount) as monthly_revenue,
    AVG(total_amount) as avg_booking_value
FROM Bookings
WHERE status != '已取消'
GROUP BY DATE_FORMAT(check_in, '%Y-%m')
ORDER BY month DESC;
```

### 2. 房源績效報表
```sql
-- 房源入住率分析
SELECT
    p.title,
    p.city,
    p.district,
    COUNT(b.booking_id) as total_bookings,
    SUM(DATEDIFF(b.check_out, b.check_in)) as total_nights,
    SUM(b.total_amount) as total_revenue,
    ROUND(AVG(b.total_amount / DATEDIFF(b.check_out, b.check_in)), 0) as avg_daily_rate
FROM Properties p
LEFT JOIN Bookings b ON p.property_id = b.property_id AND b.status != '已取消'
GROUP BY p.property_id, p.title, p.city, p.district
ORDER BY total_revenue DESC;
```

### 3. 客源分析報表
```sql
-- 訂房管道表現分析
SELECT
    source_channel,
    COUNT(*) as booking_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM Bookings WHERE status != '已取消'), 2) as percentage,
    SUM(total_amount) as total_revenue,
    AVG(total_amount) as avg_booking_value,
    AVG(DATEDIFF(check_out, check_in)) as avg_stay_length
FROM Bookings
WHERE status != '已取消'
GROUP BY source_channel
ORDER BY total_revenue DESC;
```

## 測試資料重置

如需重新開始測試，可以使用以下指令：

```sql
-- 清空所有測試資料
DELETE FROM Bookings;
DELETE FROM Properties;
DELETE FROM Users;

-- 重新載入 mock_data.sql 中的資料
```

## 注意事項

1. **日期格式**: 使用 'YYYY-MM-DD' 格式
2. **身分證字號**: 台灣身分證格式為英文字母+9位數字
3. **統編格式**: 8位數字
4. **金額單位**: 台灣元(TWD)，使用整數
5. **訂房狀態**: '已預訂'、'已入住'、'已退房'、'已取消'
6. **訂房管道**: '官網直訂'、'Airbnb'、'Booking.com'、'Agoda'

透過以上測試情境，您可以全面驗證訂房系統的各項功能！