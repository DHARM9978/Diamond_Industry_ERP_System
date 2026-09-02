-- CreateTable
CREATE TABLE `companies` (
    `company_id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_name` VARCHAR(150) NOT NULL,
    `address` TEXT NULL,
    `contact_email` VARCHAR(150) NULL,
    `contact_phone` VARCHAR(20) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`company_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin` (
    `admin_id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `password_hash` TEXT NOT NULL,
    `companyId` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admin_email_key`(`email`),
    INDEX `admin_companyId_idx`(`companyId`),
    PRIMARY KEY (`admin_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branches` (
    `branch_id` INTEGER NOT NULL AUTO_INCREMENT,
    `branch_name` VARCHAR(100) NOT NULL,
    `location` VARCHAR(150) NOT NULL,
    `companyId` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `branches_companyId_idx`(`companyId`),
    PRIMARY KEY (`branch_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `department_id` INTEGER NOT NULL AUTO_INCREMENT,
    `department_name` VARCHAR(100) NOT NULL,
    `branchId` INTEGER NOT NULL,
    `companyId` INTEGER NOT NULL,
    `managerId` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `departments_branchId_idx`(`branchId`),
    INDEX `departments_companyId_idx`(`companyId`),
    INDEX `departments_managerId_idx`(`managerId`),
    PRIMARY KEY (`department_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employees` (
    `employee_id` INTEGER NOT NULL AUTO_INCREMENT,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `gender` VARCHAR(20) NULL,
    `email` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `hire_date` DATE NULL,
    `role` VARCHAR(30) NOT NULL,
    `salary_rate_per_hour` DECIMAL(10, 2) NULL,
    `companyId` INTEGER NOT NULL,
    `branchId` INTEGER NOT NULL,
    `departmentId` INTEGER NULL,
    `managerId` INTEGER NULL,
    `status` VARCHAR(20) NOT NULL,
    `password_hash` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employees_email_key`(`email`),
    INDEX `employees_companyId_idx`(`companyId`),
    INDEX `employees_branchId_idx`(`branchId`),
    INDEX `employees_departmentId_idx`(`departmentId`),
    INDEX `employees_managerId_idx`(`managerId`),
    PRIMARY KEY (`employee_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `iot_devices` (
    `device_id` INTEGER NOT NULL AUTO_INCREMENT,
    `device_code` VARCHAR(50) NOT NULL,
    `device_name` VARCHAR(100) NOT NULL,
    `branchId` INTEGER NOT NULL,
    `companyId` INTEGER NOT NULL,
    `location` VARCHAR(150) NULL,
    `status` VARCHAR(20) NOT NULL,
    `last_seen_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `iot_devices_device_code_key`(`device_code`),
    INDEX `iot_devices_branchId_idx`(`branchId`),
    INDEX `iot_devices_companyId_idx`(`companyId`),
    PRIMARY KEY (`device_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fingerprint_templates` (
    `template_id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `sensor_slot` INTEGER NOT NULL,
    `finger_name` VARCHAR(30) NULL,
    `status` VARCHAR(20) NOT NULL,
    `enrolled_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `fingerprint_templates_employeeId_idx`(`employeeId`),
    UNIQUE INDEX `fingerprint_templates_sensor_slot_key`(`sensor_slot`),
    PRIMARY KEY (`template_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_punches` (
    `punch_id` BIGINT NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `deviceId` INTEGER NOT NULL,
    `sensor_slot` INTEGER NOT NULL,
    `punch_type` VARCHAR(10) NOT NULL,
    `punched_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attendance_punches_employeeId_idx`(`employeeId`),
    INDEX `attendance_punches_deviceId_idx`(`deviceId`),
    INDEX `attendance_punches_sensor_slot_idx`(`sensor_slot`),
    INDEX `attendance_punches_punched_at_idx`(`punched_at`),
    PRIMARY KEY (`punch_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance` (
    `attendance_id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `check_in_time` TIME(0) NULL,
    `check_out_time` TIME(0) NULL,
    `total_hours` DECIMAL(5, 2) NULL,
    `status` VARCHAR(20) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attendance_employeeId_idx`(`employeeId`),
    INDEX `attendance_date_idx`(`date`),
    UNIQUE INDEX `attendance_employeeId_date_key`(`employeeId`, `date`),
    PRIMARY KEY (`attendance_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `device_logs` (
    `log_id` BIGINT NOT NULL AUTO_INCREMENT,
    `deviceId` INTEGER NOT NULL,
    `event_type` VARCHAR(50) NOT NULL,
    `message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `device_logs_deviceId_idx`(`deviceId`),
    INDEX `device_logs_event_type_idx`(`event_type`),
    INDEX `device_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `advance_payments` (
    `advance_id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `reason` TEXT NULL,
    `payment_date` DATE NOT NULL,
    `approvedBy` INTEGER NULL,
    `status` VARCHAR(20) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `advance_payments_employeeId_idx`(`employeeId`),
    INDEX `advance_payments_approvedBy_idx`(`approvedBy`),
    PRIMARY KEY (`advance_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll` (
    `payroll_id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `pay_period_start` DATE NOT NULL,
    `pay_period_end` DATE NOT NULL,
    `total_working_hours` DECIMAL(8, 2) NOT NULL,
    `basic_salary` DECIMAL(12, 2) NOT NULL,
    `advance_deduction` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `net_salary` DECIMAL(12, 2) NOT NULL,
    `payment_date` DATE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payroll_employeeId_idx`(`employeeId`),
    INDEX `payroll_pay_period_start_pay_period_end_idx`(`pay_period_start`, `pay_period_end`),
    PRIMARY KEY (`payroll_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_logs` (
    `log_id` BIGINT NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NULL,
    `action_type` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activity_logs_employeeId_idx`(`employeeId`),
    INDEX `activity_logs_action_type_idx`(`action_type`),
    INDEX `activity_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `setting_id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `settings_companyId_idx`(`companyId`),
    UNIQUE INDEX `settings_companyId_key_key`(`companyId`, `key`),
    PRIMARY KEY (`setting_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `admin` ADD CONSTRAINT `admin_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`company_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branches` ADD CONSTRAINT `branches_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`company_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`branch_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`company_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `employees`(`employee_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`company_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`branch_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`department_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `employees`(`employee_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `iot_devices` ADD CONSTRAINT `iot_devices_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`branch_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `iot_devices` ADD CONSTRAINT `iot_devices_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`company_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fingerprint_templates` ADD CONSTRAINT `fingerprint_templates_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_punches` ADD CONSTRAINT `attendance_punches_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_punches` ADD CONSTRAINT `attendance_punches_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `iot_devices`(`device_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `attendance_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device_logs` ADD CONSTRAINT `device_logs_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `iot_devices`(`device_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `advance_payments` ADD CONSTRAINT `advance_payments_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `advance_payments` ADD CONSTRAINT `advance_payments_approvedBy_fkey` FOREIGN KEY (`approvedBy`) REFERENCES `employees`(`employee_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll` ADD CONSTRAINT `payroll_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`employee_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settings` ADD CONSTRAINT `settings_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`company_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
