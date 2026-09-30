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
    `base_salary` DECIMAL(12, 2) NULL,
    `monthly_expected_hours` DECIMAL(8, 2) NULL,
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
    `device_secret_hash` VARCHAR(255) NULL,

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

    UNIQUE INDEX `fingerprint_templates_sensor_slot_key`(`sensor_slot`),
    INDEX `fingerprint_templates_employeeId_idx`(`employeeId`),
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
    `event_id` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attendance_punches_employeeId_idx`(`employeeId`),
    INDEX `attendance_punches_deviceId_idx`(`deviceId`),
    INDEX `attendance_punches_sensor_slot_idx`(`sensor_slot`),
    INDEX `attendance_punches_punched_at_idx`(`punched_at`),
    UNIQUE INDEX `attendance_punches_deviceId_event_id_key`(`deviceId`, `event_id`),
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
    `resolution_source` VARCHAR(20) NULL,
    `manual_override` BOOLEAN NOT NULL DEFAULT false,
    `manual_override_at` DATETIME(3) NULL,
    `manual_override_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attendance_employeeId_idx`(`employeeId`),
    INDEX `attendance_date_idx`(`date`),
    INDEX `attendance_manual_override_by_idx`(`manual_override_by`),
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
    `approved_amount` DECIMAL(10, 2) NULL,
    `paid_amount` DECIMAL(10, 2) NULL,
    `reason` TEXT NULL,
    `payment_date` DATE NOT NULL,
    `approvedBy` INTEGER NULL,
    `status` VARCHAR(20) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deducted_at` DATETIME(3) NULL,
    `deducted_in_payroll_id` INTEGER NULL,

    UNIQUE INDEX `advance_payments_deducted_in_payroll_id_key`(`deducted_in_payroll_id`),
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
    `base_salary` DECIMAL(12, 2) NULL,
    `monthly_expected_hours` DECIMAL(8, 2) NULL,
    `salary_rate_per_hour` DECIMAL(10, 2) NULL,
    `total_working_hours` DECIMAL(8, 2) NOT NULL,
    `regular_working_hours` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    `shortage_hours` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    `shortage_deduction` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `extra_hours` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    `paid_holiday_hours` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    `basic_salary` DECIMAL(12, 2) NOT NULL,
    `incentive_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `advance_deduction` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `net_salary` DECIMAL(12, 2) NOT NULL,
    `scheduled_payment_date` DATE NULL,
    `payment_date` DATE NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payroll_employeeId_idx`(`employeeId`),
    INDEX `payroll_pay_period_start_pay_period_end_idx`(`pay_period_start`, `pay_period_end`),
    INDEX `payroll_status_idx`(`status`),
    INDEX `payroll_scheduled_payment_date_idx`(`scheduled_payment_date`),
    PRIMARY KEY (`payroll_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `extra_work` (
    `extra_work_id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `payroll_id` INTEGER NOT NULL,
    `extra_hours` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACCUMULATED',
    `settlement_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `extra_work_employeeId_idx`(`employeeId`),
    INDEX `extra_work_payroll_id_idx`(`payroll_id`),
    INDEX `extra_work_status_idx`(`status`),
    INDEX `extra_work_settlement_id_idx`(`settlement_id`),
    INDEX `extra_work_created_at_idx`(`created_at`),
    PRIMARY KEY (`extra_work_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `extra_work_settlements` (
    `settlement_id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `payroll_id` INTEGER NULL,
    `settled_hours` DECIMAL(8, 2) NOT NULL,
    `incentive_amount` DECIMAL(12, 2) NOT NULL,
    `settlement_date` DATE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `extra_work_settlements_employeeId_idx`(`employeeId`),
    INDEX `extra_work_settlements_payroll_id_idx`(`payroll_id`),
    INDEX `extra_work_settlements_settlement_date_idx`(`settlement_date`),
    PRIMARY KEY (`settlement_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
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

    INDEX `public_holidays_companyId_idx`(`companyId`),
    INDEX `public_holidays_branchId_idx`(`branchId`),
    INDEX `public_holidays_holiday_date_idx`(`holiday_date`),
    UNIQUE INDEX `public_holidays_branchId_holiday_date_key`(`branchId`, `holiday_date`),
    PRIMARY KEY (`public_holiday_id`)
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
CREATE TABLE `leave_types` (
    `leave_type_id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `description` TEXT NULL,
    `annual_quota` DECIMAL(6, 2) NULL,
    `is_system_default` BOOLEAN NOT NULL DEFAULT false,
    `is_paid` BOOLEAN NOT NULL DEFAULT true,
    `requires_approval` BOOLEAN NOT NULL DEFAULT true,
    `allow_half_day` BOOLEAN NOT NULL DEFAULT true,
    `allow_carry_forward` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `leave_types_company_id_idx`(`company_id`),
    INDEX `leave_types_company_id_is_system_default_idx`(`company_id`, `is_system_default`),
    INDEX `leave_types_status_idx`(`status`),
    UNIQUE INDEX `leave_types_company_id_code_key`(`company_id`, `code`),
    UNIQUE INDEX `leave_types_company_id_name_key`(`company_id`, `name`),
    PRIMARY KEY (`leave_type_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_balances` (
    `leave_balance_id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `leave_type_id` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `allocated` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    `used` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    `remaining` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `leave_balances_employee_id_idx`(`employee_id`),
    INDEX `leave_balances_leave_type_id_idx`(`leave_type_id`),
    INDEX `leave_balances_year_idx`(`year`),
    UNIQUE INDEX `leave_balances_employee_id_leave_type_id_year_key`(`employee_id`, `leave_type_id`, `year`),
    PRIMARY KEY (`leave_balance_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_requests` (
    `leave_request_id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `leave_type_id` INTEGER NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `total_days` DECIMAL(6, 2) NOT NULL,
    `reason` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `approved_by` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `approved_start_date` DATE NULL,
    `approved_end_date` DATE NULL,
    `approved_days` DECIMAL(6, 2) NULL,
    `rejection_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `leave_requests_employee_id_idx`(`employee_id`),
    INDEX `leave_requests_leave_type_id_idx`(`leave_type_id`),
    INDEX `leave_requests_status_idx`(`status`),
    INDEX `leave_requests_start_date_end_date_idx`(`start_date`, `end_date`),
    INDEX `leave_requests_approved_start_date_approved_end_date_idx`(`approved_start_date`, `approved_end_date`),
    PRIMARY KEY (`leave_request_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fingerprint_enrollments` (
    `enrollment_id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `sensor_slot` INTEGER NOT NULL,
    `finger_name` VARCHAR(30) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `confidence` INTEGER NULL,
    `error_message` TEXT NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `fingerprint_enrollments_employee_id_idx`(`employee_id`),
    INDEX `fingerprint_enrollments_status_idx`(`status`),
    INDEX `fingerprint_enrollments_sensor_slot_idx`(`sensor_slot`),
    INDEX `fingerprint_enrollments_created_at_idx`(`created_at`),
    PRIMARY KEY (`enrollment_id`)
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
ALTER TABLE `employees` ADD CONSTRAINT `employees_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`branch_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`company_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE `attendance_punches` ADD CONSTRAINT `attendance_punches_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `iot_devices`(`device_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_punches` ADD CONSTRAINT `attendance_punches_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `attendance_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `attendance_manual_override_by_fkey` FOREIGN KEY (`manual_override_by`) REFERENCES `admin`(`admin_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device_logs` ADD CONSTRAINT `device_logs_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `iot_devices`(`device_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `advance_payments` ADD CONSTRAINT `advance_payments_approvedBy_fkey` FOREIGN KEY (`approvedBy`) REFERENCES `admin`(`admin_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `advance_payments` ADD CONSTRAINT `advance_payments_deducted_in_payroll_id_fkey` FOREIGN KEY (`deducted_in_payroll_id`) REFERENCES `payroll`(`payroll_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `advance_payments` ADD CONSTRAINT `advance_payments_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll` ADD CONSTRAINT `payroll_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `extra_work` ADD CONSTRAINT `extra_work_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `extra_work` ADD CONSTRAINT `extra_work_payroll_id_fkey` FOREIGN KEY (`payroll_id`) REFERENCES `payroll`(`payroll_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `extra_work` ADD CONSTRAINT `extra_work_settlement_id_fkey` FOREIGN KEY (`settlement_id`) REFERENCES `extra_work_settlements`(`settlement_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `extra_work_settlements` ADD CONSTRAINT `extra_work_settlements_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `extra_work_settlements` ADD CONSTRAINT `extra_work_settlements_payroll_id_fkey` FOREIGN KEY (`payroll_id`) REFERENCES `payroll`(`payroll_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `public_holidays` ADD CONSTRAINT `public_holidays_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`company_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `public_holidays` ADD CONSTRAINT `public_holidays_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`branch_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`employee_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settings` ADD CONSTRAINT `settings_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`company_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_types` ADD CONSTRAINT `leave_types_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`company_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_balances` ADD CONSTRAINT `leave_balances_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_balances` ADD CONSTRAINT `leave_balances_leave_type_id_fkey` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`leave_type_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_leave_type_id_fkey` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`leave_type_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fingerprint_enrollments` ADD CONSTRAINT `fingerprint_enrollments_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
