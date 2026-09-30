const crypto = require("crypto");
const bcrypt = require("bcrypt");
const prisma = require("../config/database");

// ==========================================
// CONSTANTS
// ==========================================

const WIFI_CONFIG_STATUS = Object.freeze({
    NOT_CONFIGURED: "NOT_CONFIGURED",
    PENDING: "PENDING",
    APPLIED: "APPLIED",
    FAILED: "FAILED",
});

const WIFI_NETWORK = Object.freeze({
    PRIMARY: "PRIMARY",
    SECONDARY: "SECONDARY",
});

// ==========================================
// DEVICE RESPONSE HELPERS
// ==========================================

// Never expose the stored device-secret hash or encrypted Wi-Fi configuration
// to the admin UI or normal device responses.
const sanitizeDevice = (device) => {
    if (!device) {
        return device;
    }

    const {
        deviceSecretHash,
        wifiConfigEncrypted,
        ...safeDevice
    } = device;

    return safeDevice;
};

// ==========================================
// DEVICE SECRET
// ==========================================

// Generate a strong random secret for a new ESP32 device.
// The plain secret is returned only once to the caller.
const generateDeviceSecret = () => {
    return crypto.randomBytes(32).toString("hex");
};

// ==========================================
// GENERAL VALIDATION
// ==========================================

const validateDeviceStatus = (status) => {
    if (status === undefined) {
        return;
    }

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
        const error = new Error(
            "Device status must be ACTIVE or INACTIVE"
        );
        error.statusCode = 400;
        throw error;
    }
};

const toPositiveInteger = (value, fieldName) => {
    const numericValue = Number(value);

    if (!Number.isInteger(numericValue) || numericValue < 1) {
        const error = new Error(
            `${fieldName} must be a valid positive integer`
        );
        error.statusCode = 400;
        throw error;
    }

    return numericValue;
};

// ==========================================
// WIFI ENCRYPTION
// ==========================================
//
// Wi-Fi credentials are encrypted before being stored in
// iot_devices.wifi_config_encrypted.
//
// Required environment variable:
//
// WIFI_CONFIG_ENCRYPTION_KEY=<64 hexadecimal characters>
//
// Generate one with:
//
// node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// The key must remain in the backend environment and must never
// be stored in the database or returned to the frontend/device.

const getWifiEncryptionKey = () => {
    const configuredKey = String(
        process.env.WIFI_CONFIG_ENCRYPTION_KEY || ""
    ).trim();

    if (!configuredKey) {
        const error = new Error(
            "WIFI_CONFIG_ENCRYPTION_KEY is not configured"
        );
        error.statusCode = 500;
        throw error;
    }

    // Preferred representation: 64-character hexadecimal string.
    if (/^[0-9a-fA-F]{64}$/.test(configuredKey)) {
        return Buffer.from(configuredKey, "hex");
    }

    // Also accept a standard base64 representation of 32 bytes.
    try {
        const decoded = Buffer.from(configuredKey, "base64");

        if (decoded.length === 32) {
            return decoded;
        }
    } catch (error) {
        // Fall through to the configuration error below.
    }

    const error = new Error(
        "WIFI_CONFIG_ENCRYPTION_KEY must be a 32-byte key encoded as 64 hex characters or base64"
    );
    error.statusCode = 500;
    throw error;
};

const encryptWifiConfiguration = (configuration) => {
    const key = getWifiEncryptionKey();
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        key,
        iv
    );

    const plaintext = JSON.stringify(configuration);

    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Versioned format:
    //
    // v1:<iv>:<authTag>:<ciphertext>
    //
    return [
        "v1",
        iv.toString("base64"),
        authTag.toString("base64"),
        encrypted.toString("base64"),
    ].join(":");
};

const decryptWifiConfiguration = (encryptedValue) => {
    if (!encryptedValue) {
        return null;
    }

    const parts = String(encryptedValue).split(":");

    if (parts.length !== 4 || parts[0] !== "v1") {
        const error = new Error(
            "Unsupported Wi-Fi configuration format"
        );
        error.statusCode = 500;
        throw error;
    }

    const [
        ,
        ivBase64,
        authTagBase64,
        ciphertextBase64,
    ] = parts;

    try {
        const key = getWifiEncryptionKey();

        const iv = Buffer.from(
            ivBase64,
            "base64"
        );

        const authTag = Buffer.from(
            authTagBase64,
            "base64"
        );

        const ciphertext = Buffer.from(
            ciphertextBase64,
            "base64"
        );

        const decipher = crypto.createDecipheriv(
            "aes-256-gcm",
            key,
            iv
        );

        decipher.setAuthTag(authTag);

        const plaintext = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]).toString("utf8");

        return JSON.parse(plaintext);
    } catch (error) {
        const encryptionError = new Error(
            "Unable to decrypt stored Wi-Fi configuration"
        );

        encryptionError.statusCode = 500;

        throw encryptionError;
    }
};

