-- StaySync 資料庫設置腳本
-- 此腳本將創建資料庫、用戶並設定權限

-- 創建資料庫
DROP DATABASE IF EXISTS staysync;
CREATE DATABASE staysync CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 使用資料庫
USE staysync;

-- 顯示資料庫創建成功訊息
SELECT 'StaySync 資料庫創建成功！' AS message;

-- 創建專用使用者 (可選，提高安全性)
-- 如果您想使用專用使用者而不是 root，請取消下面的註解

/*
DROP USER IF EXISTS 'staysync_user'@'localhost';
CREATE USER 'staysync_user'@'localhost' IDENTIFIED BY 'staysync_password';
GRANT ALL PRIVILEGES ON staysync.* TO 'staysync_user'@'localhost';
FLUSH PRIVILEGES;
SELECT 'StaySync 使用者創建成功！' AS message;
*/

-- 顯示當前資料庫資訊
SHOW DATABASES;
SELECT DATABASE() AS current_database;