CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'operator',
  `phone` VARCHAR(50),
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `sku` VARCHAR(100),
  `unit` VARCHAR(50) NOT NULL,
  `unit_price` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `stock_quantity` DECIMAL(14, 4) NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `created_by` INT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_no` VARCHAR(50) NOT NULL,
  `buyer_name` VARCHAR(255),
  `buyer_phone` VARCHAR(50),
  `total_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `settlement_status` VARCHAR(20) NOT NULL DEFAULT 'unsettled',
  `settled_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `notes` TEXT,
  `created_by` INT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity` DECIMAL(14, 4) NOT NULL,
  `unit_price` DECIMAL(12, 2) NOT NULL,
  `total_price` DECIMAL(14, 2) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `inventory_transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` INT NOT NULL,
  `transaction_type` VARCHAR(30) NOT NULL,
  `quantity_change` DECIMAL(14, 4) NOT NULL,
  `quantity_before` DECIMAL(14, 4) NOT NULL,
  `quantity_after` DECIMAL(14, 4) NOT NULL,
  `reference_type` VARCHAR(30) NOT NULL,
  `reference_id` INT,
  `notes` TEXT,
  `created_by` INT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_inv_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
  CONSTRAINT `fk_inv_creator` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `products` ADD CONSTRAINT `fk_products_creator` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`);
ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_creator` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`);

CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);
CREATE INDEX `idx_products_status` ON `products` (`status`);
CREATE INDEX `idx_products_name` ON `products` (`name`);
CREATE INDEX `idx_orders_created_at` ON `orders` (`created_at`);
CREATE INDEX `idx_orders_settlement_status` ON `orders` (`settlement_status`);
CREATE INDEX `idx_orders_order_no` ON `orders` (`order_no`);