// ==========================================
// WIFI CONFIGURATION VALIDATION
// ==========================================

const normalizeWifiCredential = (
    value,
    fieldName,
    required = false
) => {
    if (value === undefined || value === null) {
        if (required) {
            const error = new Error(
                `${fieldName} is required`
            );

            error.statusCode = 400;

            throw error;
        }

        return null;
    }

    const normalized = String(value);

    if (required && !normalized.trim()) {
        const error = new Error(
            `${fieldName} is required`
        );

        error.statusCode = 400;

        throw error;
    }

    return normalized;
};

const validateWifiConfiguration = (data) => {
    if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
    ) {
        const error = new Error(
            "Wi-Fi configuration must be an object"
        );

        error.statusCode = 400;

        throw error;
    }

    const primarySsid =
        normalizeWifiCredential(
            data.primarySsid,
            "Primary Wi-Fi SSID",
            true
        );

    const primaryPassword =
        normalizeWifiCredential(
            data.primaryPassword,
            "Primary Wi-Fi password",
            true
        );

    const secondarySsid =
        normalizeWifiCredential(
            data.secondarySsid,
            "Secondary Wi-Fi SSID",
            false
        );

    const secondaryPassword =
        normalizeWifiCredential(
            data.secondaryPassword,
            "Secondary Wi-Fi password",
            false
        );

    if (primarySsid.length > 32) {
        const error = new Error(
            "Primary Wi-Fi SSID cannot exceed 32 characters"
        );

        error.statusCode = 400;

        throw error;
    }

    if (
        primaryPassword.length < 8 ||
        primaryPassword.length > 63
    ) {
        const error = new Error(
            "Primary Wi-Fi password must contain 8 to 63 characters"
        );

        error.statusCode = 400;

        throw error;
    }

    if (
        secondarySsid &&
        secondarySsid.length > 32
    ) {
        const error = new Error(
            "Secondary Wi-Fi SSID cannot exceed 32 characters"
        );

        error.statusCode = 400;

        throw error;
    }

    if (
        secondarySsid &&
        !secondaryPassword
    ) {
        const error = new Error(
            "Secondary Wi-Fi password is required when a secondary SSID is provided"
        );

        error.statusCode = 400;

        throw error;
    }

    if (
        secondaryPassword &&
        !secondarySsid
    ) {
        const error = new Error(
            "Secondary Wi-Fi SSID is required when a secondary password is provided"
        );

        error.statusCode = 400;

        throw error;
    }

    if (
        secondaryPassword &&
        (
            secondaryPassword.length < 8 ||
            secondaryPassword.length > 63
        )
    ) {
        const error = new Error(
            "Secondary Wi-Fi password must contain 8 to 63 characters"
        );

        error.statusCode = 400;

        throw error;
    }

    return {
        primarySsid,
        primaryPassword,
        secondarySsid,
        secondaryPassword,
    };
};

// ==========================================
// WIFI CONFIGURATION RESPONSE HELPERS
// ==========================================

// Only safe Wi-Fi metadata is returned to the admin UI.
// SSIDs/passwords and encrypted credential data are never
// returned here.
const sanitizeWifiMetadata = (device) => {
    if (!device) {
        return null;
    }

    return {
        deviceId: device.deviceId,
        deviceCode: device.deviceCode,

        wifiConfigVersion:
            device.wifiConfigVersion,

        wifiConfigStatus:
            device.wifiConfigStatus,

        wifiConfigUpdatedAt:
            device.wifiConfigUpdatedAt,

        wifiConfigAcknowledgedAt:
            device.wifiConfigAcknowledgedAt,

        wifiActiveNetwork:
            device.wifiActiveNetwork,

        wifiLastError:
            device.wifiLastError,
    };
};

// ==========================================
// Get Device By ID
// ==========================================

