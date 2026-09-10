const prisma =
    require("../config/database");


// ==========================================================
// Helper: Positive Number
// ==========================================================

const validatePositiveAmount = (
    value,
    fieldName
) => {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        const error =
            new Error(
                `${fieldName} is required`
            );

        error.statusCode = 400;

        throw error;
    }


    const numericValue =
        Number(value);


    if (
        !Number.isFinite(
            numericValue
        ) ||
        numericValue <= 0
    ) {
        const error =
            new Error(
                `${fieldName} must be greater than 0`
            );

        error.statusCode = 400;

        throw error;
    }


    return Number(
        numericValue.toFixed(2)
    );
};


// ==========================================================
// Helper: Valid Date
// ==========================================================

const parseDate = (
    value,
    fieldName
) => {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        const error =
            new Error(
                `${fieldName} is required`
            );

        error.statusCode = 400;

        throw error;
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        const error =
            new Error(
                `${fieldName} is invalid`
            );

        error.statusCode = 400;

        throw error;
    }


    return date;
};


// ==========================================================
// Helper: Include Employee + Approver
// ==========================================================

const advanceInclude = {

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
};


// ==========================================================
// Create Advance Payment
//
// POST /api/advances
//
// Admin creates advance on behalf of employee.
//
// amount        = original requested amount
// approvedAmount = null
// paidAmount     = null
// status         = PENDING
// ==========================================================

