const prisma = require("../config/database");

/**
 * ============================================================
 * VALIDATION HELPERS
 * ============================================================
 */

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
 * Validate year
 */
function validateYear(value, fieldName = "year") {
    const year = Number(value);

    if (
        !Number.isInteger(year) ||
        year < 2000 ||
        year > 2100
    ) {
        const error = new Error(
            `${fieldName} must be a valid year`
        );

        error.statusCode = 400;
        throw error;
    }

    return year;
}

/**
 * Validate non-negative numeric value
 */
function validateNonNegativeNumber(
    value,
    fieldName
) {
    const number = Number(value);

    if (
        !Number.isFinite(number) ||
        number < 0
    ) {
        const error = new Error(
            `${fieldName} must be a non-negative number`
        );

        error.statusCode = 400;
        throw error;
    }

    return number;
}


/**
 * ============================================================
 * VERIFY EMPLOYEE
 * ============================================================
 */

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
 * ============================================================
 * VERIFY LEAVE TYPE
 * ============================================================
 */

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
 * ============================================================
 * ENSURE COMPANY LEAVE BALANCES
 * ============================================================
 *
 * BUSINESS RULE:
 *
 * If the company has:
 *
 *     Leave Type = Casual Leave
 *     Annual Quota = 12
 *
 * then every ACTIVE employee should have:
 *
 *     Allocated = 12
 *
 * for the current year.
 *
 * Existing used leave is NEVER reset.
 *
 * Example:
 *
 * Employee A:
 *     allocated = 12
 *     used      = 3
 *     remaining = 9
 *
 * Employee B:
 *     allocated = 12
 *     used      = 0
 *     remaining = 12
 *
 * This function creates missing rows and synchronizes
 * the allocation from LeaveType.annualQuota.
 */
async function ensureCompanyLeaveBalances(
    companyId,
    year,
    transactionClient = prisma
) {
    const company = validateId(
        companyId,
        "company ID"
    );

    const targetYear = validateYear(
        year,
        "year"
    );

    /**
     * Get all ACTIVE employees of the company.
     */
    const employees =
        await transactionClient.employee.findMany({
            where: {
                companyId: company,
                status: "ACTIVE"
            },

            select: {
                employeeId: true
            },

            orderBy: {
                employeeId: "asc"
            }
        });

    /**
     * Nothing to create if the company has no
     * active employees.
     */
    if (employees.length === 0) {
        return [];
    }

    /**
     * Get all ACTIVE leave types that have an
     * annual quota configured.
     *
     * annualQuota is the company-wide allocation source.
     */
    const leaveTypes =
        await transactionClient.leaveType.findMany({
            where: {
                companyId: company,
                status: "ACTIVE",

                annualQuota: {
                    not: null
                }
            },

            select: {
                leaveTypeId: true,
                annualQuota: true
            },

            orderBy: {
                leaveTypeId: "asc"
            }
        });

    /**
     * No quota-configured leave types.
     */
    if (leaveTypes.length === 0) {
        return [];
    }

    const synchronizedBalances = [];

    /**
     * Process every employee.
     */
    for (const employee of employees) {
        /**
         * Process every active leave type.
         */
        for (const leaveType of leaveTypes) {
            const allocated =
                Number(leaveType.annualQuota);

            /**
             * This should normally already be valid
             * because annualQuota is stored as Decimal.
             */
            if (
                !Number.isFinite(allocated) ||
                allocated < 0
            ) {
                continue;
            }

            /**
             * Find existing balance.
             */
            const existing =
                await transactionClient.leaveBalance.findUnique({
                    where: {
                        employeeId_leaveTypeId_year: {
                            employeeId:
                                employee.employeeId,

                            leaveTypeId:
                                leaveType.leaveTypeId,

                            year: targetYear
                        }
                    }
                });

            /**
             * ----------------------------------------------------
             * CREATE MISSING BALANCE
             * ----------------------------------------------------
             */
            if (!existing) {
                const created =
                    await transactionClient.leaveBalance.create({
                        data: {
                            employeeId:
                                employee.employeeId,

                            leaveTypeId:
                                leaveType.leaveTypeId,

                            year: targetYear,

                            allocated,

                            used: 0,

                            remaining: allocated
                        }
                    });

                synchronizedBalances.push(
                    created
                );

                continue;
            }

            /**
             * ----------------------------------------------------
             * SYNCHRONIZE EXISTING BALANCE
             * ----------------------------------------------------
             *
             * Important:
             *
             * used is preserved.
             *
             * We never reset the employee's already-used
             * leave just because the company quota is synced.
             */
            const used =
                Number(existing.used);

            /**
             * If the company quota is lower than
             * already-used leave, do not create an
             * invalid negative accounting state.
             *
             * Example:
             *
             * used = 10
             * annualQuota = 5
             *
             * In this situation allocated remains at
             * least the used amount so the accounting
             * record stays internally consistent.
             *
             * The normal case remains:
             *
             * allocated = annualQuota
             */
            const synchronizedAllocated =
                allocated >= used
                    ? allocated
                    : used;

            const remaining =
                Math.max(
                    0,
                    synchronizedAllocated - used
                );

            /**
             * Only update when something actually changed.
             */
            if (
                Number(existing.allocated) !==
                    synchronizedAllocated ||
                Number(existing.remaining) !==
                    remaining
            ) {
                const updated =
                    await transactionClient.leaveBalance.update({
                        where: {
                            leaveBalanceId:
                                existing.leaveBalanceId
                        },

                        data: {
                            allocated:
                                synchronizedAllocated,

                            /**
                             * IMPORTANT:
                             * used is intentionally NOT updated.
                             */

                            remaining
                        }
                    });

                synchronizedBalances.push(
                    updated
                );
            } else {
                synchronizedBalances.push(
                    existing
                );
            }
        }
    }

    return synchronizedBalances;
}


