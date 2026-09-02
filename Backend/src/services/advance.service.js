const prisma = require("../config/database");


// ==========================================
// Create Advance Payment
// POST /api/advances
// ==========================================

const createAdvance = async (data, companyId) => {

    const {
        employeeId,
        amount,
        reason,
        paymentDate
    } = data;

    // ==========================================
    // Verify employee belongs to company
    // ==========================================

    const employee =
        await prisma.employee.findFirst({
            where: {
                employeeId: Number(employeeId),
                companyId: Number(companyId)
            }
        });

    if (!employee) {

        const error =
            new Error("Employee not found");

        error.statusCode = 404;

        throw error;
    }

    // ==========================================
    // Only active employees can receive advances
    // ==========================================

    if (employee.status !== "ACTIVE") {

        const error =
            new Error(
                "Cannot create advance for inactive employee"
            );

        error.statusCode = 400;

        throw error;
    }

    // ==========================================
    // Create advance
    // ==========================================

    const advance =
        await prisma.advancePayment.create({

            data: {

                employeeId:
                    Number(employeeId),

                amount,

                reason:
                    reason || null,

                paymentDate:
                    new Date(paymentDate),

                // New advance starts as PENDING
                status:
                    "PENDING"
            },

            include: {

                employee: {
                    select: {
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        status: true
                    }
                }
            }
        });

    return advance;
};


// ==========================================
// Get All Advances
// GET /api/advances
// ==========================================

const getAllAdvances = async (companyId) => {

    const advances =
        await prisma.advancePayment.findMany({

            where: {

                employee: {
                    companyId:
                        Number(companyId)
                }
            },

            include: {

                employee: {
                    select: {
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        status: true
                    }
                },

                // Advance is approved by an Admin
                approver: {
                    select: {
                        adminId: true,
                        adminName: true,
                        email: true,
                        phone: true
                    }
                }
            },

            orderBy: {
                paymentDate: "desc"
            }
        });

    return advances;
};


// ==========================================
// Get Advance By ID
// GET /api/advances/:id
// ==========================================

const getAdvanceById = async (
    advanceId,
    companyId
) => {

    const advance =
        await prisma.advancePayment.findFirst({

            where: {

                advanceId:
                    Number(advanceId),

                employee: {
                    companyId:
                        Number(companyId)
                }
            },

            include: {

                employee: {
                    select: {
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        status: true
                    }
                },

                // Advance is approved by an Admin
                approver: {
                    select: {
                        adminId: true,
                        adminName: true,
                        email: true,
                        phone: true
                    }
                }
            }
        });

    if (!advance) {

        const error =
            new Error(
                "Advance payment not found"
            );

        error.statusCode = 404;

        throw error;
    }

    return advance;
};


// ==========================================
// Get Employee Advances
// GET /api/advances/employee/:employeeId
// ==========================================

const getEmployeeAdvances = async (
    employeeId,
    companyId
) => {

    const advances =
        await prisma.advancePayment.findMany({

            where: {

                employeeId:
                    Number(employeeId),

                employee: {
                    companyId:
                        Number(companyId)
                }
            },

            include: {

                approver: {
                    select: {
                        adminId: true,
                        adminName: true,
                        email: true,
                        phone: true
                    }
                }
            },

            orderBy: {
                paymentDate: "desc"
            }
        });

    return advances;
};


// ==========================================
// Update Advance Status
// PATCH /api/advances/:id/status
// ==========================================

const updateAdvanceStatus = async (
    advanceId,
    status,
    adminId,
    companyId
) => {

    // ==========================================
    // Valid statuses
    // ==========================================

    const validStatuses = [
        "PENDING",
        "APPROVED",
        "REJECTED"
    ];

    if (!validStatuses.includes(status)) {

        const error =
            new Error(
                "Invalid advance status"
            );

        error.statusCode = 400;

        throw error;
    }

    // ==========================================
    // Verify advance belongs to company
    // ==========================================

    const advance =
        await prisma.advancePayment.findFirst({

            where: {

                advanceId:
                    Number(advanceId),

                employee: {
                    companyId:
                        Number(companyId)
                }
            }
        });

    if (!advance) {

        const error =
            new Error(
                "Advance payment not found"
            );

        error.statusCode = 404;

        throw error;
    }

    // ==========================================
    // Update advance status
    // ==========================================

    const updatedAdvance =
        await prisma.advancePayment.update({

            where: {
                advanceId:
                    Number(advanceId)
            },

            data: {

                status,

                // Store Admin ID only when approved
                approvedBy:
                    status === "APPROVED"
                        ? Number(adminId)
                        : null
            },

            include: {

                employee: {
                    select: {
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        status: true
                    }
                },

                approver: {
                    select: {
                        adminId: true,
                        adminName: true,
                        email: true,
                        phone: true
                    }
                }
            }
        });

    return updatedAdvance;
};