const getDeviceById = async (
    deviceId,
    companyId
) => {
    const device =
        await prisma.iotDevice.findFirst({
            where: {
                deviceId: Number(deviceId),
                companyId: Number(companyId),
            },

            include: {
                branch: true,
            },
        });

    if (!device) {
        const error = new Error(
            "Device not found"
        );

        error.statusCode = 404;

        throw error;
    }

    return sanitizeDevice(device);
};

// ==========================================
// Get All Devices
// ==========================================

const getAllDevices = async (
    companyId
) => {
    const devices =
        await prisma.iotDevice.findMany({
            where: {
                companyId: Number(companyId),
            },

            include: {
                branch: true,
            },

            orderBy: {
                deviceId: "asc",
            },
        });

    return devices.map(sanitizeDevice);
};

// ==========================================
// Create Device
// ==========================================

const createDevice = async (
    data,
    companyId
) => {
    const {
        deviceCode,
        deviceName,
        location,
        branchId,
        status,
    } = data;

    const normalizedDeviceCode =
        String(deviceCode || "").trim();

    const normalizedDeviceName =
        String(deviceName || "").trim();

    const normalizedLocation =
        location === undefined ||
        location === null
            ? null
            : String(location).trim() || null;

    // ======================================
    // Required fields
    // ======================================

    if (!normalizedDeviceCode) {
        const error = new Error(
            "Device code is required"
        );

        error.statusCode = 400;

        throw error;
    }

    if (!normalizedDeviceName) {
        const error = new Error(
            "Device name is required"
        );

        error.statusCode = 400;

        throw error;
    }

    if (!branchId) {
        const error = new Error(
            "Branch ID is required"
        );

        error.statusCode = 400;

        throw error;
    }

    validateDeviceStatus(status);

    // ======================================
    // Verify branch belongs to company
    // ======================================

    const branch =
        await prisma.branch.findFirst({
            where: {
                branchId: Number(branchId),
                companyId: Number(companyId),
            },
        });

    if (!branch) {
        const error = new Error(
            "Branch not found in your company"
        );

        error.statusCode = 404;

        throw error;
    }

    // ======================================
    // Check duplicate device code
    // ======================================

    const existingDevice =
        await prisma.iotDevice.findFirst({
            where: {
                deviceCode:
                    normalizedDeviceCode,
            },
        });

    if (existingDevice) {
        const error = new Error(
            "Device code already exists"
        );

        error.statusCode = 409;

        throw error;
    }

    // ======================================
    // Generate device credentials
    // ======================================

    const deviceSecret =
        generateDeviceSecret();

    const deviceSecretHash =
        await bcrypt.hash(
            deviceSecret,
            12
        );

    // ======================================
    // Create device
    // ======================================

    const device =
        await prisma.iotDevice.create({
            data: {
                deviceCode:
                    normalizedDeviceCode,

                deviceName:
                    normalizedDeviceName,

                location:
                    normalizedLocation,

                companyId:
                    Number(companyId),

                branchId:
                    Number(branchId),

                status:
                    status || "ACTIVE",

                deviceSecretHash,
            },

            include: {
                branch: true,
            },
        });

    return {
        device:
            sanitizeDevice(device),

        deviceSecret,
    };
};

// ==========================================
// Update Device
// ==========================================

const updateDevice = async (
    deviceId,
    data,
    companyId
) => {
    const id = Number(deviceId);
    const company = Number(companyId);

    if (
        !Number.isInteger(id) ||
        id < 1
    ) {
        const error = new Error(
            "Invalid device ID"
        );

        error.statusCode = 400;

        throw error;
    }

    // ======================================
    // Find existing device
    // ======================================

    const existingDevice =
        await prisma.iotDevice.findFirst({
            where: {
                deviceId: id,
                companyId: company,
            },
        });

    if (!existingDevice) {
        const error = new Error(
            "Device not found"
        );

        error.statusCode = 404;

        throw error;
    }

    const {
        deviceName,
        location,
        branchId,
        status,
    } = data;

    validateDeviceStatus(status);

    // ======================================
    // Verify new branch
    // ======================================

    if (branchId !== undefined) {
        const numericBranchId =
            Number(branchId);

        if (
            !Number.isInteger(
                numericBranchId
            ) ||
            numericBranchId < 1
        ) {
            const error = new Error(
                "A valid branch is required"
            );

            error.statusCode = 400;

            throw error;
        }

        const branch =
            await prisma.branch.findFirst({
                where: {
                    branchId:
                        numericBranchId,

                    companyId:
                        company,
                },
            });

        if (!branch) {
            const error = new Error(
                "Branch not found in your company"
            );

            error.statusCode = 404;

            throw error;
        }
    }

    // ======================================
    // Validate text fields
    // ======================================

    const normalizedDeviceName =
        deviceName === undefined
            ? undefined
            : String(deviceName).trim();

    const normalizedLocation =
        location === undefined
            ? undefined
            : String(location).trim() ||
              null;

    if (
        normalizedDeviceName !==
            undefined &&
        !normalizedDeviceName
    ) {
        const error = new Error(
            "Device name is required"
        );

        error.statusCode = 400;

        throw error;
    }

    // ======================================
    // Update device
    // ======================================

    const device =
        await prisma.iotDevice.update({
            where: {
                deviceId: id,
            },

            data: {
                ...(normalizedDeviceName !==
                    undefined && {
                    deviceName:
                        normalizedDeviceName,
                }),

                ...(normalizedLocation !==
                    undefined && {
                    location:
                        normalizedLocation,
                }),

                ...(branchId !==
                    undefined && {
                    branchId:
                        Number(branchId),
                }),

                ...(status !==
                    undefined && {
                    status,
                }),
            },

            include: {
                branch: true,
            },
        });

    return sanitizeDevice(device);
};

