-- Add paid public-holiday hours to payroll.
ALTER TABLE `payroll`
    ADD COLUMN `paid_holiday_hours` DECIMAL(8, 2) NOT NULL DEFAULT 0.00;

-- Create branch-specific public holidays.
CREATE TABLE `public_holidays` (
    `public_holiday_id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `branchId` INTEGER NOT NULL,
    `holiday_date` DATE NOT NULL,
    `holiday_name` VARCHAR(150) NOT NULL,
    `daily_working_hours` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `is_paid` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `public_holidays_branchId_holiday_date_key` (`branchId`, `holiday_date`),
    INDEX `public_holidays_companyId_idx` (`companyId`),
    INDEX `public_holidays_branchId_idx` (`branchId`),
    INDEX `public_holidays_holiday_date_idx` (`holiday_date`),
    PRIMARY KEY (`public_holiday_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Company relationship.
ALTER TABLE `public_holidays`
    ADD CONSTRAINT `public_holidays_companyId_fkey`
    FOREIGN KEY (`companyId`)
    REFERENCES `companies`(`company_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Branch relationship.
ALTER TABLE `public_holidays`
    ADD CONSTRAINT `public_holidays_branchId_fkey`
    FOREIGN KEY (`branchId`)
    REFERENCES `branches`(`branch_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;