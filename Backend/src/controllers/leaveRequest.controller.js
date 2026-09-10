const leaveRequestService =
    require("../services/leaveRequest.service");


/**
 * ============================================================
 * GET COMPANY ID
 * ============================================================
 *
 * Company ID always comes from the authenticated JWT.
 */
function getCompanyId(req) {
    const companyId =
        req.user?.companyId;

    if (!companyId) {
        const error =
            new Error(
                "Company ID not found in authentication"
            );

        error.statusCode = 401;
        throw error;
    }

    const id = Number(companyId);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        const error =
            new Error(
                "Invalid company ID in authentication"
            );

        error.statusCode = 401;
        throw error;
    }

    return id;
}


/**
 * ============================================================
 * GET EMPLOYEE ID FROM JWT
 * ============================================================
 *
 * Used for employee-only operations.
 *
 * IMPORTANT:
 * Do not trust employeeId from the browser.
 */
function getEmployeeId(req) {
    const employeeId =
        req.user?.employeeId;

    if (!employeeId) {
        const error =
            new Error(
                "Employee ID not found in authentication"
            );

        error.statusCode = 401;
        throw error;
    }

    const id =
        Number(employeeId);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        const error =
            new Error(
                "Invalid employee ID in authentication"
            );

        error.statusCode = 401;
        throw error;
    }

    return id;
}


/**
 * ============================================================
 * GET ADMIN ID FROM JWT
 * ============================================================
 *
 * Used for admin approval/rejection operations.
 */
function getAdminId(req) {
    const adminId =
        req.user?.adminId;

    if (!adminId) {
        const error =
            new Error(
                "Admin ID not found in authentication"
            );

        error.statusCode = 401;
        throw error;
    }

    const id =
        Number(adminId);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        const error =
            new Error(
                "Invalid admin ID in authentication"
            );

        error.statusCode = 401;
        throw error;
    }

    return id;
}


/**
 * ============================================================
 * CREATE LEAVE REQUEST
 * ============================================================
 *
 * Employee submits a leave request.
 *
 * Employee ID comes from JWT.
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
 * ============================================================
 * GET LEAVE REQUESTS
 * ============================================================
 *
 * EMPLOYEE
 * --------
 * Employee can see ONLY their own requests.
 *
 * employeeId comes from JWT.
 *
 *
 * ADMIN
 * -----
 * Admin can see all requests belonging to
 * the authenticated company.
 *
 * Optional:
 *
 *     ?employeeId=5
 *
 * Optional status:
 *
 *     ?status=PENDING
 *     ?status=APPROVED
 *     ?status=REJECTED
 *     ?status=CANCELLED
 */
const getLeaveRequests = async (
    req,
    res,
    next
) => {
    try {
        const companyId =
            getCompanyId(req);

        const role =
            String(
                req.user?.role || ""
            ).toUpperCase();

        let employeeId;


        /**
         * ========================================================
         * EMPLOYEE
         * ========================================================
         *
         * Always use employee ID from JWT.
         */
        if (role === "EMPLOYEE") {
            employeeId =
                getEmployeeId(req);
        }


        /**
         * ========================================================
         * ADMIN
         * ========================================================
         *
         * Admin may optionally filter by employee.
         */
        else if (role === "ADMIN") {
            employeeId =
                req.query.employeeId;
        }


        /**
         * ========================================================
         * UNKNOWN ROLE
         * ========================================================
         */
        else {
            const error =
                new Error(
                    "Unauthorized role"
                );

            error.statusCode = 403;
            throw error;
        }


        /**
         * ========================================================
         * FETCH REQUESTS
         * ========================================================
         */
        const requests =
            await leaveRequestService.getLeaveRequests(
                companyId,
                {
                    employeeId,

                    status:
                        req.query.status
                }
            );


        /**
         * ========================================================
         * RESPONSE
         * ========================================================
         */
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
 * ============================================================
 * GET LEAVE REQUEST BY ID
 * ============================================================
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
 * ============================================================
 * APPROVE LEAVE REQUEST
 * ============================================================
 *
 * Admin only.
 *
 * Expected request body:
 *
 * {
 *     "approvedStartDate": "2026-09-10",
 *     "approvedEndDate": "2026-09-11"
 * }
 *
 * These fields are optional.
 *
 * When omitted:
 * the complete originally requested
 * date range will be approved.
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


        /**
         * req.body can be undefined.
         *
         * Convert it to an empty object so
         * the service receives a predictable value.
         */
        const approvalData =
            req.body &&
            typeof req.body === "object"
                ? req.body
                : {};


        const request =
            await leaveRequestService.approveLeaveRequest(
                companyId,
                req.params.id,
                adminId,
                approvalData
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
 * ============================================================
 * REJECT LEAVE REQUEST
 * ============================================================
 *
 * Admin only.
 *
 * Expected body:
 *
 * {
 *     "rejectionReason":
 *         "Insufficient staffing"
 * }
 *
 * The reason is optional at the backend level,
 * but the frontend will later provide a proper
 * rejection dialog.
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


        /**
         * Safely read body.
         *
         * This prevents:
         *
         * Cannot read properties of undefined
         * (reading 'rejectionReason')
         */
        const body =
            req.body &&
            typeof req.body === "object"
                ? req.body
                : {};


        const rejectionReason =
            body.rejectionReason;


        const request =
            await leaveRequestService.rejectLeaveRequest(
                companyId,
                req.params.id,
                adminId,
                rejectionReason
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
 * ============================================================
 * CANCEL LEAVE REQUEST
 * ============================================================
 *
 * Employee can cancel only their own request.
 *
 * Employee ID comes from JWT.
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


/**
 * ============================================================
 * EXPORT
 * ============================================================
 */

module.exports = {
    createLeaveRequest,
    getLeaveRequests,
    getLeaveRequestById,
    approveLeaveRequest,
    rejectLeaveRequest,
    cancelLeaveRequest
};