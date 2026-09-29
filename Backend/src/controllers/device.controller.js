const deviceService =
    require("../services/device.service");


// ==========================================
// Get Device
// ==========================================

const getDevice = async (req, res) => {

    const device = await deviceService.getDeviceById(
        req.params.id,
        req.user.companyId
    );

    return res.status(200).json({
        success: true,
        message: "Device fetched successfully",
        data: device
    });
};


// ==========================================
// Get All Devices
// ==========================================

const getDevices = async (req, res) => {

    const devices = await deviceService.getAllDevices(
        req.user.companyId
    );

    return res.status(200).json({
        success: true,
        message: "Devices fetched successfully",
        data: devices
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

    const result = await deviceService.createDevice(
        req.body,
        req.user.companyId
    );

    return res.status(201).json({
        success: true,
        message:
            "Device created successfully. Store the device secret securely because it is returned only once.",
        data: result
    });
};


// ==========================================
// Update Device
// ==========================================

const updateDevice = async (req, res) => {

    const device = await deviceService.updateDevice(
        req.params.id,
        req.body,
        req.user.companyId
    );

    return res.status(200).json({
        success: true,
        message: "Device updated successfully",
        data: device
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
        message: "Device deleted successfully"
    });
};


// ==========================================
// EXPORT
// ==========================================

module.exports = {
    getDevice,
    getDevices,
    createDevice,
    updateDevice,
    deleteDevice
};