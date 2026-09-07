const leaveBalanceService =
    require("../services/leaveBalance.service");

/**
 * Get Company ID
 */
function getCompanyId(req) {
    const companyId = req.user?.companyId;

    if (!companyId) {
        const error = new Error(
            "Company ID not found in authentication"
        );

        error.statusCode = 401;
        throw error;
    }

    return Number(companyId);
}

/**
 * Get Employee ID from authenticated user
 *
 * Employees must only be able to access
 * their own leave balances.
 *
 * Admins can optionally filter balances
 * using ?employeeId=ID.
 */
function getEmployeeFilter(req) {
    const role = String(
        req.user?.role || ""
    ).toUpperCase();

    /**
     * EMPLOYEE
     *
     * Always use employeeId from JWT.
     * Never trust employeeId from query parameters.
     */
    if (role === "EMPLOYEE") {
        const employeeId = req.user?.employeeId;

        if (!employeeId) {
            const error = new Error(
                "Employee ID not found in authentication"
            );

            error.statusCode = 401;
            throw error;
        }

        return Number(employeeId);
    }

    /**
     * ADMIN
     *
     * Admin can optionally request balances
     * for a specific employee.
     */
    if (role === "ADMIN") {
        if (
            req.query.employeeId !== undefined &&
            req.query.employeeId !== ""
        ) {
            return req.query.employeeId;
        }

        return undefined;
    }

    /**
     * Unknown role
     */
    const error = new Error(
        "Unauthorized role"
    );

    error.statusCode = 403;
    throw error;
}

/**
 * Create Leave Balance
 */
const createLeaveBalance = async (
    req,
    res,
    next
) => {
    try {
        const companyId =
            getCompanyId(req);

        const balance =
            await leaveBalanceService.createLeaveBalance(
                companyId,
                req.body
            );

        res.status(201).json({
            success: true,
            message:
                "Leave balance created successfully",
            data: balance
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get Leave Balances
 *
 * Employee:
 *     GET /api/leave-balances
 *     → only authenticated employee's balances
 *
 * Admin:
 *     GET /api/leave-balances
 *     → all company balances
 *
 * Admin:
 *     GET /api/leave-balances?employeeId=4
 *     → Employee 4 balances
 *
 * Optional:
 *     ?year=2026
 */
const getLeaveBalances = async (
    req,
    res,
    next
) => {
    try {
        const companyId =
            getCompanyId(req);

        const employeeId =
            getEmployeeFilter(req);

        const balances =
            await leaveBalanceService.getLeaveBalances(
                companyId,
                {
                    employeeId,
                    year:
                        req.query.year
                }
            );

        res.status(200).json({
            success: true,
            message:
                "Leave balances fetched successfully",
            data: balances
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get Leave Balance by ID
 */
const getLeaveBalanceById = async (
    req,
    res,
    next
) => {
    try {
        const companyId =
            getCompanyId(req);

        const balance =
            await leaveBalanceService.getLeaveBalanceById(
                companyId,
                req.params.id
            );

        res.status(200).json({
            success: true,
            message:
                "Leave balance fetched successfully",
            data: balance
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update Leave Balance
 */
const updateLeaveBalance = async (
    req,
    res,
    next
) => {
    try {
        const companyId =
            getCompanyId(req);

        const balance =
            await leaveBalanceService.updateLeaveBalance(
                companyId,
                req.params.id,
                req.body
            );

        res.status(200).json({
            success: true,
            message:
                "Leave balance updated successfully",
            data: balance
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createLeaveBalance,
    getLeaveBalances,
    getLeaveBalanceById,
    updateLeaveBalance
};