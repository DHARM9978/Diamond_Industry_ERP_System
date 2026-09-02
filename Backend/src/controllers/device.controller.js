const deviceService = require("../services/device.service");


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

const createDevice = async (req, res) => {

    const device = await deviceService.createDevice(
        req.body,
        req.user.companyId
    );

    return res.status(201).json({
        success: true,
        message: "Device created successfully",
        data: device
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


module.exports = {
    getDevice,
    getDevices,
    createDevice,
    updateDevice,
    deleteDevice
};