const createAdvance = async (
    data,
    companyId
) => {

    const {

        employeeId,

        amount,

        reason,

        paymentDate

    } = data || {};


    // ======================================================
    // Validate Employee ID
    // ======================================================

    const parsedEmployeeId =
        Number(employeeId);


    if (
        !Number.isInteger(
            parsedEmployeeId
        ) ||
        parsedEmployeeId < 1
    ) {

        const error =
            new Error(
                "Invalid employee ID"
            );

        error.statusCode = 400;

        throw error;
    }


    // ======================================================
    // Verify Employee Belongs To Company
    // ======================================================

    const employee =
        await prisma.employee.findFirst({

            where: {

                employeeId:
                    parsedEmployeeId,

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


    // ======================================================
    // Only ACTIVE Employees Can Receive Advances
    // ======================================================

    if (
        employee.status !==
        "ACTIVE"
    ) {

        const error =
            new Error(
                "Cannot create advance for inactive employee"
            );

        error.statusCode = 400;

        throw error;
    }


    // ======================================================
    // Validate Requested Amount
    // ======================================================

    const requestedAmount =
        validatePositiveAmount(
            amount,
            "Advance amount"
        );


    // ======================================================
    // Validate Payment Date
    // ======================================================

    const parsedPaymentDate =
        parseDate(
            paymentDate,
            "Payment date"
        );


    // ======================================================
    // Create Advance
    //
    // Important:
    //
    // amount = ORIGINAL REQUEST
    //
    // approvedAmount = null
    //
    // paidAmount = null
    //
    // status = PENDING
    // ======================================================

    const advance =
        await prisma.advancePayment.create({

            data: {

                employeeId:
                    parsedEmployeeId,

                amount:
                    requestedAmount,

                approvedAmount:
                    null,

                paidAmount:
                    null,

                reason:
                    reason || null,

                paymentDate:
                    parsedPaymentDate,

                approvedBy:
                    null,

                status:
                    "PENDING"
            },

            include:
                advanceInclude
        });


    return advance;
};


// ==========================================================
// Get All Advances
//
// GET /api/advances
// ==========================================================

const getAllAdvances = async (
    companyId
) => {

    const advances =
        await prisma.advancePayment.findMany({

            where: {

                employee: {

                    companyId:
                        Number(companyId)
                }
            },

            include:
                advanceInclude,

            orderBy: {

                paymentDate:
                    "desc"
            }
        });


    return advances;
};


// ==========================================================
// Get Advance By ID
//
// GET /api/advances/:id
// ==========================================================

const getAdvanceById = async (
    advanceId,
    companyId
) => {

    const parsedAdvanceId =
        Number(advanceId);


    if (
        !Number.isInteger(
            parsedAdvanceId
        ) ||
        parsedAdvanceId < 1
    ) {

        const error =
            new Error(
                "Invalid advance ID"
            );

        error.statusCode = 400;

        throw error;
    }


    const advance =
        await prisma.advancePayment.findFirst({

            where: {

                advanceId:
                    parsedAdvanceId,

                employee: {

                    companyId:
                        Number(companyId)
                }
            },

            include:
                advanceInclude
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


// ==========================================================
// Get Employee Advances
//
// GET /api/advances/employee/:employeeId
// ==========================================================

const getEmployeeAdvances = async (
    employeeId,
    companyId
) => {

    const parsedEmployeeId =
        Number(employeeId);


    if (
        !Number.isInteger(
            parsedEmployeeId
        ) ||
        parsedEmployeeId < 1
    ) {

        const error =
            new Error(
                "Invalid employee ID"
            );

        error.statusCode = 400;

        throw error;
    }


    // ======================================================
    // Verify Employee Belongs To Company
    // ======================================================

    const employee =
        await prisma.employee.findFirst({

            where: {

                employeeId:
                    parsedEmployeeId,

                companyId:
                    Number(companyId)
            },

            select: {

                employeeId:
                    true
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


    const advances =
        await prisma.advancePayment.findMany({

            where: {

                employeeId:
                    parsedEmployeeId,

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

                paymentDate:
                    "desc"
            }
        });


    return advances;
};


// ==========================================================
// Update Advance Status
//
// PATCH /api/advances/:id/status
//
// Allowed workflow:
//
// PENDING  -> APPROVED
// PENDING  -> REJECTED
// APPROVED -> APPROVED   (change approved amount)
// APPROVED -> PAID
//
// REJECTED -> locked
// PAID     -> locked
//
// ==========================================================

const updateAdvanceStatus = async (
    advanceId,
    status,
    adminId,
    companyId,
    data = {}
) => {

    const parsedAdvanceId =
        Number(advanceId);

    const parsedAdminId =
        Number(adminId);


    // ======================================================
    // Validate IDs
    // ======================================================

    if (
        !Number.isInteger(
            parsedAdvanceId
        ) ||
        parsedAdvanceId < 1
    ) {

        const error =
            new Error(
                "Invalid advance ID"
            );

        error.statusCode = 400;

        throw error;
    }


    if (
        !Number.isInteger(
            parsedAdminId
        ) ||
        parsedAdminId < 1
    ) {

        const error =
            new Error(
                "Invalid admin ID"
            );

        error.statusCode = 400;

        throw error;
    }


    // ======================================================
    // Normalize Status
    // ======================================================

    const normalizedStatus =
        String(
            status || ""
        )
            .trim()
            .toUpperCase();


    const {
        approvedAmount,
        paidAmount
    } = data || {};


    // ======================================================
    // Valid Statuses
    // ======================================================

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


    // ======================================================
    // Get Advance
    // ======================================================

    const advance =
        await prisma.advancePayment.findFirst({

            where: {

                advanceId:
                    parsedAdvanceId,

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


    // ======================================================
    // PAID = Permanently Locked
    // ======================================================

    if (
        advance.status ===
        "PAID"
    ) {

        const error =
            new Error(
                "Paid advance cannot be modified"
            );

        error.statusCode = 400;

        throw error;
    }


    // ======================================================
    // REJECTED = Permanently Locked
    // ======================================================

    if (
        advance.status ===
        "REJECTED"
    ) {

        const error =
            new Error(
                "Rejected advance cannot be modified"
            );

        error.statusCode = 400;

        throw error;
    }


    // ======================================================
    // APPROVE
    //
    // PENDING -> APPROVED
    //
    // APPROVED -> APPROVED
    //
    // approvedAmount must:
    //
    // > 0
    // <= requested amount
    //
    // ======================================================

    if (
        normalizedStatus ===
        "APPROVED"
    ) {

        if (
            advance.status !==
            "PENDING" &&
            advance.status !==
            "APPROVED"
        ) {

            const error =
                new Error(
                    "Only pending or already approved advances can be approved"
                );

            error.statusCode = 400;

            throw error;
        }


        let finalApprovedAmount;


        // --------------------------------------------------
        // New approved amount supplied by admin
        // --------------------------------------------------

        if (
            approvedAmount !==
                undefined &&
            approvedAmount !==
                null &&
            approvedAmount !==
                ""
        ) {

            finalApprovedAmount =
                validatePositiveAmount(
                    approvedAmount,
                    "Approved amount"
                );

        } else if (
            advance.approvedAmount !==
                null &&
            advance.approvedAmount !==
                undefined
        ) {

            // ------------------------------------------------
            // Keep existing approval amount
            // ------------------------------------------------

            finalApprovedAmount =
                validatePositiveAmount(
                    advance.approvedAmount,
                    "Approved amount"
                );

        } else {

            // ------------------------------------------------
            // Default:
            // Approve full requested amount
            // ------------------------------------------------

            finalApprovedAmount =
                validatePositiveAmount(
                    advance.amount,
                    "Approved amount"
                );
        }


        // ==================================================
        // Cannot Approve More Than Requested
        // ==================================================

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


        // ==================================================
        // Update Approval
        // ==================================================

        const updatedAdvance =
            await prisma.advancePayment.update({

                where: {

                    advanceId:
                        parsedAdvanceId
                },

                data: {

                    status:
                        "APPROVED",

                    approvedAmount:
                        finalApprovedAmount,

                    // Payment must still be empty
                    // until PAID state.

                    paidAmount:
                        advance.paidAmount ??
                        null,

                    approvedBy:
                        parsedAdminId
                },

                include:
                    advanceInclude
            });


        return updatedAdvance;
    }


    // ======================================================
    // REJECT
    //
    // PENDING -> REJECTED
    //
    // ======================================================

    if (
        normalizedStatus ===
        "REJECTED"
    ) {

        if (
            advance.status !==
            "PENDING"
        ) {

            const error =
                new Error(
                    "Only pending advances can be rejected"
                );

            error.statusCode = 400;

            throw error;
        }


        const updatedAdvance =
            await prisma.advancePayment.update({

                where: {

                    advanceId:
                        parsedAdvanceId
                },

                data: {

                    status:
                        "REJECTED",

                    approvedAmount:
                        null,

                    paidAmount:
                        null,

                    approvedBy:
                        parsedAdminId
                },

                include:
                    advanceInclude
            });


        return updatedAdvance;
    }


    // ======================================================
    // PAID
    //
    // APPROVED -> PAID
    //
    // paidAmount:
    //
    // > 0
    //
    // It may be different from approvedAmount.
    //
    // Example:
    //
    // Requested  = 2000
    // Approved   = 1000
    // Paid       = 1500
    //
    // ======================================================

    if (
        normalizedStatus ===
        "PAID"
    ) {

        if (
            advance.status !==
            "APPROVED"
        ) {

            const error =
                new Error(
                    "Only approved advances can be marked as paid"
                );

            error.statusCode = 400;

            throw error;
        }


        // ==================================================
        // Approved Amount Must Exist
        // ==================================================

        if (
            advance.approvedAmount ===
                null ||
            advance.approvedAmount ===
                undefined
        ) {

            const error =
                new Error(
                    "Advance must have an approved amount before payment"
                );

            error.statusCode = 400;

            throw error;
        }


        // ==================================================
        // Validate Paid Amount
        // ==================================================

        const finalPaidAmount =
            validatePositiveAmount(
                paidAmount,
                "Paid amount"
            );


        // ==================================================
        // Mark As Paid
        //
        // IMPORTANT:
        //
        // amount         -> original request
        // approvedAmount -> approved value
        // paidAmount     -> actual amount paid
        //
        // All three remain separate.
        // ==================================================

        const updatedAdvance =
            await prisma.advancePayment.update({

                where: {

                    advanceId:
                        parsedAdvanceId
                },

                data: {

                    status:
                        "PAID",

                    paidAmount:
                        finalPaidAmount,

                    approvedAmount:
                        advance.approvedAmount,

                    approvedBy:
                        advance.approvedBy
                        ??
                        parsedAdminId
                },

                include:
                    advanceInclude
            });


        return updatedAdvance;
    }


    // ======================================================
    // PENDING
    //
    // We do not allow a completed workflow to be moved
    // back to PENDING.
    //
    // A newly created record is already PENDING.
    // ======================================================

    if (
        normalizedStatus ===
        "PENDING"
    ) {

        if (
            advance.status !==
            "PENDING"
        ) {

            const error =
                new Error(
                    "Advance cannot be moved back to pending"
                );

            error.statusCode = 400;

            throw error;
        }


        return prisma.advancePayment.findUnique({

            where: {

                advanceId:
                    parsedAdvanceId
            },

            include:
                advanceInclude
        });
    }


    // ======================================================
    // Fallback
    // ======================================================

    const error =
        new Error(
            "Unable to update advance"
        );

    error.statusCode = 400;

    throw error;
};


// ==========================================================
// Delete Advance
//
// DELETE /api/advances/:id
//
// Restrictions:
//
// PAID advances cannot be deleted.
//
// Payroll-linked advances cannot be deleted.
//
// REJECTED advances may be deleted unless business rules
// later require keeping them permanently.
//
// ==========================================================

const deleteAdvance = async (
    advanceId,
    companyId
) => {

    const parsedAdvanceId =
        Number(advanceId);


    if (
        !Number.isInteger(
            parsedAdvanceId
        ) ||
        parsedAdvanceId < 1
    ) {

        const error =
            new Error(
                "Invalid advance ID"
            );

        error.statusCode = 400;

        throw error;
    }


    // ======================================================
    // Find Advance
    // ======================================================

    const advance =
        await prisma.advancePayment.findFirst({

            where: {

                advanceId:
                    parsedAdvanceId,

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


    // ======================================================
    // PAID Cannot Be Deleted
    // ======================================================

    if (
        advance.status ===
        "PAID"
    ) {

        const error =
            new Error(
                "Paid advance cannot be deleted"
            );

        error.statusCode = 400;

        throw error;
    }


    // ======================================================
    // Payroll-Linked Advance Cannot Be Deleted
    // ======================================================

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


    // ======================================================
    // Delete
    // ======================================================

    await prisma.advancePayment.delete({

        where: {

            advanceId:
                parsedAdvanceId
        }
    });
};


// ==========================================================
// Get My Advances
//
// GET /api/me/advances
//
// Employee can only see their own records.
// ==========================================================

const getMyAdvances = async (
    employeeId,
    companyId
) => {

    const parsedEmployeeId =
        Number(employeeId);


    if (
        !Number.isInteger(
            parsedEmployeeId
        ) ||
        parsedEmployeeId < 1
    ) {

        const error =
            new Error(
                "Invalid employee ID"
            );

        error.statusCode = 400;

        throw error;
    }


    const advances =
        await prisma.advancePayment.findMany({

            where: {

                employeeId:
                    parsedEmployeeId,

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

                paymentDate:
                    "desc"
            }
        });


    return advances;
};


// ==========================================================
// Create My Advance
//
// POST /api/me/advances
//
// Employee can create only their own request.
//
// amount         = original requested amount
// approvedAmount = null
// paidAmount     = null
// status         = PENDING
// ==========================================================

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


    const parsedEmployeeId =
        Number(employeeId);


    if (
        !Number.isInteger(
            parsedEmployeeId
        ) ||
        parsedEmployeeId < 1
    ) {

        const error =
            new Error(
                "Invalid employee ID"
            );

        error.statusCode = 400;

        throw error;
    }


    // ======================================================
    // Verify Logged-In Employee
    // ======================================================

    const employee =
        await prisma.employee.findFirst({

            where: {

                employeeId:
                    parsedEmployeeId,

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


    // ======================================================
    // Only Active Employees Can Request
    // ======================================================

    if (
        employee.status !==
        "ACTIVE"
    ) {

        const error =
            new Error(
                "Cannot request advance as inactive employee"
            );

        error.statusCode = 400;

        throw error;
    }


    // ======================================================
    // Validate Requested Amount
    // ======================================================

    const requestedAmount =
        validatePositiveAmount(
            amount,
            "Advance amount"
        );


    // ======================================================
    // Validate Payment Date
    // ======================================================

    const parsedPaymentDate =
        parseDate(
            paymentDate,
            "Payment date"
        );


    // ======================================================
    // Create Request
    // ======================================================

    const advance =
        await prisma.advancePayment.create({

            data: {

                employeeId:
                    parsedEmployeeId,

                amount:
                    requestedAmount,

                approvedAmount:
                    null,

                paidAmount:
                    null,

                reason:
                    reason || null,

                paymentDate:
                    parsedPaymentDate,

                approvedBy:
                    null,

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


// ==========================================================
// EXPORT
// ==========================================================

module.exports = {

    // Admin operations

    createAdvance,

    getAllAdvances,

    getAdvanceById,

    getEmployeeAdvances,

    updateAdvanceStatus,

    deleteAdvance,


    // Employee self-service

    getMyAdvances,

    createMyAdvance
};