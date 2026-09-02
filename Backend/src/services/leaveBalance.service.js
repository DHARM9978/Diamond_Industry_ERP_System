const prisma = require("../config/database");

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
 * Verify employee belongs to company
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

    return employee;
}

/**
 * Verify Leave Type belongs to company
 */
async function verifyLeaveType(
    leaveTypeId,
    companyId
) {
    const leaveType =
        await prisma.leaveType.findFirst({
            where: {
                leaveTypeId,
                companyId
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

    return leaveType;
}

/**
 * Create Leave Balance
 */
async function createLeaveBalance(
    companyId,
    data
) {
    const company =
        validateId(
            companyId,
            "company ID"
        );

    const employeeId =
        validateId(
            data.employeeId,
            "employee ID"
        );

    const leaveTypeId =
        validateId(
            data.leaveTypeId,
            "leave type ID"
        );

    const year = Number(data.year);
    const allocated = Number(data.allocated);

    if (
        !Number.isInteger(year) ||
        year < 2000 ||
        year > 2100
    ) {
        const error = new Error(
            "year must be a valid year"
        );

        error.statusCode = 400;
        throw error;
    }

    if (
        !Number.isFinite(allocated) ||
        allocated < 0
    ) {
        const error = new Error(
            "allocated must be a non-negative number"
        );

        error.statusCode = 400;
        throw error;
    }

    await verifyEmployee(
        employeeId,
        company
    );

    await verifyLeaveType(
        leaveTypeId,
        company
    );

    const existing =
        await prisma.leaveBalance.findUnique({
            where: {
                employeeId_leaveTypeId_year: {
                    employeeId,
                    leaveTypeId,
                    year
                }
            }
        });

    if (existing) {
        const error = new Error(
            "Leave balance already exists for this employee, leave type and year"
        );

        error.statusCode = 409;
        throw error;
    }

    return await prisma.leaveBalance.create({
        data: {
            employeeId,
            leaveTypeId,
            year,
            allocated,
            used: 0,
            remaining: allocated
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
 * Get Leave Balances
 */
async function getLeaveBalances(
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
        filters.year !== undefined &&
        filters.year !== ""
    ) {
        const year = Number(filters.year);

        if (!Number.isInteger(year)) {
            const error = new Error(
                "year must be a valid integer"
            );

            error.statusCode = 400;
            throw error;
        }

        where.year = year;
    }

    return await prisma.leaveBalance.findMany({
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
        orderBy: [
            {
                year: "desc"
            },
            {
                employeeId: "asc"
            }
        ]
    });
}

/**
 * Get Leave Balance by ID
 */
async function getLeaveBalanceById(
    companyId,
    leaveBalanceId
) {
    const company =
        validateId(
            companyId,
            "company ID"
        );

    const id =
        validateId(
            leaveBalanceId,
            "leave balance ID"
        );

    const balance =
        await prisma.leaveBalance.findFirst({
            where: {
                leaveBalanceId: id,
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

    if (!balance) {
        const error = new Error(
            "Leave balance not found"
        );

        error.statusCode = 404;
        throw error;
    }

    return balance;
}

/**
 * Update Leave Balance
 */
async function updateLeaveBalance(
    companyId,
    leaveBalanceId,
    data
) {
    const company =
        validateId(
            companyId,
            "company ID"
        );

    const id =
        validateId(
            leaveBalanceId,
            "leave balance ID"
        );

    const existing =
        await prisma.leaveBalance.findFirst({
            where: {
                leaveBalanceId: id,
                employee: {
                    companyId: company
                }
            }
        });

    if (!existing) {
        const error = new Error(
            "Leave balance not found"
        );

        error.statusCode = 404;
        throw error;
    }

    const updateData = {};

    let allocated =
        Number(existing.allocated);

    let used =
        Number(existing.used);

    if (data.allocated !== undefined) {
        allocated =
            Number(data.allocated);

        if (
            !Number.isFinite(allocated) ||
            allocated < 0
        ) {
            const error = new Error(
                "allocated must be a non-negative number"
            );

            error.statusCode = 400;
            throw error;
        }
    }

    if (data.used !== undefined) {
        used = Number(data.used);

        if (
            !Number.isFinite(used) ||
            used < 0
        ) {
            const error = new Error(
                "used must be a non-negative number"
            );

            error.statusCode = 400;
            throw error;
        }
    }

    if (used > allocated) {
        const error = new Error(
            "used cannot be greater than allocated"
        );

        error.statusCode = 400;
        throw error;
    }

    if (data.allocated !== undefined) {
        updateData.allocated = allocated;
    }

    if (data.used !== undefined) {
        updateData.used = used;
    }

    if (
        data.allocated !== undefined ||
        data.used !== undefined
    ) {
        updateData.remaining =
            allocated - used;
    }

    if (
        Object.keys(updateData).length === 0
    ) {
        const error = new Error(
            "At least one balance field is required"
        );

        error.statusCode = 400;
        throw error;
    }

    return await prisma.leaveBalance.update({
        where: {
            leaveBalanceId: id
        },
        data: updateData,
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

module.exports = {
    createLeaveBalance,
    getLeaveBalances,
    getLeaveBalanceById,
    updateLeaveBalance
};