-- 1. 房主/用戶表 (加入台灣報稅所需的統編資訊)
CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    company_tax_id VARCHAR(10), -- 統一編號
    phone VARCHAR(20),
    bank_code VARCHAR(10),      -- 銀行代碼 (如 822)
    bank_account VARCHAR(20),   -- 銀行帳號 (線下轉帳用)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 房源表 (加入台灣合法民宿編號)
CREATE TABLE Properties (
    property_id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT,
    title VARCHAR(255) NOT NULL,
    city VARCHAR(50),           -- 縣市 (如 宜蘭縣, 花蓮縣)
    district VARCHAR(50),       -- 鄉鎮市區 (如 礁溪鄉)
    address VARCHAR(255),
    legal_license_no VARCHAR(100), -- 台灣合法民宿登記編號
    base_price_twd INT,         -- 台灣習慣用整數 TWD
    FOREIGN KEY (owner_id) REFERENCES Users(user_id)
);

-- 3. 訂單表 (加入身分證字號與用餐需求)
CREATE TABLE Bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    property_id INT,
    source_channel ENUM('官網直訂', 'Airbnb', 'Booking.com', 'Agoda') DEFAULT '官網直訂',
    guest_name VARCHAR(100),
    guest_id_no VARCHAR(20),    -- 身分證字號/護照號碼 (台灣法規要求)
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    total_amount INT,
    is_tax_included BOOLEAN DEFAULT TRUE, -- 是否含 5% 營業稅
    breakfast_included BOOLEAN DEFAULT TRUE,
    special_note TEXT,          -- 備註 (如：素食、幾點抵達)
    status ENUM('已預訂', '已入住', '已退房', '已取消') DEFAULT '已預訂',
    FOREIGN KEY (property_id) REFERENCES Properties(property_id)
);
