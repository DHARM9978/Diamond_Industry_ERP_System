/*
  Warnings:

  - A unique constraint covering the columns `[company_id,external_processor_id,machine_id,process_type_id,rate_month]` on the table `job_work_process_rates` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `job_work_process_rates_company_id_process_type_id_rate_month_key` ON `job_work_process_rates`;

-- AlterTable
ALTER TABLE `job_work_orders` ADD COLUMN `machine_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `job_work_process_rates` ADD COLUMN `external_processor_id` INTEGER NULL,
    ADD COLUMN `machine_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `job_work_receipt_items` ADD COLUMN `applied_rate_month` DATE NULL,
    ADD COLUMN `rate_source` VARCHAR(30) NULL;

-- CreateTable
CREATE TABLE `job_work_machines` (
    `machine_id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `job_work_machines_company_id_idx`(`company_id`),
    INDEX `job_work_machines_is_active_idx`(`is_active`),
    UNIQUE INDEX `job_work_machines_company_id_code_key`(`company_id`, `code`),
    UNIQUE INDEX `job_work_machines_company_id_name_key`(`company_id`, `name`),
    PRIMARY KEY (`machine_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `job_work_orders_machine_id_idx` ON `job_work_orders`(`machine_id`);

-- CreateIndex
CREATE INDEX `job_work_process_rates_external_processor_id_machine_id_proc_idx` ON `job_work_process_rates`(`external_processor_id`, `machine_id`, `process_type_id`, `rate_month`);

-- CreateIndex
CREATE UNIQUE INDEX `job_work_process_rates_company_id_external_processor_id_mach_key` ON `job_work_process_rates`(`company_id`, `external_processor_id`, `machine_id`, `process_type_id`, `rate_month`);

-- AddForeignKey
ALTER TABLE `job_work_machines` ADD CONSTRAINT `job_work_machines_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`company_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_work_process_rates` ADD CONSTRAINT `job_work_process_rates_external_processor_id_fkey` FOREIGN KEY (`external_processor_id`) REFERENCES `external_processors`(`external_processor_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_work_process_rates` ADD CONSTRAINT `job_work_process_rates_machine_id_fkey` FOREIGN KEY (`machine_id`) REFERENCES `job_work_machines`(`machine_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_work_orders` ADD CONSTRAINT `job_work_orders_machine_id_fkey` FOREIGN KEY (`machine_id`) REFERENCES `job_work_machines`(`machine_id`) ON DELETE SET NULL ON UPDATE CASCADE;
