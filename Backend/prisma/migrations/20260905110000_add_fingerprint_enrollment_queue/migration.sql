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

ALTER TABLE `fingerprint_enrollments`
ADD CONSTRAINT `fingerprint_enrollments_employee_id_fkey`
FOREIGN KEY (`employee_id`)
REFERENCES `employees`(`employee_id`)
ON DELETE RESTRICT
ON UPDATE CASCADE;