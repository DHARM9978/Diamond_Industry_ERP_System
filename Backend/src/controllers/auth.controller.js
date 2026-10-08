const authService = require("../services/auth.service");
const { successResponse } = require("../utils/apiResponse");


// ==========================================
// Admin Login
// ==========================================

const login = async (req, res) => {

    const { email, password } = req.body;

    const result = await authService.loginAdmin(
        email,
        password
    );

    return successResponse(
        res,
        200,
        "Login successful",
        result
    );
};


// ==========================================
// Employee Login
// ==========================================

const employeeLogin = async (req, res) => {

    const { email, password } = req.body;

    const result = await authService.loginEmployee(
        email,
        password
    );

    return successResponse(
        res,
        200,
        "Employee login successful",
        result
    );
};


// ==========================================
// Forgot Password
// POST /api/auth/forgot-password
// ==========================================

const forgotPassword = async (req, res) => {

    const { email } = req.body;

    const result =
        await authService.forgotPassword(
            email
        );

    return successResponse(
        res,
        200,
        result.message,
        null
    );
};


// ==========================================
// Reset Password
// POST /api/auth/reset-password
// ==========================================

const resetPassword = async (req, res) => {

    const {
        token,
        newPassword
    } = req.body;

    const result =
        await authService.resetPassword(
            token,
            newPassword
        );

    return successResponse(
        res,
        200,
        result.message,
        null
    );
};


module.exports = {
    login,
    employeeLogin,
    forgotPassword,
    resetPassword
};