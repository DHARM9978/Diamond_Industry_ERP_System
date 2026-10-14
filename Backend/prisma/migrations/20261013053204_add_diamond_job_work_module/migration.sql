-- CreateTable
CREATE TABLE `external_processors` (
    `external_processor_id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `processor_code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `contact_person` VARCHAR(100) NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(150) NULL,
    `address` TEXT NULL,
    `gstin` VARCHAR(20) NULL,
    `pan` VARCHAR(10) NULL,
    `payment_terms` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `external_processors_company_id_idx`(`company_id`),
    INDEX `external_processors_name_idx`(`name`),
    INDEX `external_processors_status_idx`(`status`),
    UNIQUE INDEX `external_processors_company_id_processor_code_key`(`company_id`, `processor_code`),
    PRIMARY KEY (`external_processor_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_work_process_types` (
    `process_type_id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `charge_unit` VARCHAR(20) NULL,
    `default_rate` DECIMAL(12, 2) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `job_work_process_types_company_id_idx`(`company_id`),
    INDEX `job_work_process_types_is_active_idx`(`is_active`),
    UNIQUE INDEX `job_work_process_types_company_id_code_key`(`company_id`, `code`),
    UNIQUE INDEX `job_work_process_types_company_id_name_key`(`company_id`, `name`),
    PRIMARY KEY (`process_type_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_work_orders` (
    `job_work_order_id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `branch_id` INTEGER NOT NULL,
    `job_number` VARCHAR(40) NOT NULL,
    `external_processor_id` INTEGER NOT NULL,
    `process_type_id` INTEGER NOT NULL,
    `order_date` DATE NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    `description` TEXT NULL,
    `notes` TEXT NULL,
    `created_by_admin_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `job_work_orders_company_id_idx`(`company_id`),
    INDEX `job_work_orders_branch_id_idx`(`branch_id`),
    INDEX `job_work_orders_external_processor_id_idx`(`external_processor_id`),
    INDEX `job_work_orders_process_type_id_idx`(`process_type_id`),
    INDEX `job_work_orders_status_idx`(`status`),
    INDEX `job_work_orders_order_date_idx`(`order_date`),
    INDEX `job_work_orders_created_by_admin_id_idx`(`created_by_admin_id`),
    UNIQUE INDEX `job_work_orders_company_id_job_number_key`(`company_id`, `job_number`),
    PRIMARY KEY (`job_work_order_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_work_dispatches` (
    `dispatch_id` INTEGER NOT NULL AUTO_INCREMENT,
    `job_work_order_id` INTEGER NOT NULL,
    `challan_number` VARCHAR(50) NULL,
    `jangad_number` VARCHAR(50) NULL,
    `dispatch_date` DATE NOT NULL,
    `expected_return_date` DATE NULL,
    `sent_pieces` INTEGER NOT NULL,
    `sent_carats` DECIMAL(12, 4) NOT NULL,
    `sent_weight_grams` DECIMAL(12, 6) NOT NULL,
    `notes` TEXT NULL,
    `created_by_admin_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `job_work_dispatches_job_work_order_id_idx`(`job_work_order_id`),
    INDEX `job_work_dispatches_dispatch_date_idx`(`dispatch_date`),
    INDEX `job_work_dispatches_expected_return_date_idx`(`expected_return_date`),
    INDEX `job_work_dispatches_challan_number_idx`(`challan_number`),
    INDEX `job_work_dispatches_jangad_number_idx`(`jangad_number`),
    INDEX `job_work_dispatches_created_by_admin_id_idx`(`created_by_admin_id`),
    PRIMARY KEY (`dispatch_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_work_receipts` (
    `receipt_id` INTEGER NOT NULL AUTO_INCREMENT,
    `dispatch_id` INTEGER NOT NULL,
    `receipt_number` VARCHAR(50) NULL,
    `received_date` DATE NOT NULL,
    `received_by_admin_id` INTEGER NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `job_work_receipts_dispatch_id_idx`(`dispatch_id`),
    INDEX `job_work_receipts_received_date_idx`(`received_date`),
    INDEX `job_work_receipts_receipt_number_idx`(`receipt_number`),
    INDEX `job_work_receipts_received_by_admin_id_idx`(`received_by_admin_id`),
    PRIMARY KEY (`receipt_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_work_receipt_items` (
    `receipt_item_id` INTEGER NOT NULL AUTO_INCREMENT,
    `receipt_id` INTEGER NOT NULL,
    `return_condition` VARCHAR(30) NOT NULL,
    `returned_pieces` INTEGER NOT NULL,
    `returned_carats` DECIMAL(12, 4) NOT NULL,
    `returned_weight_grams` DECIMAL(12, 6) NOT NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `job_work_receipt_items_receipt_id_idx`(`receipt_id`),
    INDEX `job_work_receipt_items_return_condition_idx`(`return_condition`),
    PRIMARY KEY (`receipt_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_work_reconciliations` (
    `reconciliation_id` INTEGER NOT NULL AUTO_INCREMENT,
    `job_work_order_id` INTEGER NOT NULL,
    `reported_loss_carats` DECIMAL(12, 4) NULL,
    `approved_loss_carats` DECIMAL(12, 4) NULL,
    `variance_carats` DECIMAL(12, 4) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `reviewed_by_admin_id` INTEGER NULL,
    `reviewed_at` DATETIME(3) NULL,
    `resolution_notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `job_work_reconciliations_job_work_order_id_idx`(`job_work_order_id`),
    INDEX `job_work_reconciliations_status_idx`(`status`),
    INDEX `job_work_reconciliations_reviewed_by_admin_id_idx`(`reviewed_by_admin_id`),
    INDEX `job_work_reconciliations_created_at_idx`(`created_at`),
    PRIMARY KEY (`reconciliation_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `external_processors` ADD CONSTRAINT `external_processors_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`company_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_work_process_types` ADD CONSTRAINT `job_work_process_types_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`company_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_work_orders` ADD CONSTRAINT `job_work_orders_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`company_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_work_orders` ADD CONSTRAINT `job_work_orders_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`branch_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_work_orders` ADD CONSTRAINT `job_work_orders_external_processor_id_fkey` FOREIGN KEY (`external_processor_id`) REFERENCES `external_processors`(`external_processor_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_work_orders` ADD CONSTRAINT `job_work_orders_process_type_id_fkey` FOREIGN KEY (`process_type_id`) REFERENCES `job_work_process_types`(`process_type_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_work_orders` ADD CONSTRAINT `job_work_orders_created_by_admin_id_fkey` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admin`(`admin_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_work_dispatches` ADD CONSTRAINT `job_work_dispatches_job_work_order_id_fkey` FOREIGN KEY (`job_work_order_id`) REFERENCES `job_work_orders`(`job_work_order_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_work_dispatches` ADD CONSTRAINT `job_work_dispatches_created_by_admin_id_fkey` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admin`(`admin_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_work_receipts` ADD CONSTRAINT `job_work_receipts_dispatch_id_fkey` FOREIGN KEY (`dispatch_id`) REFERENCES `job_work_dispatches`(`dispatch_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_work_receipts` ADD CONSTRAINT `job_work_receipts_received_by_admin_id_fkey` FOREIGN KEY (`received_by_admin_id`) REFERENCES `admin`(`admin_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_work_receipt_items` ADD CONSTRAINT `job_work_receipt_items_receipt_id_fkey` FOREIGN KEY (`receipt_id`) REFERENCES `job_work_receipts`(`receipt_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_work_reconciliations` ADD CONSTRAINT `job_work_reconciliations_job_work_order_id_fkey` FOREIGN KEY (`job_work_order_id`) REFERENCES `job_work_orders`(`job_work_order_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_work_reconciliations` ADD CONSTRAINT `job_work_reconciliations_reviewed_by_admin_id_fkey` FOREIGN KEY (`reviewed_by_admin_id`) REFERENCES `admin`(`admin_id`) ON DELETE SET NULL ON UPDATE CASCADE;
