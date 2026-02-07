-- StaySync Mock Data for Testing
-- 台灣民宿訂房系統測試資料

-- 1. 房主/用戶測試資料
INSERT INTO Users (full_name, email, company_tax_id, phone, bank_code, bank_account) VALUES
('王小明', 'wangxiaoming@gmail.com', '12345678', '0912-345-678', '822', '1234567890123'),
('李美惠', 'limeihui@yahoo.com.tw', '23456789', '0922-456-789', '007', '9876543210987'),
('陳大華', 'chendahua@hotmail.com', '34567890', '0933-567-890', '012', '5555666677778'),
('林志玲', 'linzhiling@example.com', '45678901', '0944-678-901', '822', '1111222233334'),
('張三豐', 'zhangsanfeng@gmail.com', '56789012', '0955-789-012', '700', '9999888877776'),
('劉備', 'liubei@example.com', '67890123', '0966-890-123', '013', '4444333322221'),
('關羽', 'guanyu@yahoo.com.tw', '78901234', '0977-901-234', '017', '7777666655554');

-- 2. 房源測試資料 (台灣各地熱門民宿地點)
INSERT INTO Properties (owner_id, title, city, district, address, legal_license_no, base_price_twd) VALUES
-- 宜蘭縣民宿
(1, '礁溪溫泉villa', '宜蘭縣', '礁溪鄉', '礁溪路五段88號', 'YL-001-2023', 3500),
(1, '冬山河畔小屋', '宜蘭縣', '冬山鄉', '冬山路123號', 'YL-002-2023', 2800),
(2, '太平山森林小築', '宜蘭縣', '大同鄉', '太平山林道50號', 'YL-003-2023', 4200),

-- 花蓮縣民宿
(2, '太魯閣峽谷景觀屋', '花蓮縣', '秀林鄉', '太魯閣國家公園內', 'HL-001-2023', 3800),
(3, '七星潭海景民宿', '花蓮縣', '新城鄉', '七星潭海邊路66號', 'HL-002-2023', 4500),
(3, '瑞穗溫泉度假村', '花蓮縣', '瑞穗鄉', '瑞穗溫泉路888號', 'HL-003-2023', 5200),

-- 台東縣民宿
(4, '知本溫泉會館', '台東縣', '卑南鄉', '知本溫泉路99號', 'TT-001-2023', 3600),
(4, '池上稻香民宿', '台東縣', '池上鄉', '池上稻香路777號', 'TT-002-2023', 2900),

-- 南投縣民宿
(5, '清境高山小屋', '南投縣', '仁愛鄉', '清境農場內', 'NT-001-2023', 4800),
(5, '日月潭湖景房', '南投縣', '魚池鄉', '日月潭環湖路555號', 'NT-002-2023', 5500),

-- 墾丁民宿
(6, '墾丁海灘villa', '屏東縣', '恆春鎮', '墾丁大街199號', 'PT-001-2023', 4200),
(7, '南灣衝浪小屋', '屏東縣', '恆春鎮', '南灣路333號', 'PT-002-2023', 3200);

-- 3. 訂單測試資料 (涵蓋不同訂房情境)
INSERT INTO Bookings (property_id, source_channel, guest_name, guest_id_no, check_in, check_out, total_amount, is_tax_included, breakfast_included, special_note, status) VALUES

-- 已預訂訂單
(1, '官網直訂', '黃大明', 'A123456789', '2024-03-15', '2024-03-17', 7000, TRUE, TRUE, '晚上8點到達，需要素食早餐', '已預訂'),
(2, 'Airbnb', 'Johnson Smith', 'P987654321', '2024-03-20', '2024-03-23', 8400, TRUE, TRUE, 'Vegetarian meals required', '已預訂'),
(3, 'Booking.com', '田中太郎', 'J567890123', '2024-03-25', '2024-03-28', 12600, TRUE, FALSE, '不需要早餐，預計下午2點入住', '已預訂'),

