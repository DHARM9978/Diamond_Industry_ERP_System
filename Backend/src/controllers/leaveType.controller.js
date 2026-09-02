const leaveTypeService =
    require("../services/leaveType.service");

/**
 * Get company ID from JWT
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
 * Create Leave Type
 */
const createLeaveType = async (
    req,
    res,
    next
) => {
    try {
        const companyId = getCompanyId(req);

        const leaveType =
            await leaveTypeService.createLeaveType(
                companyId,
                req.body
            );

        res.status(201).json({
            success: true,
            message:
                "Leave type created successfully",
            data: leaveType
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get Leave Types
 */
const getLeaveTypes = async (
    req,
    res,
    next
) => {
    try {
        const companyId = getCompanyId(req);

        const leaveTypes =
            await leaveTypeService.getLeaveTypes(
                companyId,
                {
                    status: req.query.status
                }
            );

        res.status(200).json({
            success: true,
            message:
                "Leave types fetched successfully",
            data: leaveTypes
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get Leave Type by ID
 */
const getLeaveTypeById = async (
    req,
    res,
    next
) => {
    try {
        const companyId = getCompanyId(req);

        const leaveType =
            await leaveTypeService.getLeaveTypeById(
                companyId,
                req.params.id
            );

        res.status(200).json({
            success: true,
            message:
                "Leave type fetched successfully",
            data: leaveType
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update Leave Type
 */
const updateLeaveType = async (
    req,
    res,
    next
) => {
    try {
        const companyId = getCompanyId(req);

        const leaveType =
            await leaveTypeService.updateLeaveType(
                companyId,
                req.params.id,
                req.body
            );

        res.status(200).json({
            success: true,
            message:
                "Leave type updated successfully",
            data: leaveType
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete Leave Type
 */
const deleteLeaveType = async (
    req,
    res,
    next
) => {
    try {
        const companyId = getCompanyId(req);

        await leaveTypeService.deleteLeaveType(
            companyId,
            req.params.id
        );

        res.status(200).json({
            success: true,
            message:
                "Leave type deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createLeaveType,
    getLeaveTypes,
    getLeaveTypeById,
    updateLeaveType,
    deleteLeaveType
};