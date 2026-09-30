-- ============================================================
-- Attendance Resolution + Batch Event Idempotency
-- ============================================================
--
-- AttendancePunch remains the raw biometric/device audit source.
-- event_id identifies a real device event so repeated batch uploads
-- cannot create duplicate raw punches for the same device event.
--
-- Attendance stores the resolved ERP result. Automatic checkout is
-- represented here as AUTO_CLOSE and never as a synthetic punch.
-- ============================================================

-- ============================================================
-- 1. Add idempotent device event identity to raw punches
-- ============================================================

ALTER TABLE `attendance_punches`
    ADD COLUMN `event_id` VARCHAR(100) NULL;

CREATE UNIQUE INDEX `attendance_punches_deviceId_event_id_key`
    ON `attendance_punches` (`deviceId`, `event_id`);

-- ============================================================
-- 2. Add attendance resolution metadata
-- ============================================================

ALTER TABLE `attendance`
    ADD COLUMN `resolution_source` VARCHAR(20) NULL,
    ADD COLUMN `manual_override` BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN `manual_override_at` DATETIME(3) NULL,
    ADD COLUMN `manual_override_by` INTEGER NULL;

CREATE INDEX `attendance_manual_override_by_idx`
    ON `attendance` (`manual_override_by`);

-- ============================================================
-- 3. Link an attendance override to the existing Admin model
-- ============================================================

ALTER TABLE `attendance`
    ADD CONSTRAINT `attendance_manual_override_by_fkey`
    FOREIGN KEY (`manual_override_by`)
    REFERENCES `admin` (`admin_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- ============================================================
-- END
-- ============================================================
