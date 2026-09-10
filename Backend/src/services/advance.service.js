const prisma = require("../config/database");

// ==========================================
// Create Advance Payment
// POST /api/advances
// Admin creates advance on behalf of employee
// ==========================================

const createAdvance = async (data, companyId) => {
    const {
        employeeId,
        amount,
        reason,
        paymentDate
    } = data || {};

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
            new Error("Payment date is required");

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
            new Error("Invalid payment date");

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

                // Original amount requested
                amount:
                    Number(amount),

                // No approval/payment yet
                approvedAmount:
                    null,

                paidAmount:
                    null,

                reason:
                    reason || null,

                paymentDate:
                    parsedPaymentDate,

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
//
// PATCH /api/advances/:id/status
//
// Supported workflow:
//
// PENDING  -> APPROVED
// PENDING  -> REJECTED
// APPROVED -> PAID
//
// APPROVED can receive approvedAmount
// PAID can receive paidAmount
//
// Once PAID, no further changes are allowed.
// ==========================================

const updateAdvanceStatus = async (
    advanceId,
    status,
    adminId,
    companyId,
    data = {}
) => {

    const normalizedStatus =
        String(status || "")
            .trim()
            .toUpperCase();

    const {
        approvedAmount,
        paidAmount
    } = data || {};

    // ==========================================
    // Valid statuses
    // ==========================================

    const validStatuses = [
        "PENDING",
        "APPROVED",
        "REJECTED",
        "PAID"
    ];

    if (
        !validStatuses.includes(
            normalizedStatus
        )
    ) {
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
    // PAID records are permanently locked
    // ==========================================

    if (advance.status === "PAID") {
        const error =
            new Error(
                "Paid advance cannot be modified"
            );

        error.statusCode = 400;
        throw error;
    }

    // ==========================================
    // Prevent changing rejected advances
    // ==========================================

    if (
        advance.status === "REJECTED" &&
        normalizedStatus !== "REJECTED"
    ) {
        const error =
            new Error(
                "Rejected advance cannot be modified"
            );

        error.statusCode = 400;
        throw error;
    }

    // ==========================================
    // Prevent invalid workflow transitions
    // ==========================================

    if (
        normalizedStatus === "APPROVED" &&
        advance.status !== "PENDING" &&
        advance.status !== "APPROVED"
    ) {
        const error =
            new Error(
                "Only pending or already approved advances can be approved"
            );

        error.statusCode = 400;
        throw error;
    }

    if (
        normalizedStatus === "PAID" &&
        advance.status !== "APPROVED"
    ) {
        const error =
            new Error(
                "Only approved advances can be marked as paid"
            );

        error.statusCode = 400;
        throw error;
    }

    if (
        normalizedStatus === "PENDING" &&
        advance.status !== "PENDING"
    ) {
        const error =
            new Error(
                "Advance cannot be moved back to pending"
            );

        error.statusCode = 400;
        throw error;
    }

    // ==========================================
    // APPROVE
    // ==========================================

    if (normalizedStatus === "APPROVED") {

        let finalApprovedAmount;

        // Admin supplied approvedAmount
        if (
            approvedAmount !== undefined &&
            approvedAmount !== null &&
            approvedAmount !== ""
        ) {
            finalApprovedAmount =
                Number(approvedAmount);
        }
        // Existing approved amount
        else if (
            advance.approvedAmount !== null &&
            advance.approvedAmount !== undefined
        ) {
            finalApprovedAmount =
                Number(
                    advance.approvedAmount
                );
        }
        // Default approval = requested amount
        else {
            finalApprovedAmount =
                Number(advance.amount);
        }

        // ==========================================
        // Validate approved amount
        // ==========================================

        if (
            !Number.isFinite(
                finalApprovedAmount
            ) ||
            finalApprovedAmount <= 0
        ) {
            const error =
                new Error(
                    "Approved amount must be greater than 0"
                );

            error.statusCode = 400;
            throw error;
        }

        // ==========================================
        // Cannot approve more than requested
        // ==========================================

        if (
            finalApprovedAmount >
            Number(advance.amount)
        ) {
            const error =
                new Error(
                    "Approved amount cannot be greater than requested amount"
                );

            error.statusCode = 400;
            throw error;
        }

        const updatedAdvance =
            await prisma.advancePayment.update({
                where: {
                    advanceId:
                        Number(advanceId)
                },

                data: {
                    status:
                        "APPROVED",

                    approvedAmount:
                        finalApprovedAmount,

                    // Keep existing paid amount if
                    // one already exists
                    paidAmount:
                        advance.paidAmount ?? null,

                    approvedBy:
                        Number(adminId)
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
    }


    // ==========================================
    // REJECT
    // ==========================================

    if (normalizedStatus === "REJECTED") {

        const updatedAdvance =
            await prisma.advancePayment.update({
                where: {
                    advanceId:
                        Number(advanceId)
                },

                data: {
                    status:
                        "REJECTED",

                    approvedAmount:
                        null,

                    paidAmount:
                        null,

                    approvedBy:
                        null
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
    }


    // ==========================================
    // PAY
    // ==========================================

    if (normalizedStatus === "PAID") {

        // ==========================================
        // Paid amount is required
        // ==========================================

        if (
            paidAmount === undefined ||
            paidAmount === null ||
            paidAmount === ""
        ) {
            const error =
                new Error(
                    "Paid amount is required"
                );

            error.statusCode = 400;
            throw error;
        }

        const finalPaidAmount =
            Number(paidAmount);

        // ==========================================
        // Validate paid amount
        // ==========================================

        if (
            !Number.isFinite(
                finalPaidAmount
            ) ||
            finalPaidAmount <= 0
        ) {
            const error =
                new Error(
                    "Paid amount must be greater than 0"
                );

            error.statusCode = 400;
            throw error;
        }

        // ==========================================
        // Approved amount must exist first
        // ==========================================

        if (
            advance.approvedAmount === null ||
            advance.approvedAmount === undefined
        ) {
            const error =
                new Error(
                    "Advance must have an approved amount before payment"
                );

            error.statusCode = 400;
            throw error;
        }

        // ==========================================
        // Mark as PAID
        //
        // paidAmount may be different from
        // approvedAmount as per your requirement.
        // ==========================================

        const updatedAdvance =
            await prisma.advancePayment.update({
                where: {
                    advanceId:
                        Number(advanceId)
                },

                data: {
                    status:
                        "PAID",

                    paidAmount:
                        finalPaidAmount,

                    // Preserve approved amount
                    approvedAmount:
                        advance.approvedAmount,

                    // Preserve original approver
                    approvedBy:
                        advance.approvedBy
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
    }


    // ==========================================
    // PENDING
    //
    // Normally an advance is already PENDING
    // when created, so this is only a fallback.
    // ==========================================

    if (normalizedStatus === "PENDING") {

        const updatedAdvance =
            await prisma.advancePayment.update({
                where: {
                    advanceId:
                        Number(advanceId)
                },

                data: {
                    status:
                        "PENDING",

                    approvedAmount:
                        advance.approvedAmount,

                    paidAmount:
                        advance.paidAmount,

                    approvedBy:
                        null
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
    }


    // ==========================================
    // Fallback
    // ==========================================

    const error =
        new Error(
            "Unable to update advance"
        );

    error.statusCode = 400;
    throw error;
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

    // ==========================================
    // Paid advances cannot be deleted
    // ==========================================

    if (advance.status === "PAID") {
        const error =
            new Error(
                "Paid advance cannot be deleted"
            );

        error.statusCode = 400;
        throw error;
    }

    // ==========================================
    // Payroll-linked advances cannot be deleted
    // ==========================================

    if (
        advance.deductedInPayrollId
    ) {
        const error =
            new Error(
                "Advance linked to payroll cannot be deleted"
            );

        error.statusCode = 400;
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
    } = data || {};

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

    if (
        employee.status !== "ACTIVE"
    ) {
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

                // Original requested amount
                amount:
                    Number(amount),

                // Employee cannot set these
                approvedAmount:
                    null,

                paidAmount:
                    null,

                reason:
                    reason || null,

                paymentDate:
                    parsedPaymentDate,

                // New request always starts PENDING
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

    // Employee self-service operations
    getMyAdvances,
    createMyAdvance
};