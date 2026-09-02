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


module.exports = {
    login,
    employeeLogin
};