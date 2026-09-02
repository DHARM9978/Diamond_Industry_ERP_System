const leaveRequestService =
    require("../services/leaveRequest.service");

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
 * Get Employee ID from JWT
 */
function getEmployeeId(req) {
    const employeeId =
        req.user?.employeeId;

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
 * Get Admin ID from JWT
 */
function getAdminId(req) {
    const adminId =
        req.user?.adminId;

    if (!adminId) {
        const error = new Error(
            "Admin ID not found in authentication"
        );

        error.statusCode = 401;
        throw error;
    }

    return Number(adminId);
}

/**
 * Create Leave Request
 */
const createLeaveRequest = async (
    req,
    res,
    next
) => {
    try {
        const companyId =
            getCompanyId(req);

        const employeeId =
            getEmployeeId(req);

        const request =
            await leaveRequestService.createLeaveRequest(
                companyId,
                employeeId,
                req.body
            );

        res.status(201).json({
            success: true,
            message:
                "Leave request submitted successfully",
            data: request
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get Leave Requests
 */
const getLeaveRequests = async (
    req,
    res,
    next
) => {
    try {
        const companyId =
            getCompanyId(req);

        const requests =
            await leaveRequestService.getLeaveRequests(
                companyId,
                {
                    employeeId:
                        req.query.employeeId,
                    status:
                        req.query.status
                }
            );

        res.status(200).json({
            success: true,
            message:
                "Leave requests fetched successfully",
            data: requests
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get Leave Request by ID
 */
const getLeaveRequestById = async (
    req,
    res,
    next
) => {
    try {
        const companyId =
            getCompanyId(req);

        const request =
            await leaveRequestService.getLeaveRequestById(
                companyId,
                req.params.id
            );

        res.status(200).json({
            success: true,
            message:
                "Leave request fetched successfully",
            data: request
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Approve Leave Request
 */
const approveLeaveRequest = async (
    req,
    res,
    next
) => {
    try {
        const companyId =
            getCompanyId(req);

        const adminId =
            getAdminId(req);

        const request =
            await leaveRequestService.approveLeaveRequest(
                companyId,
                req.params.id,
                adminId
            );

        res.status(200).json({
            success: true,
            message:
                "Leave request approved successfully",
            data: request
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Reject Leave Request
 */
const rejectLeaveRequest = async (
    req,
    res,
    next
) => {
    try {
        const companyId =
            getCompanyId(req);

        const adminId =
            getAdminId(req);

        const request =
            await leaveRequestService.rejectLeaveRequest(
                companyId,
                req.params.id,
                adminId,
                req.body.rejectionReason
            );

        res.status(200).json({
            success: true,
            message:
                "Leave request rejected successfully",
            data: request
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Cancel Leave Request
 */
const cancelLeaveRequest = async (
    req,
    res,
    next
) => {
    try {
        const companyId =
            getCompanyId(req);

        const employeeId =
            getEmployeeId(req);

        const request =
            await leaveRequestService.cancelLeaveRequest(
                companyId,
                req.params.id,
                employeeId
            );

        res.status(200).json({
            success: true,
            message:
                "Leave request cancelled successfully",
            data: request
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createLeaveRequest,
    getLeaveRequests,
    getLeaveRequestById,
    approveLeaveRequest,
    rejectLeaveRequest,
    cancelLeaveRequest
};