// ==========================================
// Delete Device
// ==========================================

const deleteDevice = async (
    deviceId,
    companyId
) => {
    const id = Number(deviceId);
    const company = Number(companyId);

    // ======================================
    // Find existing device
    // ======================================

    const existingDevice =
        await prisma.iotDevice.findFirst({
            where: {
                deviceId: id,
                companyId: company,
            },
        });

    if (!existingDevice) {
        const error = new Error(
            "Device not found"
        );

        error.statusCode = 404;

        throw error;
    }

    // ======================================
    // Delete device
    // ======================================

    await prisma.iotDevice.delete({
        where: {
            deviceId: id,
        },
    });

    return true;
};

// ==========================================
// Set Wi-Fi Configuration
// ==========================================
//
// Admin-side operation.
//
// The passwords are encrypted and stored in
// iot_devices.wifi_config_encrypted.
//
// Plaintext Wi-Fi credentials are never returned
// from this function.
//
// The new configuration is marked PENDING.
//
// The ESP32 must retrieve the configuration,
// test it, and acknowledge the result.

const setWifiConfiguration = async (
    deviceId,
    data,
    companyId
) => {
    const id =
        toPositiveInteger(
            deviceId,
            "Device ID"
        );

    const company =
        toPositiveInteger(
            companyId,
            "Company ID"
        );

    // ======================================
    // Find device
    // ======================================

    const existingDevice =
        await prisma.iotDevice.findFirst({
            where: {
                deviceId: id,
                companyId: company,
            },
        });

    if (!existingDevice) {
        const error = new Error(
            "Device not found"
        );

        error.statusCode = 404;

        throw error;
    }

    // ======================================
    // Validate Wi-Fi configuration
    // ======================================

    const wifiConfiguration =
        validateWifiConfiguration(data);

    // ======================================
    // Encrypt credentials
    // ======================================

    const encryptedConfiguration =
        encryptWifiConfiguration(
            wifiConfiguration
        );

    // ======================================
    // Generate configuration version
    // ======================================

    const nextVersion =
        Number(
            existingDevice.wifiConfigVersion ||
            0
        ) + 1;

    // ======================================
    // Save configuration
    // ======================================

    const updatedDevice =
        await prisma.iotDevice.update({
            where: {
                deviceId: id,
            },

            data: {
                wifiConfigEncrypted:
                    encryptedConfiguration,

                wifiConfigVersion:
                    nextVersion,

                wifiConfigStatus:
                    WIFI_CONFIG_STATUS.PENDING,

                wifiConfigUpdatedAt:
                    new Date(),

                wifiConfigAcknowledgedAt:
                    null,

                wifiLastError:
                    null,
            },
        });

    return sanitizeWifiMetadata(
        updatedDevice
    );
};

// ==========================================
// Get Wi-Fi Metadata For Admin
// ==========================================
//
// Does NOT return Wi-Fi SSIDs,
// passwords, or encrypted credentials.

const getWifiConfigurationMetadata =
    async (
        deviceId,
        companyId
    ) => {
        const id =
            toPositiveInteger(
                deviceId,
                "Device ID"
            );

        const company =
            toPositiveInteger(
                companyId,
                "Company ID"
            );

        const device =
            await prisma.iotDevice.findFirst({
                where: {
                    deviceId: id,
                    companyId: company,
                },
            });

        if (!device) {
            const error = new Error(
                "Device not found"
            );

            error.statusCode = 404;

            throw error;
        }

        return sanitizeWifiMetadata(
            device
        );
    };

