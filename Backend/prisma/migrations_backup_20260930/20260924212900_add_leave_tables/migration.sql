-- ============================================================
-- Leave Module Base Tables
-- ============================================================
--
-- Repair migration:
-- The LeaveType, LeaveBalance and LeaveRequest Prisma models
-- existed in schema.prisma, and the tables already exist in the
-- application database, but the original migration history never
-- contained the CREATE TABLE statements for them.
--
-- This migration intentionally creates the ORIGINAL leave-table
-- shape. The next migration (20260924213000_add_system_default_leave_type)
-- then adds is_system_default.
--
-- No application data is inserted here.
-- ============================================================

-- ============================================================
-- 1. Leave Types
-- ============================================================

CREATE TABLE `leave_types` (
    `leave_type_id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `description` TEXT NULL,
    `annual_quota` DECIMAL(6,2) NULL,
    `is_paid` BOOLEAN NOT NULL DEFAULT TRUE,
    `requires_approval` BOOLEAN NOT NULL DEFAULT TRUE,
    `allow_half_day` BOOLEAN NOT NULL DEFAULT TRUE,
    `allow_carry_forward` BOOLEAN NOT NULL DEFAULT FALSE,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leave_types_company_id_code_key`(`company_id`, `code`),
    UNIQUE INDEX `leave_types_company_id_name_key`(`company_id`, `name`),
    INDEX `leave_types_company_id_idx`(`company_id`),
    INDEX `leave_types_status_idx`(`status`),
    PRIMARY KEY (`leave_type_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- 2. Leave Balances
-- ============================================================

CREATE TABLE `leave_balances` (
    `leave_balance_id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `leave_type_id` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `allocated` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    `used` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    `remaining` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leave_balances_employee_id_leave_type_id_year_key`(`employee_id`, `leave_type_id`, `year`),
    INDEX `leave_balances_employee_id_idx`(`employee_id`),
    INDEX `leave_balances_leave_type_id_idx`(`leave_type_id`),
    INDEX `leave_balances_year_idx`(`year`),
    PRIMARY KEY (`leave_balance_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- 3. Leave Requests
-- ============================================================

CREATE TABLE `leave_requests` (
    `leave_request_id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `leave_type_id` INTEGER NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `total_days` DECIMAL(6,2) NOT NULL,
    `reason` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `approved_by` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `rejection_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `leave_requests_employee_id_idx`(`employee_id`),
    INDEX `leave_requests_leave_type_id_idx`(`leave_type_id`),
    INDEX `leave_requests_status_idx`(`status`),
    INDEX `leave_requests_start_date_end_date_idx`(`start_date`, `end_date`),
    PRIMARY KEY (`leave_request_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- 4. Foreign Keys
-- ============================================================

ALTER TABLE `leave_types`
    ADD CONSTRAINT `leave_types_company_id_fkey`
    FOREIGN KEY (`company_id`)
    REFERENCES `companies` (`company_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE `leave_balances`
    ADD CONSTRAINT `leave_balances_employee_id_fkey`
    FOREIGN KEY (`employee_id`)
    REFERENCES `employees` (`employee_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE `leave_balances`
    ADD CONSTRAINT `leave_balances_leave_type_id_fkey`
    FOREIGN KEY (`leave_type_id`)
    REFERENCES `leave_types` (`leave_type_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE `leave_requests`
    ADD CONSTRAINT `leave_requests_employee_id_fkey`
    FOREIGN KEY (`employee_id`)
    REFERENCES `employees` (`employee_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE `leave_requests`
    ADD CONSTRAINT `leave_requests_leave_type_id_fkey`
    FOREIGN KEY (`leave_type_id`)
    REFERENCES `leave_types` (`leave_type_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- ============================================================
-- END
-- ============================================================