-- 已入住訂單
(4, '官網直訂', '吳小華', 'B234567890', '2024-02-28', '2024-03-02', 7600, TRUE, TRUE, '蜜月旅行，需要浪漫佈置', '已入住'),
(5, 'Agoda', '김민수', 'K345678901', '2024-03-01', '2024-03-04', 13500, TRUE, TRUE, '韓國客人，需要韓式早餐', '已入住'),
(6, 'Booking.com', 'Emma Wilson', 'E456789012', '2024-03-03', '2024-03-06', 15600, TRUE, FALSE, 'Late check-in around 10pm', '已入住'),

-- 已退房訂單
(7, '官網直訂', '陳美玲', 'C567890123', '2024-02-20', '2024-02-23', 10800, TRUE, TRUE, '家族旅遊，4大2小', '已退房'),
(8, 'Airbnb', '佐藤花子', 'S678901234', '2024-02-15', '2024-02-18', 8700, TRUE, TRUE, '日本客人，需要和式早餐', '已退房'),
(9, 'Booking.com', 'David Brown', 'D789012345', '2024-02-10', '2024-02-14', 17400, TRUE, FALSE, 'Business trip, early check-out required', '已退房'),

-- 已取消訂單
(10, '官網直訂', '李志明', 'L890123456', '2024-04-01', '2024-04-03', 11000, TRUE, TRUE, '因疫情取消行程', '已取消'),
(11, 'Agoda', 'Maria Garcia', 'M901234567', '2024-04-05', '2024-04-08', 15600, TRUE, TRUE, 'Flight cancelled due to weather', '已取消'),

-- 即將到來的訂單
(1, '官網直訂', '張小芳', 'Z012345678', '2024-03-30', '2024-04-02', 10500, TRUE, TRUE, '生日慶祝，希望有生日蛋糕', '已預訂'),
(2, 'Airbnb', 'Michael Johnson', 'M123450987', '2024-04-10', '2024-04-13', 8400, TRUE, FALSE, 'Anniversary trip, room decoration requested', '已預訂'),
(3, 'Booking.com', '林大偉', 'L234561098', '2024-04-15', '2024-04-18', 12600, TRUE, TRUE, '員工旅遊，需要團體早餐', '已預訂'),

-- 長期住宿訂單
(9, '官網直訂', '孫悟空', 'S345672109', '2024-03-10', '2024-03-24', 67200, TRUE, TRUE, '長期出差住宿，需要洗衣服務', '已入住'),
(10, 'Airbnb', 'Anna Andersson', 'A456783210', '2024-02-01', '2024-02-29', 154000, TRUE, FALSE, 'Monthly stay for work, kitchen access needed', '已退房');

-- 4. 查詢測試資料的 SQL 語句
/*
-- 查看所有房主資訊
SELECT * FROM Users;

-- 查看所有房源資訊
SELECT p.*, u.full_name as owner_name
FROM Properties p
JOIN Users u ON p.owner_id = u.user_id;

-- 查看所有訂單資訊
SELECT b.*, p.title as property_title
FROM Bookings b
JOIN Properties p ON b.property_id = p.property_id
ORDER BY b.check_in DESC;

-- 查看特定狀態的訂單
SELECT * FROM Bookings WHERE status = '已預訂';
SELECT * FROM Bookings WHERE status = '已入住';
SELECT * FROM Bookings WHERE status = '已退房';
SELECT * FROM Bookings WHERE status = '已取消';

-- 查看特定日期範圍的訂單
SELECT * FROM Bookings
WHERE check_in BETWEEN '2024-03-01' AND '2024-03-31';

-- 查看不同訂房管道的統計
SELECT source_channel, COUNT(*) as booking_count, SUM(total_amount) as total_revenue
FROM Bookings
GROUP BY source_channel;

-- 查看房源收入統計
SELECT p.title, COUNT(b.booking_id) as total_bookings, SUM(b.total_amount) as total_revenue
FROM Properties p
LEFT JOIN Bookings b ON p.property_id = b.property_id
GROUP BY p.property_id, p.title
ORDER BY total_revenue DESC;
*/