// ==========================================
// Get Pending Wi-Fi Configuration For ESP32
// ==========================================
//
// This function is intended for an authenticated
// ESP32, not the ERP admin UI.
//
// Plaintext credentials are returned only to
// the authenticated device endpoint so the ESP32
// can test/apply them.
//
// The caller must already have authenticated
// the device using the existing Device Code +
// Device Secret middleware.

const getWifiConfigurationForDevice =
    async (
        deviceId,
        deviceCode
    ) => {
        const id =
            toPositiveInteger(
                deviceId,
                "Device ID"
            );

        const normalizedDeviceCode =
            String(
                deviceCode || ""
            ).trim();

        if (!normalizedDeviceCode) {
            const error = new Error(
                "Device code is required"
            );

            error.statusCode = 400;

            throw error;
        }

        const device =
            await prisma.iotDevice.findFirst({
                where: {
                    deviceId: id,
                    deviceCode:
                        normalizedDeviceCode,
                },
            });

        if (!device) {
            const error = new Error(
                "Device not found"
            );

            error.statusCode = 404;

            throw error;
        }

        // ==================================
        // No Wi-Fi configuration yet
        // ==================================

        if (
            !device.wifiConfigEncrypted
        ) {
            return {
                deviceId:
                    device.deviceId,

                deviceCode:
                    device.deviceCode,

                configVersion:
                    device.wifiConfigVersion,

                status:
                    device.wifiConfigStatus,

                configuration:
                    null,
            };
        }

        // ==================================
        // Decrypt configuration
        // ==================================

        const configuration =
            decryptWifiConfiguration(
                device.wifiConfigEncrypted
            );

        return {
            deviceId:
                device.deviceId,

            deviceCode:
                device.deviceCode,

            configVersion:
                device.wifiConfigVersion,

            status:
                device.wifiConfigStatus,

            configuration,
        };
    };

// ==========================================
// Acknowledge Wi-Fi Configuration
// ==========================================
//
// Called by ESP32 after it has tested the
// configuration.
//
// SUCCESS:
//     status -> APPLIED
//
// FAILURE:
//     status -> FAILED
//
// The acknowledged version must match the
// currently stored configuration version.
//
// This prevents an old ESP32 response from
// overwriting the state of a newer configuration.

const acknowledgeWifiConfiguration =
    async (
        deviceId,
        deviceCode,
        data
    ) => {
        const id =
            toPositiveInteger(
                deviceId,
                "Device ID"
            );

        const normalizedDeviceCode =
            String(
                deviceCode || ""
            ).trim();

        if (!normalizedDeviceCode) {
            const error = new Error(
                "Device code is required"
            );

            error.statusCode = 400;

            throw error;
        }

        if (
            !data ||
            typeof data !== "object"
        ) {
            const error = new Error(
                "Wi-Fi acknowledgement data is required"
            );

            error.statusCode = 400;

            throw error;
        }

        const version =
            Number(data.configVersion);

        if (
            !Number.isInteger(version) ||
            version < 1
        ) {
            const error = new Error(
                "A valid Wi-Fi configuration version is required"
            );

            error.statusCode = 400;

            throw error;
        }

        const success =
            data.success === true;

        const activeNetwork =
            data.activeNetwork ===
                undefined ||
            data.activeNetwork === null ||
            data.activeNetwork === ""
                ? null
                : String(
                      data.activeNetwork
                  )
                      .trim()
                      .toUpperCase();

        if (
            activeNetwork !== null &&
            !Object.values(
                WIFI_NETWORK
            ).includes(activeNetwork)
        ) {
            const error = new Error(
                "Active network must be PRIMARY or SECONDARY"
            );

            error.statusCode = 400;

            throw error;
        }

        const errorMessage =
            data.error === undefined ||
            data.error === null
                ? null
                : String(data.error)
                      .trim()
                      .slice(0, 2000);

        // ==================================
        // Find device
        // ==================================

        const device =
            await prisma.iotDevice.findFirst({
                where: {
                    deviceId: id,
                    deviceCode:
                        normalizedDeviceCode,
                },
            });

        if (!device) {
            const error = new Error(
                "Device not found"
            );

            error.statusCode = 404;

            throw error;
        }

        // ==================================
        // Version protection
        // ==================================

        if (
            version !==
            Number(
                device.wifiConfigVersion
            )
        ) {
            const error = new Error(
                "Wi-Fi configuration version is no longer current"
            );

            error.statusCode = 409;

            throw error;
        }

        // ==================================
        // Update result
        // ==================================

        const updatedDevice =
            await prisma.iotDevice.update({
                where: {
                    deviceId: id,
                },

                data: {
                    wifiConfigStatus:
                        success
                            ? WIFI_CONFIG_STATUS.APPLIED
                            : WIFI_CONFIG_STATUS.FAILED,

                    wifiConfigAcknowledgedAt:
                        new Date(),

                    wifiActiveNetwork:
                        activeNetwork ||
                        undefined,

                    wifiLastError:
                        success
                            ? null
                            : errorMessage ||
                              "ESP32 failed to apply Wi-Fi configuration",
                },
            });

        return {
            deviceId:
                updatedDevice.deviceId,

            deviceCode:
                updatedDevice.deviceCode,

            configVersion:
                updatedDevice.wifiConfigVersion,

            status:
                updatedDevice.wifiConfigStatus,

            acknowledgedAt:
                updatedDevice
                    .wifiConfigAcknowledgedAt,

            activeNetwork:
                updatedDevice
                    .wifiActiveNetwork,

            lastError:
                updatedDevice.wifiLastError,
        };
    };

