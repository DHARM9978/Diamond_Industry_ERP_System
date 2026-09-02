const express = require("express");

const router = express.Router();

const controller =
    require("../controllers/leaveType.controller");

const authenticate =
    require("../middleware/auth.middleware");

const authorizeRoles =
    require("../middleware/authorization.middleware");

/**
 * Create
 */
router.post(
    "/",
    authenticate,
    authorizeRoles("ADMIN"),
    controller.createLeaveType
);

/**
 * Get all
 *
 * Employee access is allowed because
 * employees need active leave types
 * when submitting leave requests.
 */
router.get(
    "/",
    authenticate,
    controller.getLeaveTypes
);

/**
 * Get by ID
 */
router.get(
    "/:id",
    authenticate,
    controller.getLeaveTypeById
);

/**
 * Update
 */
router.put(
    "/:id",
    authenticate,
    authorizeRoles("ADMIN"),
    controller.updateLeaveType
);

/**
 * Delete
 */
router.delete(
    "/:id",
    authenticate,
    authorizeRoles("ADMIN"),
    controller.deleteLeaveType
);

module.exports = router;