/**
 ============================================================
 * CREATE LEAVE BALANCE
 * ============================================================
 */

/**
 * Create Leave Balance manually
 *
 * This method is retained for compatibility with
 * your existing admin API.
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

    if (
        !data ||
        typeof data !== "object"
    ) {
        const error = new Error(
            "Leave balance data is required"
        );

        error.statusCode = 400;
        throw error;
    }

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

    const year =
        validateYear(
            data.year,
            "year"
        );

    const allocated =
        validateNonNegativeNumber(
            data.allocated,
            "allocated"
        );

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
 * ============================================================
 * GET LEAVE BALANCES
 * ============================================================
 */

/**
 * Get Leave Balances
 *
 * Before returning balances, the service automatically
 * creates missing balances for the current/requested year.
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

    /**
     * Determine requested year.
     *
     * If frontend does not send a year,
     * use the current calendar year.
     */
    const targetYear =
        filters.year !== undefined &&
        filters.year !== ""
            ? validateYear(
                  filters.year,
                  "year"
              )
            : new Date().getFullYear();

    /**
     * IMPORTANT:
     *
     * First make sure that every active employee
     * has a balance for every active leave type
     * with an annual quota.
     */
    await ensureCompanyLeaveBalances(
        company,
        targetYear
    );

    const where = {
        employee: {
            companyId: company
        },

        year: targetYear
    };

    /**
     * Optional employee filter
     */
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
            },

            {
                leaveTypeId: "asc"
            }
        ]
    });
}


/**
 * ============================================================
 * GET LEAVE BALANCE BY ID
 * ============================================================
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
 * ============================================================
 * UPDATE LEAVE BALANCE
 * ============================================================
 */

/**
 * Manual balance update retained for existing admin API.
 *
 * Used value is still protected:
 *
 *     used <= allocated
 *
 * Remaining is always recalculated.
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

    if (
        !data ||
        typeof data !== "object"
    ) {
        const error = new Error(
            "Leave balance data is required"
        );

        error.statusCode = 400;
        throw error;
    }

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

    /**
     * Update allocated
     */
    if (
        data.allocated !== undefined
    ) {
        allocated =
            validateNonNegativeNumber(
                data.allocated,
                "allocated"
            );
    }

    /**
     * Update used
     */
    if (
        data.used !== undefined
    ) {
        used =
            validateNonNegativeNumber(
                data.used,
                "used"
            );
    }

    /**
     * Accounting protection.
     */
    if (used > allocated) {
        const error = new Error(
            "used cannot be greater than allocated"
        );

        error.statusCode = 400;
        throw error;
    }

    /**
     * Add fields to update object.
     */
    if (
        data.allocated !== undefined
    ) {
        updateData.allocated =
            allocated;
    }

    if (
        data.used !== undefined
    ) {
        updateData.used =
            used;
    }

    /**
     * Whenever allocated or used changes,
     * remaining is recalculated.
     */
    if (
        data.allocated !== undefined ||
        data.used !== undefined
    ) {
        updateData.remaining =
            allocated - used;
    }

    /**
     * Nothing to update.
     */
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


/**
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
    createLeaveBalance,
    getLeaveBalances,
    getLeaveBalanceById,
    updateLeaveBalance,

    /**
     * Exported so the approval service can also
     * guarantee that a balance exists before
     * deducting leave.
     */
    ensureCompanyLeaveBalances
};