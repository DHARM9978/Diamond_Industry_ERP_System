const prisma =
    require("../config/database");

const enrollmentLogStore =
    require("../utils/fingerprintEnrollmentLogStore");

const MAX_PENDING_ENROLLMENTS_PER_EMPLOYEE = 1;

// ==========================================
// Helpers
// ==========================================

const createError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const getNextAvailableSensorSlot = async (tx = prisma) => {
    const occupied =
        await tx.fingerprintTemplate.findMany({
            select: {
                sensorSlot: true
            },
            orderBy: {
                sensorSlot: "asc"
            }
        });

    const occupiedSlots =
        new Set(
            occupied.map(
                item => Number(item.sensorSlot)
            )
        );

    let slot = 1;

    while (occupiedSlots.has(slot)) {
        slot++;
    }

    return slot;
};

const getNextAvailableEnrollmentSlot = async (tx = prisma) => {
    const occupiedTemplates =
        await tx.fingerprintTemplate.findMany({
            select: {
                sensorSlot: true
            }
        });

    const occupiedJobs =
        await tx.fingerprintEnrollment.findMany({
            where: {
                status: {
                    in: [
                        "PENDING",
                        "IN_PROGRESS"
                    ]
                }
            },
            select: {
                sensorSlot: true
            }
        });

    const occupiedSlots =
        new Set([
            ...occupiedTemplates.map(
                item => Number(item.sensorSlot)
            ),
            ...occupiedJobs.map(
                item => Number(item.sensorSlot)
            )
        ]);

    let slot = 1;

    while (occupiedSlots.has(slot)) {
        slot++;
    }

    return slot;
};

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
        throw createError(
            "Fingerprint template not found",
            404
        );
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
// START ENROLLMENT
// Admin creates a queue entry.
// Sensor slot is AUTOMATIC.
// ==========================================

