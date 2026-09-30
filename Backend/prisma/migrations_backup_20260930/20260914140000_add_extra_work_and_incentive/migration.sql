ALTER TABLE `payroll`
    ADD COLUMN `extra_hours` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN `incentive_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN `regular_working_hours` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN `shortage_deduction` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN `shortage_hours` DECIMAL(8, 2) NOT NULL DEFAULT 0.00;

CREATE TABLE `extra_work` (
    `extra_work_id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `payroll_id` INTEGER NOT NULL,
    `extra_hours` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACCUMULATED',
    `settlement_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `extra_work_payroll_id_key` (`payroll_id`),
    INDEX `extra_work_employeeId_idx` (`employeeId`),
    INDEX `extra_work_status_idx` (`status`),
    INDEX `extra_work_settlement_id_idx` (`settlement_id`),
    INDEX `extra_work_created_at_idx` (`created_at`),
    PRIMARY KEY (`extra_work_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `extra_work_settlements` (
    `settlement_id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `payroll_id` INTEGER NOT NULL,
    `settled_hours` DECIMAL(8, 2) NOT NULL,
    `incentive_amount` DECIMAL(12, 2) NOT NULL,
    `settlement_date` DATE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `extra_work_settlements_payroll_id_key` (`payroll_id`),
    INDEX `extra_work_settlements_employeeId_idx` (`employeeId`),
    INDEX `extra_work_settlements_settlement_date_idx` (`settlement_date`),
    PRIMARY KEY (`settlement_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `extra_work`
    ADD CONSTRAINT `extra_work_employeeId_fkey`
    FOREIGN KEY (`employeeId`) REFERENCES `employees` (`employee_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `extra_work`
    ADD CONSTRAINT `extra_work_payroll_id_fkey`
    FOREIGN KEY (`payroll_id`) REFERENCES `payroll` (`payroll_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `extra_work`
    ADD CONSTRAINT `extra_work_settlement_id_fkey`
    FOREIGN KEY (`settlement_id`) REFERENCES `extra_work_settlements` (`settlement_id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `extra_work_settlements`
    ADD CONSTRAINT `extra_work_settlements_employeeId_fkey`
    FOREIGN KEY (`employeeId`) REFERENCES `employees` (`employee_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `extra_work_settlements`
    ADD CONSTRAINT `extra_work_settlements_payroll_id_fkey`
    FOREIGN KEY (`payroll_id`) REFERENCES `payroll` (`payroll_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;