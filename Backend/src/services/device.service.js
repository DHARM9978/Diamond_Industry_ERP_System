const crypto = require("crypto");
const bcrypt = require("bcrypt");
const prisma = require("../config/database");


// ==========================================
// DEVICE RESPONSE HELPERS
// ==========================================

// Never expose the stored device-secret hash to the admin UI.
const sanitizeDevice = (device) => {

    if (!device) {
        return device;
    }

    const {
        deviceSecretHash,
        ...safeDevice
    } = device;

    return safeDevice;
};


// Generate a strong random secret for a new ESP32 device.
// The plain secret is returned only once to the caller.
const generateDeviceSecret = () => {

    return crypto.randomBytes(32).toString("hex");
};


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

    return sanitizeDevice(device);
};


// ==========================================
// Get All Devices
// ==========================================

const getAllDevices = async (companyId) => {

    const devices = await prisma.iotDevice.findMany({
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

    return devices.map(sanitizeDevice);
};


// ==========================================
// Create Device
// ==========================================

const createDevice = async (data, companyId) => {

    const {
        deviceCode,
        deviceName,
        location,
        branchId,
        status
    } = data;

    const normalizedDeviceCode =
        String(deviceCode || "").trim();

    const normalizedDeviceName =
        String(deviceName || "").trim();

    const normalizedLocation =
        location === undefined || location === null
            ? null
            : String(location).trim() || null;


    // ======================================
    // Required fields
    // ======================================

    if (!normalizedDeviceCode) {
        const error = new Error("Device code is required");
        error.statusCode = 400;
        throw error;
    }

    if (!normalizedDeviceName) {
        const error = new Error("Device name is required");
        error.statusCode = 400;
        throw error;
    }

    if (!branchId) {
        const error = new Error("Branch ID is required");
        error.statusCode = 400;
        throw error;
    }

    validateDeviceStatus(status);


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
                deviceCode: normalizedDeviceCode
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

    const device = await prisma.iotDevice.create({
        data: {
            deviceCode: normalizedDeviceCode,
            deviceName: normalizedDeviceName,
            location: normalizedLocation,
            companyId: Number(companyId),
            branchId: Number(branchId),
            status: status || "ACTIVE",
            deviceSecretHash
        },
        include: {
            branch: true
        }
    });

    return {
        device: sanitizeDevice(device),
        deviceSecret
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

    if (!Number.isInteger(id) || id < 1) {
        const error = new Error("Invalid device ID");
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

    validateDeviceStatus(status);


    // ======================================
    // Verify new branch
    // ======================================

    if (branchId !== undefined) {

        const numericBranchId = Number(branchId);

        if (
            !Number.isInteger(numericBranchId) ||
            numericBranchId < 1
        ) {
            const error = new Error(
                "A valid branch is required"
            );

            error.statusCode = 400;
            throw error;
        }

        const branch = await prisma.branch.findFirst({
            where: {
                branchId: numericBranchId,
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
    // Validate text fields
    // ======================================

    const normalizedDeviceName =
        deviceName === undefined
            ? undefined
            : String(deviceName).trim();

    const normalizedLocation =
        location === undefined
            ? undefined
            : String(location).trim() || null;

    if (
        normalizedDeviceName !== undefined &&
        !normalizedDeviceName
    ) {
        const error = new Error("Device name is required");
        error.statusCode = 400;
        throw error;
    }


    // ======================================
    // Update device
    // ======================================

    const device = await prisma.iotDevice.update({
        where: {
            deviceId: id
        },

        data: {

            ...(normalizedDeviceName !== undefined && {
                deviceName: normalizedDeviceName
            }),

            ...(normalizedLocation !== undefined && {
                location: normalizedLocation
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