const startFingerprintEnrollment = async (
    data,
    companyId
) => {
    const employeeId =
        Number(data.employeeId);

    const fingerName =
        data.fingerName
            ? String(data.fingerName).trim()
            : null;

    if (!employeeId) {
        throw createError(
            "Employee ID is required",
            400
        );
    }

    const employee =
        await prisma.employee.findFirst({
            where: {
                employeeId,
                companyId: Number(companyId)
            }
        });

    if (!employee) {
        throw createError(
            "Employee not found in your company",
            404
        );
    }

    if (employee.status !== "ACTIVE") {
        throw createError(
            "Fingerprint cannot be enrolled for an inactive employee",
            400
        );
    }

    const existingFingerprint =
        await prisma.fingerprintTemplate.findFirst({
            where: {
                employeeId
            }
        });

    if (existingFingerprint) {
        throw createError(
            "This employee already has a fingerprint. Delete or replace the existing fingerprint before enrolling again.",
            409
        );
    }

    const existingPending =
        await prisma.fingerprintEnrollment.findFirst({
            where: {
                employeeId,
                status: {
                    in: [
                        "PENDING",
                        "IN_PROGRESS"
                    ]
                }
            }
        });

    if (existingPending) {
        throw createError(
            "This employee already has a fingerprint enrollment in progress",
            409
        );
    }

    const enrollment =
        await prisma.$transaction(
            async (tx) => {
                const sensorSlot =
                    await getNextAvailableEnrollmentSlot(
                        tx
                    );

                return await tx.fingerprintEnrollment.create({
                    data: {
                        employeeId,
                        sensorSlot,
                        fingerName,
                        status: "PENDING"
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
            },
            {
                isolationLevel: "Serializable"
            }
        );

    enrollmentLogStore.initialize(
        enrollment.enrollmentId,
        "Enrollment request created. Waiting for the fingerprint machine..."
    );

    return enrollment;
};

// ==========================================
// Get Enrollment Status
// Admin frontend polls this endpoint while the ESP32
// performs the physical enrollment.
// ==========================================

const getEnrollmentStatus = async (
    enrollmentId,
    companyId
) => {
    const id = Number(enrollmentId);

    if (!id) {
        throw createError(
            "Valid enrollment ID is required",
            400
        );
    }

    const enrollment =
        await prisma.fingerprintEnrollment.findFirst({
            where: {
                enrollmentId: id,
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
                        email: true
                    }
                }
            }
        });

    if (!enrollment) {
        throw createError(
            "Fingerprint enrollment request not found",
            404
        );
    }

    return {
        enrollmentId: enrollment.enrollmentId,
        employeeId: enrollment.employeeId,
        sensorSlot: enrollment.sensorSlot,
        fingerName: enrollment.fingerName,
        status: enrollment.status,
        confidence: enrollment.confidence,
        errorMessage: enrollment.errorMessage,
        completedAt: enrollment.completedAt,
        createdAt: enrollment.createdAt,
        updatedAt: enrollment.updatedAt,
        employee: enrollment.employee,
        logs: enrollmentLogStore.get(enrollment.enrollmentId)
    };
};

// ==========================================
// DEVICE: Append enrollment progress log
// ==========================================

const appendEnrollmentLog = async (
    data,
    companyId
) => {
    const enrollmentId = Number(data.enrollmentId);
    const message = data.message
        ? String(data.message).trim()
        : "";

    if (!enrollmentId) {
        throw createError(
            "Enrollment ID is required",
            400
        );
    }

    if (!message) {
        throw createError(
            "Enrollment log message is required",
            400
        );
    }

    const enrollment =
        await prisma.fingerprintEnrollment.findFirst({
            where: {
                enrollmentId,
                employee: {
                    companyId: Number(companyId)
                }
            },
            select: {
                enrollmentId: true,
                status: true
            }
        });

    if (!enrollment) {
        throw createError(
            "Fingerprint enrollment request not found",
            404
        );
    }

    enrollmentLogStore.append(
        enrollmentId,
        message
    );

    return {
        enrollmentId,
        status: enrollment.status,
        message
    };
};

// ==========================================
// DEVICE: Get Pending Enrollment
//
// IMPORTANT:
// Claim the job by changing PENDING -> IN_PROGRESS
// so repeated ESP32 polling does not return the
// same job.
// ==========================================

const getPendingEnrollment = async (
    companyId
) => {
    return await prisma.$transaction(
        async (tx) => {
            const job =
                await tx.fingerprintEnrollment.findFirst({
                    where: {
                        status: "PENDING",
                        employee: {
                            companyId: Number(companyId)
                        }
                    },
                    orderBy: {
                        enrollmentId: "asc"
                    }
                });

            if (!job) {
                return null;
            }

            const updated =
                await tx.fingerprintEnrollment.update({
                    where: {
                        enrollmentId:
                            job.enrollmentId
                    },
                    data: {
                        status: "IN_PROGRESS"
                    }
                });

            return {
                enrollmentId:
                    updated.enrollmentId,
                employeeId:
                    updated.employeeId,
                sensorSlot:
                    updated.sensorSlot,
                fingerName:
                    updated.fingerName
            };
        }
    );
};

// ==========================================
// DEVICE: Report Result
// ==========================================

const reportEnrollmentResult = async (
    data,
    companyId
) => {
    const enrollmentId =
        Number(data.enrollmentId);

    const employeeId =
        Number(data.employeeId);

    const sensorSlot =
        Number(data.sensorSlot);

    const success =
        data.success === true ||
        data.success === "true";

    const confidence =
        data.confidence === undefined ||
        data.confidence === null
            ? null
            : Number(data.confidence);

    const errorMessage =
        data.error
            ? String(data.error)
            : null;

    if (!enrollmentId) {
        throw createError(
            "Enrollment ID is required",
            400
        );
    }

    if (!employeeId) {
        throw createError(
            "Employee ID is required",
            400
        );
    }

    if (!sensorSlot || sensorSlot < 1) {
        throw createError(
            "Valid sensor slot is required",
            400
        );
    }

    return await prisma.$transaction(
        async (tx) => {
            const enrollment =
                await tx.fingerprintEnrollment.findUnique({
                    where: {
                        enrollmentId
                    }
                });

            if (!enrollment) {
                throw createError(
                    "Fingerprint enrollment request not found",
                    404
                );
            }

            const employee =
                await tx.employee.findFirst({
                    where: {
                        employeeId:
                            enrollment.employeeId,
                        companyId:
                            Number(companyId)
                    }
                });

            if (!employee) {
                throw createError(
                    "Enrollment does not belong to this device company",
                    403
                );
            }

            if (
                enrollment.employeeId !==
                    employeeId ||
                enrollment.sensorSlot !==
                    sensorSlot
            ) {
                throw createError(
                    "Enrollment result does not match the assigned employee or sensor slot",
                    409
                );
            }

            if (
                enrollment.status ===
                    "COMPLETED"
            ) {
                const existing =
                    await tx.fingerprintTemplate.findFirst({
                        where: {
                            employeeId,
                            sensorSlot
                        }
                    });

                return existing || enrollment;
            }

            if (
                enrollment.status ===
                    "FAILED"
            ) {
                throw createError(
                    "This enrollment request has already failed",
                    409
                );
            }

            if (!success) {
                return await tx.fingerprintEnrollment.update({
                    where: {
                        enrollmentId
                    },
                    data: {
                        status: "FAILED",
                        errorMessage,
                        confidence,
                        completedAt:
                            new Date()
                    }
                });
            }

            const existingSlot =
                await tx.fingerprintTemplate.findUnique({
                    where: {
                        sensorSlot
                    }
                });

            if (existingSlot) {
                throw createError(
                    "The assigned sensor slot is already occupied in the database",
                    409
                );
            }

            const fingerprint =
                await tx.fingerprintTemplate.create({
                    data: {
                        employeeId,
                        sensorSlot,
                        fingerName:
                            enrollment.fingerName ||
                            null,
                        status: "ACTIVE",
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

            await tx.fingerprintEnrollment.update({
                where: {
                    enrollmentId
                },
                data: {
                    status: "COMPLETED",
                    confidence,
                    completedAt:
                        new Date(),
                    errorMessage: null
                }
            });

            enrollmentLogStore.append(
                enrollmentId,
                `Fingerprint enrollment completed successfully. Sensor slot ${sensorSlot} is now active.`
            );

            return fingerprint;
        }
    );
};

// ==========================================
// Legacy Direct Enrollment
//
// Kept so existing code does not break.
// New admin workflow should use
// startFingerprintEnrollment().
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

    if (!employeeId) {
        throw createError(
            "Employee ID is required",
            400
        );
    }

    if (
        sensorSlot === undefined ||
        sensorSlot === null
    ) {
        throw createError(
            "Sensor slot is required",
            400
        );
    }

    if (Number(sensorSlot) < 1) {
        throw createError(
            "Sensor slot must be greater than 0",
            400
        );
    }

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
        throw createError(
            "Employee not found in your company",
            404
        );
    }

    const existingSlot =
        await prisma.fingerprintTemplate.findUnique({
            where: {
                sensorSlot:
                    Number(sensorSlot)
            }
        });

    if (existingSlot) {
        throw createError(
            "This sensor slot is already assigned",
            409
        );
    }

    const fingerprint =
        await prisma.fingerprintTemplate.create({
            data: {
                employeeId:
                    Number(employeeId),
                sensorSlot:
                    Number(sensorSlot),
                fingerName:
                    fingerName || null,
                status: "ACTIVE",
                enrolledAt: new Date()
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
        throw createError(
            "Fingerprint template not found",
            404
        );
    }

    const {
        fingerName,
        status
    } = data;

    if (
        status !== undefined &&
        !["ACTIVE", "INACTIVE"].includes(
            status
        )
    ) {
        throw createError(
            "Status must be ACTIVE or INACTIVE",
            400
        );
    }

    return await prisma.fingerprintTemplate.update({
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
        throw createError(
            "Fingerprint template not found",
            404
        );
    }

    await prisma.fingerprintTemplate.delete({
        where: {
            templateId:
                Number(templateId)
        }
    });

    return true;
};

// ==========================================
// Legacy device enrollment
// ==========================================

const enrollFingerprintFromDevice = async (
    data,
    companyId
) => {
    return await enrollFingerprint(
        data,
        companyId
    );
};

module.exports = {
    getFingerprintById,
    getAllFingerprints,
    startFingerprintEnrollment,
    getEnrollmentStatus,
    appendEnrollmentLog,
    getPendingEnrollment,
    reportEnrollmentResult,
    enrollFingerprint,
    updateFingerprint,
    deleteFingerprint,
    enrollFingerprintFromDevice
};
