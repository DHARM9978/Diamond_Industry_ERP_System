-- ============================================================
-- Leave Type: System Default Casual Leave
-- ============================================================
--
-- Business rule:
--   1. Every company must have a system fallback "Casual Leave".
--   2. The fallback is unlimited and is not a client-created leave type.
--   3. As soon as the client creates any normal leave type, the
--      application will hide the system fallback and use only the
--      configured leave types.
--
-- Existing Casual Leave rows are converted into the system fallback
-- so existing leave requests continue to reference a valid leave type.
-- Existing LeaveBalance rows are intentionally preserved because they
-- contain historical usage data. The leave-balance service will ignore
-- finite quota enforcement for system-default leave types.
-- ============================================================

-- ============================================================
-- 1. Add system-default flag
-- ============================================================

ALTER TABLE `leave_types`
    ADD COLUMN `is_system_default` BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- 2. Add Prisma schema index
-- ============================================================

CREATE INDEX `leave_types_company_id_is_system_default_idx`
    ON `leave_types` (`company_id`, `is_system_default`);

-- ============================================================
-- 3. Convert the existing Casual Leave into the system fallback
-- ============================================================
--
-- Match by the business name rather than relying only on the old code.
-- The fallback has no annual quota.
-- ============================================================

UPDATE `leave_types`
SET
    `is_system_default` = TRUE,
    `annual_quota` = NULL
WHERE LOWER(TRIM(`name`)) = 'casual leave';

-- ============================================================
-- 4. Create the fallback for companies that do not have one
-- ============================================================
--
-- A fallback is created for every company that still has no
-- system-default leave type. If a company has client-created leave
-- types, the fallback will still exist in the database, but application
-- logic will hide it while configured leave types exist.
-- ============================================================

INSERT INTO `leave_types` (
    `company_id`,
    `name`,
    `code`,
    `description`,
    `annual_quota`,
    `is_system_default`,
    `is_paid`,
    `requires_approval`,
    `allow_half_day`,
    `allow_carry_forward`,
    `status`,
    `created_at`,
    `updated_at`
)
SELECT
    c.`company_id`,
    'Casual Leave',
    'CL',
    'System-provided unlimited fallback leave type',
    NULL,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    FALSE,
    'ACTIVE',
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
FROM `companies` c
LEFT JOIN `leave_types` lt
    ON lt.`company_id` = c.`company_id`
   AND lt.`is_system_default` = TRUE
WHERE lt.`leave_type_id` IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM `leave_types` existing_name
      WHERE existing_name.`company_id` = c.`company_id`
        AND LOWER(TRIM(existing_name.`name`)) = 'casual leave'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM `leave_types` existing_code
      WHERE existing_code.`company_id` = c.`company_id`
        AND UPPER(TRIM(existing_code.`code`)) = 'CL'
  );

-- ============================================================
-- END
-- ============================================================