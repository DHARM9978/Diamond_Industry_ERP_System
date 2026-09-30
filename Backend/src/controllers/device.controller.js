const deviceService =
    require("../services/device.service");

// ==========================================
// Get Device
// ==========================================

const getDevice = async (req, res) => {
    const device =
        await deviceService.getDeviceById(
            req.params.id,
            req.user.companyId
        );

    return res.status(200).json({
        success: true,
        message: "Device fetched successfully",
        data: device,
    });
};

// ==========================================
// Get All Devices
// ==========================================

const getDevices = async (req, res) => {
    const devices =
        await deviceService.getAllDevices(
            req.user.companyId
        );

    return res.status(200).json({
        success: true,
        message: "Devices fetched successfully",
        data: devices,
    });
};

// ==========================================
// Create Device
// ==========================================
//
// The device service generates a random device secret,
// stores only its bcrypt hash, and returns the plain secret
// once as part of the creation response.
//
// The administrator must store the returned deviceSecret
// securely and configure the fingerprint device with it.
// ==========================================

const createDevice = async (req, res) => {
    const result =
        await deviceService.createDevice(
            req.body,
            req.user.companyId
        );

    return res.status(201).json({
        success: true,
        message:
            "Device created successfully. Store the device secret securely because it is returned only once.",
        data: result,
    });
};

// ==========================================
// Update Device
// ==========================================

const updateDevice = async (req, res) => {
    const device =
        await deviceService.updateDevice(
            req.params.id,
            req.body,
            req.user.companyId
        );

    return res.status(200).json({
        success: true,
        message: "Device updated successfully",
        data: device,
    });
};

// ==========================================
// Delete Device
// ==========================================

const deleteDevice = async (req, res) => {
    await deviceService.deleteDevice(
        req.params.id,
        req.user.companyId
    );

    return res.status(200).json({
        success: true,
        message: "Device deleted successfully",
    });
};

// ==========================================
// Set Wi-Fi Configuration
// ==========================================
//
// Admin operation.
//
// The request body should contain:
//
// {
//     primarySsid: "...",
//     primaryPassword: "...",
//     secondarySsid: "...",
//     secondaryPassword: "..."
// }
//
// The service encrypts the credentials before storing
// them in the database.
//
// The plaintext passwords are NOT returned in the response.
// ==========================================

const setWifiConfiguration = async (
    req,
    res
) => {
    const result =
        await deviceService.setWifiConfiguration(
            req.params.id,
            req.body,
            req.user.companyId
        );

    return res.status(200).json({
        success: true,
        message:
            "Wi-Fi configuration saved successfully and is pending device application",
        data: result,
    });
};

// ==========================================
// Get Wi-Fi Configuration Metadata
// ==========================================
//
// Admin operation.
//
// This endpoint returns only safe metadata:
//
// - configuration version
// - status
// - updated timestamp
// - acknowledgement timestamp
// - active network
// - last error
//
// It NEVER returns Wi-Fi passwords or encrypted
// Wi-Fi credential data.
// ==========================================

const getWifiConfiguration = async (
    req,
    res
) => {
    const result =
        await deviceService.getWifiConfigurationMetadata(
            req.params.id,
            req.user.companyId
        );

    return res.status(200).json({
        success: true,
        message:
            "Wi-Fi configuration status fetched successfully",
        data: result,
    });
};

// ==========================================
// Get Wi-Fi Configuration For ESP32
// ==========================================
//
// Device operation.
//
// The device must already be authenticated by
// deviceAuth.middleware.
//
// req.device is populated by the authentication
// middleware.
//
// Plaintext Wi-Fi credentials are returned only
// to the authenticated ESP32.
// ==========================================

const getWifiConfigurationForDevice =
    async (
        req,
        res
    ) => {
        const device =
            req.device;

        if (!device) {
            const error = new Error(
                "Authenticated device information is missing"
            );

            error.statusCode = 401;

            throw error;
        }

        const result =
            await deviceService.getWifiConfigurationForDevice(
                device.deviceId,
                device.deviceCode
            );

        return res.status(200).json({
            success: true,
            message:
                "Wi-Fi configuration fetched successfully",
            data: result,
        });
    };

// ==========================================
// Acknowledge Wi-Fi Configuration
// ==========================================
//
// Device operation.
//
// The ESP32 calls this endpoint after testing
// and applying the received configuration.
//
// Example:
//
// {
//     configVersion: 2,
//     success: true,
//     activeNetwork: "PRIMARY"
// }
//
// Or on failure:
//
// {
//     configVersion: 2,
//     success: false,
//     activeNetwork: "SECONDARY",
//     error: "Primary Wi-Fi connection failed"
// }
// ==========================================

const acknowledgeWifiConfiguration =
    async (
        req,
        res
    ) => {
        const device =
            req.device;

        if (!device) {
            const error = new Error(
                "Authenticated device information is missing"
            );

            error.statusCode = 401;

            throw error;
        }

        const result =
            await deviceService.acknowledgeWifiConfiguration(
                device.deviceId,
                device.deviceCode,
                req.body
            );

        return res.status(200).json({
            success: true,
            message:
                "Wi-Fi configuration acknowledgement recorded successfully",
            data: result,
        });
    };

// ==========================================
// Update Wi-Fi Runtime State
// ==========================================
//
// Device operation.
//
// ESP32 can report:
//
// {
//     activeNetwork: "PRIMARY",
//     lastError: null
// }
//
// or:
//
// {
//     activeNetwork: "SECONDARY",
//     lastError: "Primary Wi-Fi unavailable"
// }
//
// This does NOT modify stored Wi-Fi credentials.
// ==========================================

const updateWifiRuntimeState =
    async (
        req,
        res
    ) => {
        const device =
            req.device;

        if (!device) {
            const error = new Error(
                "Authenticated device information is missing"
            );

            error.statusCode = 401;

            throw error;
        }

        const result =
            await deviceService.updateWifiRuntimeState(
                device.deviceId,
                device.deviceCode,
                req.body
            );

        return res.status(200).json({
            success: true,
            message:
                "Wi-Fi runtime state updated successfully",
            data: result,
        });
    };

// ==========================================
// EXPORT
// ==========================================

module.exports = {
    // Existing device controllers
    getDevice,
    getDevices,
    createDevice,
    updateDevice,
    deleteDevice,

    // Admin Wi-Fi controllers
    setWifiConfiguration,
    getWifiConfiguration,

    // ESP32 Wi-Fi controllers
    getWifiConfigurationForDevice,
    acknowledgeWifiConfiguration,
    updateWifiRuntimeState,
};