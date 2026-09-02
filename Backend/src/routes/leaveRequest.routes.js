const express = require("express");

const router = express.Router();

const controller =
    require("../controllers/leaveRequest.controller");

const authenticate =
    require("../middleware/auth.middleware");

const authorizeRoles =
    require("../middleware/authorization.middleware");

/**
 * Employee submits leave request
 */
router.post(
    "/",
    authenticate,
    controller.createLeaveRequest
);

/**
 * View leave requests
 */
router.get(
    "/",
    authenticate,
    controller.getLeaveRequests
);

/**
 * View leave request by ID
 */
router.get(
    "/:id",
    authenticate,
    controller.getLeaveRequestById
);

/**
 * Admin approves
 */
router.put(
    "/:id/approve",
    authenticate,
    authorizeRoles("ADMIN"),
    controller.approveLeaveRequest
);

/**
 * Admin rejects
 */
router.put(
    "/:id/reject",
    authenticate,
    authorizeRoles("ADMIN"),
    controller.rejectLeaveRequest
);

/**
 * Employee cancels
 */
router.put(
    "/:id/cancel",
    authenticate,
    controller.cancelLeaveRequest
);

module.exports = router;