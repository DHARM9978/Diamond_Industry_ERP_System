const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const prisma = require("../config/database");


// ==========================================
// Admin Login
// ==========================================

const loginAdmin = async (email, password) => {

    // 1. Find admin by email
    const admin = await prisma.admin.findUnique({
        where: {
            email: email
        }
    });

    // 2. Admin not found
    if (!admin) {
        const error = new Error("Invalid email or password");
        error.statusCode = 401;
        throw error;
    }

    // 3. Compare password with stored hash
    const passwordMatch = await bcrypt.compare(
        password,
        admin.passwordHash
    );

    // 4. Password incorrect
    if (!passwordMatch) {
        const error = new Error("Invalid email or password");
        error.statusCode = 401;
        throw error;
    }

    // 5. Create JWT payload
    const payload = {
        adminId: admin.adminId,
        companyId: admin.companyId,
        role: "ADMIN"
    };

    // 6. Generate JWT
    const token = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "1d"
        }
    );

    // 7. Return safe admin information
    return {
        token,
        admin: {
            adminId: admin.adminId,
            adminName: admin.adminName,
            email: admin.email,
            companyId: admin.companyId
        }
    };
};

// ==========================================
// Employee Login
// ==========================================

const loginEmployee = async (email, password) => {

    // 1. Find employee by email
    const employee = await prisma.employee.findUnique({
        where: {
            email: email
        }
    });

    // 2. Employee not found
    if (!employee) {
        const error = new Error("Invalid email or password");
        error.statusCode = 401;
        throw error;
    }

    // 3. Check employee account status
    if (employee.status !== "ACTIVE") {
        const error = new Error(
            "Employee account is inactive"
        );

        error.statusCode = 403;
        throw error;
    }

    // 4. Compare password with stored hash
    const passwordMatch = await bcrypt.compare(
        password,
        employee.passwordHash
    );

    // 5. Password incorrect
    if (!passwordMatch) {
        const error = new Error(
            "Invalid email or password"
        );

        error.statusCode = 401;
        throw error;
    }

    // 6. Create employee JWT payload
    const payload = {
        employeeId: employee.employeeId,
        companyId: employee.companyId,
        role: "EMPLOYEE"
    };

    // 7. Generate JWT
    const token = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        {
            expiresIn:
                process.env.JWT_EXPIRES_IN || "1d"
        }
    );

    // 8. Return safe employee information
    return {
        token,

        employee: {
            employeeId: employee.employeeId,
            firstName: employee.firstName,
            lastName: employee.lastName,
            email: employee.email,
            companyId: employee.companyId,
            branchId: employee.branchId,
            departmentId: employee.departmentId,
            status: employee.status
        }
    };
};



module.exports = {
    loginAdmin,
    loginEmployee
};