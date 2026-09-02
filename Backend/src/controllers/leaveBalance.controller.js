const leaveBalanceService =
    require("../services/leaveBalance.service");

/**
 * Get company ID
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
 * Create Leave Balance
 */
const createLeaveBalance = async (
    req,
    res,
    next
) => {
    try {
        const companyId = getCompanyId(req);

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
 */
const getLeaveBalances = async (
    req,
    res,
    next
) => {
    try {
        const companyId = getCompanyId(req);

        const balances =
            await leaveBalanceService.getLeaveBalances(
                companyId,
                {
                    employeeId:
                        req.query.employeeId,
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
        const companyId = getCompanyId(req);

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
        const companyId = getCompanyId(req);

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