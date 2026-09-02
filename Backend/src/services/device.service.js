const prisma = require("../config/database");


// ==========================================
// Get Device By ID
// ==========================================

const getDeviceById = async (deviceId, companyId) => {

    const device = await prisma.iotDevice.findFirst({
        where: {
            deviceId: Number(deviceId),
            companyId: Number(companyId)
        },
        include: {
            branch: true
        }
    });

    if (!device) {
        const error = new Error("Device not found");
        error.statusCode = 404;
        throw error;
    }

    return device;
};


// ==========================================
// Get All Devices
// ==========================================

const getAllDevices = async (companyId) => {

    return await prisma.iotDevice.findMany({
        where: {
            companyId: Number(companyId)
        },
        include: {
            branch: true
        },
        orderBy: {
            deviceId: "asc"
        }
    });
};


// ==========================================
// Create Device
// ==========================================

const createDevice = async (data, companyId) => {

    const {
        deviceCode,
        deviceName,
        location,
        branchId
    } = data;


    // ======================================
    // Required fields
    // ======================================

    if (!deviceCode) {
        const error = new Error("Device code is required");
        error.statusCode = 400;
        throw error;
    }

    if (!deviceName) {
        const error = new Error("Device name is required");
        error.statusCode = 400;
        throw error;
    }

    if (!branchId) {
        const error = new Error("Branch ID is required");
        error.statusCode = 400;
        throw error;
    }


    // ======================================
    // Verify branch belongs to company
    // ======================================

    const branch = await prisma.branch.findFirst({
        where: {
            branchId: Number(branchId),
            companyId: Number(companyId)
        }
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
                deviceCode
            }
        });

    if (existingDevice) {
        const error = new Error(
            "Device code already exists"
        );

        error.statusCode = 409;
        throw error;
    }


    // ======================================
    // Create device
    // ======================================

    const device = await prisma.iotDevice.create({
        data: {
            deviceCode,
            deviceName,
            location: location || null,
            companyId: Number(companyId),
            branchId: Number(branchId),
            status: "ACTIVE"
        },
        include: {
            branch: true
        }
    });

    return device;
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


    // ======================================
    // Find existing device
    // ======================================

    const existingDevice =
        await prisma.iotDevice.findFirst({
            where: {
                deviceId: id,
                companyId: company
            }
        });

    if (!existingDevice) {
        const error = new Error("Device not found");
        error.statusCode = 404;
        throw error;
    }


    const {
        deviceName,
        location,
        branchId,
        status
    } = data;


    // ======================================
    // Verify new branch
    // ======================================

    if (branchId !== undefined) {

        const branch = await prisma.branch.findFirst({
            where: {
                branchId: Number(branchId),
                companyId: company
            }
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
    // Update device
    // ======================================

    const device = await prisma.iotDevice.update({
        where: {
            deviceId: id
        },

        data: {

            ...(deviceName !== undefined && {
                deviceName
            }),

            ...(location !== undefined && {
                location
            }),

            ...(branchId !== undefined && {
                branchId: Number(branchId)
            }),

            ...(status !== undefined && {
                status
            })
        },

        include: {
            branch: true
        }
    });

    return device;
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
                companyId: company
            }
        });

    if (!existingDevice) {
        const error = new Error("Device not found");
        error.statusCode = 404;
        throw error;
    }


    // ======================================
    // Delete device
    // ======================================

    await prisma.iotDevice.delete({
        where: {
            deviceId: id
        }
    });

    return true;
};


module.exports = {
    getDeviceById,
    getAllDevices,
    createDevice,
    updateDevice,
    deleteDevice
};