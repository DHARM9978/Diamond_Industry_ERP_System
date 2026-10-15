-- AlterTable
ALTER TABLE `job_work_orders` ADD COLUMN `quoted_charge_unit` VARCHAR(20) NULL,
    ADD COLUMN `quoted_rate` DECIMAL(12, 2) NULL,
    ADD COLUMN `quoted_rate_month` DATE NULL;

-- AlterTable
ALTER TABLE `job_work_receipt_items` ADD COLUMN `applied_charge_unit` VARCHAR(20) NULL,
    ADD COLUMN `applied_rate` DECIMAL(12, 2) NULL,
    ADD COLUMN `billable_quantity` DECIMAL(12, 6) NULL,
    ADD COLUMN `processing_charge` DECIMAL(12, 2) NULL,
    ADD COLUMN `rate_month` DATE NULL;

-- CreateTable
CREATE TABLE `job_work_process_rates` (
    `process_rate_id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `process_type_id` INTEGER NOT NULL,
    `rate_month` DATE NOT NULL,
    `charge_unit` VARCHAR(20) NOT NULL,
    `rate` DECIMAL(12, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `job_work_process_rates_company_id_rate_month_idx`(`company_id`, `rate_month`),
    INDEX `job_work_process_rates_process_type_id_rate_month_idx`(`process_type_id`, `rate_month`),
    UNIQUE INDEX `job_work_process_rates_company_id_process_type_id_rate_month_key`(`company_id`, `process_type_id`, `rate_month`),
    PRIMARY KEY (`process_rate_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_work_payments` (
    `payment_id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `job_work_order_id` INTEGER NOT NULL,
    `payment_date` DATE NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `payment_method` VARCHAR(30) NULL,
    `reference_number` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `recorded_by_admin_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `job_work_payments_company_id_idx`(`company_id`),
    INDEX `job_work_payments_job_work_order_id_idx`(`job_work_order_id`),
    INDEX `job_work_payments_payment_date_idx`(`payment_date`),
    INDEX `job_work_payments_recorded_by_admin_id_idx`(`recorded_by_admin_id`),
    PRIMARY KEY (`payment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `job_work_process_rates` ADD CONSTRAINT `job_work_process_rates_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`company_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_work_process_rates` ADD CONSTRAINT `job_work_process_rates_process_type_id_fkey` FOREIGN KEY (`process_type_id`) REFERENCES `job_work_process_types`(`process_type_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_work_payments` ADD CONSTRAINT `job_work_payments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`company_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_work_payments` ADD CONSTRAINT `job_work_payments_job_work_order_id_fkey` FOREIGN KEY (`job_work_order_id`) REFERENCES `job_work_orders`(`job_work_order_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_work_payments` ADD CONSTRAINT `job_work_payments_recorded_by_admin_id_fkey` FOREIGN KEY (`recorded_by_admin_id`) REFERENCES `admin`(`admin_id`) ON DELETE SET NULL ON UPDATE CASCADE;