// ==========================================
// Delete Advance
// DELETE /api/advances/:id
// ==========================================

const deleteAdvance = async (
    advanceId,
    companyId
) => {

    const advance =
        await prisma.advancePayment.findFirst({

            where: {

                advanceId:
                    Number(advanceId),

                employee: {
                    companyId:
                        Number(companyId)
                }
            }
        });

    if (!advance) {

        const error =
            new Error(
                "Advance payment not found"
            );

        error.statusCode = 404;

        throw error;
    }

    await prisma.advancePayment.delete({

        where: {
            advanceId:
                Number(advanceId)
        }
    });
};


// ==========================================
// Get My Advances
// Employee Self-Service
// GET /api/me/advances
// ==========================================

const getMyAdvances = async (
    employeeId,
    companyId
) => {

    const advances =
        await prisma.advancePayment.findMany({

            where: {

                employeeId:
                    Number(employeeId),

                employee: {
                    companyId:
                        Number(companyId)
                }
            },

            include: {

                approver: {
                    select: {
                        adminId: true,
                        adminName: true,
                        email: true,
                        phone: true
                    }
                }
            },

            orderBy: {
                paymentDate: "desc"
            }
        });

    return advances;
};


// ==========================================
// Create My Advance
// Employee Self-Service
// POST /api/me/advances
// ==========================================

const createMyAdvance = async (
    data,
    employeeId,
    companyId
) => {

    const {
        amount,
        reason,
        paymentDate
    } = data;

    // ==========================================
    // Verify logged-in employee
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

        const error =
            new Error(
                "Employee not found"
            );

        error.statusCode = 404;

        throw error;
    }

    // ==========================================
    // Only active employees can request advances
    // ==========================================

    if (employee.status !== "ACTIVE") {

        const error =
            new Error(
                "Cannot request advance as inactive employee"
            );

        error.statusCode = 400;

        throw error;
    }

    // ==========================================
    // Validate amount
    // ==========================================

    if (
        amount === undefined ||
        amount === null ||
        Number(amount) <= 0
    ) {

        const error =
            new Error(
                "Advance amount must be greater than 0"
            );

        error.statusCode = 400;

        throw error;
    }

    // ==========================================
    // Validate payment date
    // ==========================================

    if (!paymentDate) {

        const error =
            new Error(
                "Payment date is required"
            );

        error.statusCode = 400;

        throw error;
    }

    const parsedPaymentDate =
        new Date(paymentDate);

    if (
        Number.isNaN(
            parsedPaymentDate.getTime()
        )
    ) {

        const error =
            new Error(
                "Invalid payment date"
            );

        error.statusCode = 400;

        throw error;
    }

    // ==========================================
    // Create employee advance request
    // ==========================================

    const advance =
        await prisma.advancePayment.create({

            data: {

                employeeId:
                    Number(employeeId),

                amount:
                    Number(amount),

                reason:
                    reason || null,

                paymentDate:
                    parsedPaymentDate,

                // Employee requests always start as PENDING
                status:
                    "PENDING"
            },

            include: {

                employee: {
                    select: {
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        status: true
                    }
                }
            }
        });

    return advance;
};


// ==========================================
// Export Services
// ==========================================

module.exports = {

    // Admin advance operations
    createAdvance,
    getAllAdvances,
    getAdvanceById,
    getEmployeeAdvances,
    updateAdvanceStatus,
    deleteAdvance,

    // Employee self-service advance operations
    getMyAdvances,
    createMyAdvance
};