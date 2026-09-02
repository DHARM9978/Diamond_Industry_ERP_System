const prisma = require("../config/database");

const VALID_STATUSES = [
    "PENDING",
    "APPROVED",
    "REJECTED",
    "CANCELLED"
];

/**
 * Validate positive integer ID
 */
function validateId(value, fieldName) {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        const error = new Error(
            `Invalid ${fieldName}`
        );

        error.statusCode = 400;
        throw error;
    }

    return id;
}

/**
 * Parse date safely
 */
function parseDate(value, fieldName) {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        const error = new Error(
            `${fieldName} must use YYYY-MM-DD format`
        );

        error.statusCode = 400;
        throw error;
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        const error = new Error(
            `${fieldName} must be a valid date`
        );

        error.statusCode = 400;
        throw error;
    }

    return date;
}

/**
 * Calculate inclusive days
 */
function calculateTotalDays(
    startDate,
    endDate
) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    return (
        (
            end.getTime() -
            start.getTime()
        ) /
            (1000 * 60 * 60 * 24)
    ) + 1;
}

/**
 * Verify employee
 */
async function verifyEmployee(
    employeeId,
    companyId
) {
    const employee =
        await prisma.employee.findFirst({
            where: {
                employeeId,
                companyId
            },
            select: {
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
                status: true
            }
        });

    if (!employee) {
        const error = new Error(
            "Employee not found in your company"
        );

        error.statusCode = 404;
        throw error;
    }

    if (employee.status !== "ACTIVE") {
        const error = new Error(
            "Employee is not active"
        );

        error.statusCode = 400;
        throw error;
    }

    return employee;
}

/**
 * Create Leave Request
 */
async function createLeaveRequest(
    companyId,
    employeeId,
    data
) {
    const company =
        validateId(
            companyId,
            "company ID"
        );

    const employee =
        validateId(
            employeeId,
            "employee ID"
        );

    const leaveTypeId =
        validateId(
            data.leaveTypeId,
            "leave type ID"
        );

    if (!data.startDate) {
        const error = new Error(
            "startDate is required"
        );

        error.statusCode = 400;
        throw error;
    }

    if (!data.endDate) {
        const error = new Error(
            "endDate is required"
        );

        error.statusCode = 400;
        throw error;
    }

    const startDate =
        parseDate(
            data.startDate,
            "startDate"
        );

    const endDate =
        parseDate(
            data.endDate,
            "endDate"
        );

    if (endDate < startDate) {
        const error = new Error(
            "endDate cannot be before startDate"
        );

        error.statusCode = 400;
        throw error;
    }

    const totalDays =
        data.totalDays !== undefined
            ? Number(data.totalDays)
            : calculateTotalDays(
                  startDate,
                  endDate
              );

    if (
        !Number.isFinite(totalDays) ||
        totalDays <= 0
    ) {
        const error = new Error(
            "totalDays must be greater than zero"
        );

        error.statusCode = 400;
        throw error;
    }

    await verifyEmployee(
        employee,
        company
    );

    const leaveType =
        await prisma.leaveType.findFirst({
            where: {
                leaveTypeId,
                companyId: company
            }
        });

    if (!leaveType) {
        const error = new Error(
            "Leave type not found in your company"
        );

        error.statusCode = 404;
        throw error;
    }

    if (leaveType.status !== "ACTIVE") {
        const error = new Error(
            "Leave type is inactive"
        );

        error.statusCode = 400;
        throw error;
    }

    if (
        totalDays % 1 !== 0 &&
        !leaveType.allowHalfDay
    ) {
        const error = new Error(
            "Half-day leave is not allowed for this leave type"
        );

        error.statusCode = 400;
        throw error;
    }

    /**
     * Check overlapping request
     */
    const overlapping =
        await prisma.leaveRequest.findFirst({
            where: {
                employeeId: employee,
                status: {
                    in: [
                        "PENDING",
                        "APPROVED"
                    ]
                },
                startDate: {
                    lte: endDate
                },
                endDate: {
                    gte: startDate
                }
            }
        });

    if (overlapping) {
        const error = new Error(
            "Employee already has an overlapping leave request"
        );

        error.statusCode = 409;
        throw error;
    }

    return await prisma.leaveRequest.create({
        data: {
            employeeId: employee,
            leaveTypeId,
            startDate,
            endDate,
            totalDays,
            reason:
                data.reason?.trim() || null,
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
            },
            leaveType: true
        }
    });
}