// ==========================================
// Update Device Wi-Fi Runtime State
// ==========================================
//
// Allows an authenticated ESP32 to report
// which configured network it is currently
// using and its latest Wi-Fi error.
//
// This does NOT modify stored Wi-Fi credentials.

const updateWifiRuntimeState =
    async (
        deviceId,
        deviceCode,
        data
    ) => {
        const id =
            toPositiveInteger(
                deviceId,
                "Device ID"
            );

        const normalizedDeviceCode =
            String(
                deviceCode || ""
            ).trim();

        if (!normalizedDeviceCode) {
            const error = new Error(
                "Device code is required"
            );

            error.statusCode = 400;

            throw error;
        }

        const activeNetwork =
            data?.activeNetwork ===
                undefined ||
            data?.activeNetwork === null ||
            data?.activeNetwork === ""
                ? null
                : String(
                      data.activeNetwork
                  )
                      .trim()
                      .toUpperCase();

        if (
            activeNetwork !== null &&
            !Object.values(
                WIFI_NETWORK
            ).includes(activeNetwork)
        ) {
            const error = new Error(
                "Active network must be PRIMARY or SECONDARY"
            );

            error.statusCode = 400;

            throw error;
        }

        const lastError =
            data?.lastError ===
                undefined ||
            data?.lastError === null ||
            data?.lastError === ""
                ? null
                : String(data.lastError)
                      .trim()
                      .slice(0, 2000);

        // ==================================
        // Find device
        // ==================================

        const device =
            await prisma.iotDevice.findFirst({
                where: {
                    deviceId: id,
                    deviceCode:
                        normalizedDeviceCode,
                },
            });

        if (!device) {
            const error = new Error(
                "Device not found"
            );

            error.statusCode = 404;

            throw error;
        }

        // ==================================
        // Update runtime state
        // ==================================

        const updatedDevice =
            await prisma.iotDevice.update({
                where: {
                    deviceId: id,
                },

                data: {
                    wifiActiveNetwork:
                        activeNetwork ||
                        undefined,

                    wifiLastError:
                        lastError,

                    lastSeenAt:
                        new Date(),
                },
            });

        return {
            deviceId:
                updatedDevice.deviceId,

            deviceCode:
                updatedDevice.deviceCode,

            wifiActiveNetwork:
                updatedDevice
                    .wifiActiveNetwork,

            wifiLastError:
                updatedDevice
                    .wifiLastError,

            lastSeenAt:
                updatedDevice.lastSeenAt,
        };
    };

// ==========================================
// MODULE EXPORTS
// ==========================================

module.exports = {
    // Existing device operations
    getDeviceById,
    getAllDevices,
    createDevice,
    updateDevice,
    deleteDevice,

    // Wi-Fi configuration operations
    setWifiConfiguration,
    getWifiConfigurationMetadata,
    getWifiConfigurationForDevice,
    acknowledgeWifiConfiguration,
    updateWifiRuntimeState,

    // Wi-Fi helpers
    validateWifiConfiguration,
    encryptWifiConfiguration,
    decryptWifiConfiguration,
};