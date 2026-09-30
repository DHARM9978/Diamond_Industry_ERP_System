-- AlterTable
ALTER TABLE `iot_devices` ADD COLUMN `wifi_active_network` VARCHAR(20) NULL,
    ADD COLUMN `wifi_config_acknowledged_at` DATETIME(3) NULL,
    ADD COLUMN `wifi_config_encrypted` TEXT NULL,
    ADD COLUMN `wifi_config_status` VARCHAR(30) NOT NULL DEFAULT 'NOT_CONFIGURED',
    ADD COLUMN `wifi_config_updated_at` DATETIME(3) NULL,
    ADD COLUMN `wifi_config_version` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `wifi_last_error` TEXT NULL;