/**
 * Get Leave Requests
 */
async function getLeaveRequests(
    companyId,
    filters = {}
) {
    const company =
        validateId(
            companyId,
            "company ID"
        );

    const where = {
        employee: {
            companyId: company
        }
    };

    if (
        filters.employeeId !== undefined &&
        filters.employeeId !== ""
    ) {
        where.employeeId =
            validateId(
                filters.employeeId,
                "employee ID"
            );
    }

    if (
        filters.status !== undefined &&
        filters.status !== ""
    ) {
        if (
            !VALID_STATUSES.includes(
                filters.status
            )
        ) {
            const error = new Error(
                `status must be one of: ${VALID_STATUSES.join(", ")}`
            );

            error.statusCode = 400;
            throw error;
        }

        where.status =
            filters.status;
    }

    return await prisma.leaveRequest.findMany({
        where,
        include: {
            employee: {
                select: {
                    employeeId: true,
                    firstName: true,
                    lastName: true,
                    email: true
                }
            },
            leaveType: true
        },
        orderBy: {
            createdAt: "desc"
        }
    });
}

/**
 * Get Leave Request by ID
 */
async function getLeaveRequestById(
    companyId,
    leaveRequestId
) {
    const company =
        validateId(
            companyId,
            "company ID"
        );

    const id =
        validateId(
            leaveRequestId,
            "leave request ID"
        );

    const request =
        await prisma.leaveRequest.findFirst({
            where: {
                leaveRequestId: id,
                employee: {
                    companyId: company
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
                },
                leaveType: true
            }
        });

    if (!request) {
        const error = new Error(
            "Leave request not found"
        );

        error.statusCode = 404;
        throw error;
    }

    return request;
}

/**
 * Approve Leave Request
 */
async function approveLeaveRequest(
    companyId,
    leaveRequestId,
    adminId
) {
    const company =
        validateId(
            companyId,
            "company ID"
        );

    const requestId =
        validateId(
            leaveRequestId,
            "leave request ID"
        );

    const admin =
        validateId(
            adminId,
            "admin ID"
        );

    const request =
        await prisma.leaveRequest.findFirst({
            where: {
                leaveRequestId: requestId,
                employee: {
                    companyId: company
                }
            }
        });

    if (!request) {
        const error = new Error(
            "Leave request not found"
        );

        error.statusCode = 404;
        throw error;
    }

    if (request.status !== "PENDING") {
        const error = new Error(
            `Leave request cannot be approved because its current status is ${request.status}`
        );

        error.statusCode = 409;
        throw error;
    }

    return await prisma.$transaction(
        async (tx) => {
            const year =
                new Date(
                    request.startDate
                ).getFullYear();

            const balance =
                await tx.leaveBalance.findUnique({
                    where: {
                        employeeId_leaveTypeId_year: {
                            employeeId:
                                request.employeeId,
                            leaveTypeId:
                                request.leaveTypeId,
                            year
                        }
                    }
                });

            if (!balance) {
                const error = new Error(
                    "Leave balance does not exist for this employee and leave type"
                );

                error.statusCode = 400;
                throw error;
            }

            const remaining =
                Number(
                    balance.remaining
                );

            const totalDays =
                Number(
                    request.totalDays
                );

            if (remaining < totalDays) {
                const error = new Error(
                    "Insufficient leave balance"
                );

                error.statusCode = 400;
                throw error;
            }

            const updatedRequest =
                await tx.leaveRequest.update({
                    where: {
                        leaveRequestId:
                            requestId
                    },
                    data: {
                        status: "APPROVED",
                        approvedBy: admin,
                        approvedAt:
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
                        },
                        leaveType: true
                    }
                });

            await tx.leaveBalance.update({
                where: {
                    leaveBalanceId:
                        balance.leaveBalanceId
                },
                data: {
                    used:
                        Number(
                            balance.used
                        ) + totalDays,

                    remaining:
                        remaining -
                        totalDays
                }
            });

            return updatedRequest;
        }
    );
}

