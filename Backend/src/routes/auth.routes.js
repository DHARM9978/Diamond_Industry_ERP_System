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


module.exports = router;