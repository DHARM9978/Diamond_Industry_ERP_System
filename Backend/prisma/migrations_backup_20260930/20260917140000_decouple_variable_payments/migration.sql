-- Decouple variable/overtime payments from the
-- one-to-one payroll relationship.

-- ============================================================
-- EXTRA WORK
-- ============================================================

-- The existing unique index is currently required by the
-- payroll foreign key, so remove the foreign key first.
ALTER TABLE `extra_work`
    DROP FOREIGN KEY `extra_work_payroll_id_fkey`;

-- Remove the one-to-one UNIQUE constraint.
ALTER TABLE `extra_work`
    DROP INDEX `extra_work_payroll_id_key`;

-- Replace it with a normal index.
CREATE INDEX `extra_work_payroll_id_idx`
    ON `extra_work` (`payroll_id`);

-- Re-create the foreign key.
ALTER TABLE `extra_work`
    ADD CONSTRAINT `extra_work_payroll_id_fkey`
    FOREIGN KEY (`payroll_id`) REFERENCES `payroll` (`payroll_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============================================================
-- EXTRA WORK SETTLEMENTS
-- ============================================================

-- Remove the foreign key first because its supporting index
-- is currently the UNIQUE payroll_id index.
ALTER TABLE `extra_work_settlements`
    DROP FOREIGN KEY `extra_work_settlements_payroll_id_fkey`;

-- Remove the one-to-one UNIQUE constraint.
ALTER TABLE `extra_work_settlements`
    DROP INDEX `extra_work_settlements_payroll_id_key`;

-- Replace it with a normal index.
CREATE INDEX `extra_work_settlements_payroll_id_idx`
    ON `extra_work_settlements` (`payroll_id`);

-- Re-create the foreign key.
ALTER TABLE `extra_work_settlements`
    ADD CONSTRAINT `extra_work_settlements_payroll_id_fkey`
    FOREIGN KEY (`payroll_id`) REFERENCES `payroll` (`payroll_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;