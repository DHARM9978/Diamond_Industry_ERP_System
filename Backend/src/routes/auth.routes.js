const express = require("express");

const authController = require("../controllers/auth.controller");
const asyncHandler = require("../utils/asyncHandler");
const authenticate = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/authorization.middleware");

const router = express.Router();


// ==========================================
// Admin Login
// POST /api/auth/login
// ==========================================

router.post(
    "/login",
    asyncHandler(authController.login)
);


// ==========================================
// Employee Login
// POST /api/auth/employee/login
// ==========================================

router.post(
    "/employee/login",
    asyncHandler(authController.employeeLogin)
);


// ==========================================
// Forgot Password
// POST /api/auth/forgot-password
// ==========================================
// Public route.
// No JWT authentication is required because
// the user may not be logged in.

router.post(
    "/forgot-password",
    asyncHandler(authController.forgotPassword)
);


// ==========================================
// Reset Password
// POST /api/auth/reset-password
// ==========================================
// Public route.
// The reset token itself is used for verification.

router.post(
    "/reset-password",
    asyncHandler(authController.resetPassword)
);


// ==========================================
// Protected Test Route
// GET /api/auth/me
// ==========================================

router.get(
    "/me",
    authenticate,
    (req, res) => {

        res.status(200).json({
            success: true,
            message: "Authentication successful",
            user: req.user
        });

    }
);


// ==========================================
// Admin Test Route
// GET /api/auth/admin-test
// ==========================================

router.get(
    "/admin-test",
    authenticate,
    authorizeRoles("ADMIN"),
    (req, res) => {

        res.status(200).json({
            success: true,
            message: "Admin authorization successful",
            user: req.user
        });

    }
);


// ==========================================
// Admin Profile
// GET /api/auth/admin/profile
// ==========================================

router.get(
    "/admin/profile",
    authenticate,
    authorizeRoles("ADMIN"),
    asyncHandler(authController.getAdminProfile)
);


// ==========================================
// Update Admin Profile
// PUT /api/auth/admin/profile
// ==========================================

router.put(
    "/admin/profile",
    authenticate,
    authorizeRoles("ADMIN"),
    asyncHandler(authController.updateAdminProfile)
);


// ==========================================
// Change Admin Password
// PUT /api/auth/admin/change-password
// ==========================================

router.put(
    "/admin/change-password",
    authenticate,
    authorizeRoles("ADMIN"),
    asyncHandler(authController.changeAdminPassword)
);


module.exports = router;