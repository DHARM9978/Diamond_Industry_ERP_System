const express = require("express");

const router = express.Router();

const controller =
    require("../controllers/leaveBalance.controller");

const authenticate =
    require("../middleware/auth.middleware");

const authorizeRoles =
    require("../middleware/authorization.middleware");

/**
 * Create Leave Balance
 * Admin only
 */
router.post(
    "/",
    authenticate,
    authorizeRoles("ADMIN"),
    controller.createLeaveBalance
);

/**
 * Get Leave Balances
 */
router.get(
    "/",
    authenticate,
    controller.getLeaveBalances
);

/**
 * Get Leave Balance by ID
 */
router.get(
    "/:id",
    authenticate,
    controller.getLeaveBalanceById
);

/**
 * Update Leave Balance
 * Admin only
 */
router.put(
    "/:id",
    authenticate,
    authorizeRoles("ADMIN"),
    controller.updateLeaveBalance
);

module.exports = router;