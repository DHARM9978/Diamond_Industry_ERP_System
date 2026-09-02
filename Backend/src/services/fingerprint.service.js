const prisma = require("../config/database");


// ==========================================
// Get Fingerprint By ID
// ==========================================

const getFingerprintById = async (
    templateId,
    companyId
) => {

    const fingerprint =
        await prisma.fingerprintTemplate.findFirst({

            where: {
                templateId: Number(templateId),

                employee: {
                    companyId: Number(companyId)
                }
            },

            include: {
                employee: {
                    select: {
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        companyId: true,
                        branchId: true,
                        departmentId: true
                    }
                }
            }
        });


    if (!fingerprint) {

        const error = new Error(
            "Fingerprint template not found"
        );

        error.statusCode = 404;

        throw error;
    }


    return fingerprint;
};


// ==========================================
// Get All Fingerprints
// ==========================================

const getAllFingerprints = async (
    companyId
) => {

    return await prisma.fingerprintTemplate.findMany({

        where: {
            employee: {
                companyId: Number(companyId)
            }
        },

        include: {
            employee: {
                select: {
                    employeeId: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    companyId: true,
                    branchId: true,
                    departmentId: true
                }
            }
        },

        orderBy: {
            templateId: "asc"
        }
    });
};


// ==========================================
// Enroll Fingerprint
// ==========================================

const enrollFingerprint = async (
    data,
    companyId
) => {

    const {
        employeeId,
        sensorSlot,
        fingerName
    } = data;


    // ======================================
    // Required fields
    // ======================================

    if (!employeeId) {

        const error = new Error(
            "Employee ID is required"
        );

        error.statusCode = 400;

        throw error;
    }


    if (
        sensorSlot === undefined ||
        sensorSlot === null
    ) {

        const error = new Error(
            "Sensor slot is required"
        );

        error.statusCode = 400;

        throw error;
    }


    // ======================================
    // Validate sensor slot
    // ======================================

    if (Number(sensorSlot) < 1) {

        const error = new Error(
            "Sensor slot must be greater than 0"
        );

        error.statusCode = 400;

        throw error;
    }


    // ======================================
    // Verify employee
    // ======================================

    const employee =
        await prisma.employee.findFirst({

            where: {
                employeeId: Number(employeeId),
                companyId: Number(companyId)
            }
        });


    if (!employee) {

        const error = new Error(
            "Employee not found in your company"
        );

        error.statusCode = 404;

        throw error;
    }


    // ======================================
    // Check sensor slot
    // ======================================

    const existingSlot =
        await prisma.fingerprintTemplate.findFirst({

            where: {
                sensorSlot: Number(sensorSlot)
            }
        });


    if (existingSlot) {

        const error = new Error(
            "This sensor slot is already assigned"
        );

        error.statusCode = 409;

        throw error;
    }


    // ======================================
    // Create fingerprint template
    // ======================================

    const fingerprint =
        await prisma.fingerprintTemplate.create({

            data: {

                employeeId:
                    Number(employeeId),

                sensorSlot:
                    Number(sensorSlot),

                fingerName:
                    fingerName || null,

                status:
                    "ACTIVE",

                enrolledAt:
                    new Date()
            },

            include: {

                employee: {
                    select: {
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });


    return fingerprint;
};

// ==========================================
// Update Fingerprint
// ==========================================

const updateFingerprint = async (
    templateId,
    data,
    companyId
) => {

    const id = Number(templateId);
    const company = Number(companyId);


    // ======================================
    // Find fingerprint
    // ======================================

    const existingFingerprint =
        await prisma.fingerprintTemplate.findFirst({

            where: {
                templateId: id,

                employee: {
                    companyId: company
                }
            }
        });


    if (!existingFingerprint) {

        const error = new Error(
            "Fingerprint template not found"
        );

        error.statusCode = 404;

        throw error;
    }


    const {
        fingerName,
        status
    } = data;


    // ======================================
    // Validate status
    // ======================================

    if (
        status !== undefined &&
        !["ACTIVE", "INACTIVE"].includes(status)
    ) {

        const error = new Error(
            "Status must be ACTIVE or INACTIVE"
        );

        error.statusCode = 400;

        throw error;
    }


    // ======================================
    // Update fingerprint
    // ======================================

    const fingerprint =
        await prisma.fingerprintTemplate.update({

            where: {
                templateId: id
            },

            data: {

                ...(fingerName !== undefined && {
                    fingerName
                }),

                ...(status !== undefined && {
                    status
                })
            },

            include: {

                employee: {
                    select: {
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });


    return fingerprint;
};



// ==========================================
// Delete Fingerprint
// ==========================================

const deleteFingerprint = async (
    templateId,
    companyId
) => {

    const fingerprint =
        await prisma.fingerprintTemplate.findFirst({

            where: {
                templateId: Number(templateId),

                employee: {
                    companyId: Number(companyId)
                }
            }
        });


    if (!fingerprint) {

        const error = new Error(
            "Fingerprint template not found"
        );

        error.statusCode = 404;

        throw error;
    }


    await prisma.fingerprintTemplate.delete({

        where: {
            templateId: Number(templateId)
        }
    });


    return true;
};

const enrollFingerprintFromDevice = async (
    data,
    companyId
) => {

    const {
        employeeId,
        sensorSlot,
        fingerName
    } = data;


    // ==========================================
    // Validate Employee ID
    // ==========================================

    if (!employeeId) {

        const error = new Error(
            "Employee ID is required"
        );

        error.statusCode = 400;

        throw error;
    }


    // ==========================================
    // Validate Sensor Slot
    // ==========================================

    if (
        sensorSlot === undefined ||
        sensorSlot === null
    ) {

        const error = new Error(
            "Sensor slot is required"
        );

        error.statusCode = 400;

        throw error;
    }


    if (
        Number(sensorSlot) < 1
    ) {

        const error = new Error(
            "Sensor slot must be greater than 0"
        );

        error.statusCode = 400;

        throw error;
    }


    // ==========================================
    // Verify Employee
    // ==========================================

    const employee =
        await prisma.employee.findFirst({

            where: {

                employeeId:
                    Number(employeeId),

                companyId:
                    Number(companyId)
            }
        });


    if (!employee) {

        const error = new Error(
            "Employee not found in device company"
        );

        error.statusCode = 404;

        throw error;
    }


    // ==========================================
    // Check Sensor Slot
    // ==========================================

    const existingSlot =
        await prisma.fingerprintTemplate.findFirst({

            where: {

                sensorSlot:
                    Number(sensorSlot)
            }
        });


    if (existingSlot) {

        const error = new Error(
            "This sensor slot is already assigned"
        );

        error.statusCode = 409;

        throw error;
    }


    // ==========================================
    // Create Fingerprint Template
    // ==========================================

    const fingerprint =
        await prisma.fingerprintTemplate.create({

            data: {

                employeeId:
                    Number(employeeId),

                sensorSlot:
                    Number(sensorSlot),

                fingerName:
                    fingerName || null,

                status:
                    "ACTIVE",

                enrolledAt:
                    new Date()
            },

            include: {

                employee: {

                    select: {

                        employeeId: true,

                        firstName: true,

                        lastName: true,

                        email: true
                    }
                }
            }
        });


    return fingerprint;
};




module.exports = {

    getFingerprintById,

    getAllFingerprints,

    enrollFingerprint,
    
    updateFingerprint,

    deleteFingerprint,

    enrollFingerprintFromDevice
};