/**
 * Reject Leave Request
 */
async function rejectLeaveRequest(
    companyId,
    leaveRequestId,
    adminId,
    rejectionReason
) {
    const company =
        validateId(
            companyId,
            "company ID"
        );

    const requestId =
        validateId(
            leaveRequestId,
            "leave request ID"
        );

    const admin =
        validateId(
            adminId,
            "admin ID"
        );

    const request =
        await prisma.leaveRequest.findFirst({
            where: {
                leaveRequestId: requestId,
                employee: {
                    companyId: company
                }
            }
        });

    if (!request) {
        const error = new Error(
            "Leave request not found"
        );

        error.statusCode = 404;
        throw error;
    }

    if (request.status !== "PENDING") {
        const error = new Error(
            `Leave request cannot be rejected because its current status is ${request.status}`
        );

        error.statusCode = 409;
        throw error;
    }

    return await prisma.leaveRequest.update({
        where: {
            leaveRequestId: requestId
        },
        data: {
            status: "REJECTED",
            approvedBy: admin,
            approvedAt:
                new Date(),
            rejectionReason:
                rejectionReason?.trim() || null
        },
        include: {
            employee: {
                select: {
                    employeeId: true,
                    firstName: true,
                    lastName: true,
                    email: true
                }
            },
            leaveType: true
        }
    });
}

/**
 * Cancel Leave Request
 */
async function cancelLeaveRequest(
    companyId,
    leaveRequestId,
    employeeId
) {
    const company =
        validateId(
            companyId,
            "company ID"
        );

    const requestId =
        validateId(
            leaveRequestId,
            "leave request ID"
        );

    const employee =
        validateId(
            employeeId,
            "employee ID"
        );

    const request =
        await prisma.leaveRequest.findFirst({
            where: {
                leaveRequestId: requestId,
                employeeId: employee,
                employee: {
                    companyId: company
                }
            }
        });

    if (!request) {
        const error = new Error(
            "Leave request not found"
        );

        error.statusCode = 404;
        throw error;
    }

    if (
        ![
            "PENDING",
            "APPROVED"
        ].includes(request.status)
    ) {
        const error = new Error(
            `Leave request cannot be cancelled because its current status is ${request.status}`
        );

        error.statusCode = 409;
        throw error;
    }

    return await prisma.$transaction(
        async (tx) => {
            const updatedRequest =
                await tx.leaveRequest.update({
                    where: {
                        leaveRequestId:
                            requestId
                    },
                    data: {
                        status:
                            "CANCELLED"
                    },
                    include: {
                        employee: {
                            select: {
                                employeeId: true,
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        },
                        leaveType: true
                    }
                });

            /**
             * Return balance when an APPROVED
             * leave is cancelled.
             */
            if (
                request.status ===
                "APPROVED"
            ) {
                const year =
                    new Date(
                        request.startDate
                    ).getFullYear();

                const balance =
                    await tx.leaveBalance.findUnique({
                        where: {
                            employeeId_leaveTypeId_year: {
                                employeeId:
                                    request.employeeId,
                                leaveTypeId:
                                    request.leaveTypeId,
                                year
                            }
                        }
                    });

                if (balance) {
                    const used =
                        Number(
                            balance.used
                        );

                    const remaining =
                        Number(
                            balance.remaining
                        );

                    const totalDays =
                        Number(
                            request.totalDays
                        );

                    await tx.leaveBalance.update({
                        where: {
                            leaveBalanceId:
                                balance.leaveBalanceId
                        },
                        data: {
                            used:
                                Math.max(
                                    0,
                                    used -
                                        totalDays
                                ),

                            remaining:
                                remaining +
                                totalDays
                        }
                    });
                }
            }

            return updatedRequest;
        }
    );
}

module.exports = {
    createLeaveRequest,
    getLeaveRequests,
    getLeaveRequestById,
    approveLeaveRequest,
    rejectLeaveRequest,
    cancelLeaveRequest
};