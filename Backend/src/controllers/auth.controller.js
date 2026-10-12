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
// Admin Profile
// GET /api/auth/admin/profile
// ==========================================

const getAdminProfile = async (req, res) => {

    if (
        !req.user ||
        req.user.role !== "ADMIN"
    ) {
        const error = new Error(
            "Admin authentication is required"
        );

        error.statusCode = 403;

        throw error;
    }

    const result =
        await authService.getAdminProfile(
            req.user.adminId,
            req.user.companyId
        );

    return successResponse(
        res,
        200,
        "Admin profile retrieved successfully",
        result
    );
};


// ==========================================
// Update Admin Profile
// PUT /api/auth/admin/profile
// ==========================================

const updateAdminProfile = async (req, res) => {

    if (
        !req.user ||
        req.user.role !== "ADMIN"
    ) {
        const error = new Error(
            "Admin authentication is required"
        );

        error.statusCode = 403;

        throw error;
    }

    const {
        adminName,
        email,
        phone,
        currentPassword
    } = req.body;

    const profileData = {};

    if (adminName !== undefined) {
        profileData.adminName = adminName;
    }

    if (email !== undefined) {
        profileData.email = email;
    }

    if (phone !== undefined) {
        profileData.phone = phone;
    }

    if (currentPassword !== undefined) {
        profileData.currentPassword = currentPassword;
    }

    const result =
        await authService.updateAdminProfile(
            req.user.adminId,
            req.user.companyId,
            profileData
        );

    return successResponse(
        res,
        200,
        "Admin profile updated successfully",
        result
    );
};


// ==========================================
// Change Admin Password
// PUT /api/auth/admin/change-password
// ==========================================

const changeAdminPassword = async (req, res) => {

    if (
        !req.user ||
        req.user.role !== "ADMIN"
    ) {
        const error = new Error(
            "Admin authentication is required"
        );

        error.statusCode = 403;

        throw error;
    }

    const {
        currentPassword,
        newPassword,
        confirmPassword
    } = req.body;

    if (
        typeof currentPassword !== "string" ||
        !currentPassword
    ) {
        const error = new Error(
            "Current password is required"
        );

        error.statusCode = 400;

        throw error;
    }

    if (
        typeof newPassword !== "string" ||
        !newPassword
    ) {
        const error = new Error(
            "New password is required"
        );

        error.statusCode = 400;

        throw error;
    }

    if (confirmPassword !== undefined && confirmPassword !== newPassword) {
        const error = new Error(
            "New password and confirmation do not match"
        );

        error.statusCode = 400;

        throw error;
    }

    const result =
        await authService.changeAdminPassword(
            req.user.adminId,
            req.user.companyId,
            currentPassword,
            newPassword
        );

    return successResponse(
        res,
        200,
        result.message || "Password changed successfully",
        null
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
    getAdminProfile,
    updateAdminProfile,
    changeAdminPassword,
    forgotPassword,
    resetPassword
};