const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const prisma = require("../config/database");


// ==========================================
// Authentication / Password Reset Constants
// ==========================================

const PASSWORD_RESET_EXPIRES_IN =
    process.env.PASSWORD_RESET_EXPIRES_IN || "10m";

const PASSWORD_RESET_SECRET =
    process.env.PASSWORD_RESET_SECRET ||
    (process.env.JWT_SECRET
        ? `${process.env.JWT_SECRET}:password-reset`
        : null);

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;


// ==========================================
// Utility Helpers
// ==========================================

const createAuthError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const validateNewPassword = (password) => {
    if (typeof password !== "string") {
        throw createAuthError(
            "New password must be a valid string",
            400
        );
    }

    if (
        password.length < MIN_PASSWORD_LENGTH ||
        password.length > MAX_PASSWORD_LENGTH
    ) {
        throw createAuthError(
            `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`,
            400
        );
    }
};

const createPasswordFingerprint = (passwordHash) => {
    return crypto
        .createHash("sha256")
        .update(passwordHash)
        .digest("hex");
};

const createPasswordResetToken = ({
    userId,
    email,
    accountType,
    passwordHash
}) => {
    if (!PASSWORD_RESET_SECRET) {
        throw createAuthError(
            "Password reset is not configured on the server",
            500
        );
    }

    return jwt.sign(
        {
            sub: String(userId),
            email,
            accountType,
            passwordFingerprint:
                createPasswordFingerprint(passwordHash)
        },
        PASSWORD_RESET_SECRET,
        {
            expiresIn: PASSWORD_RESET_EXPIRES_IN
        }
    );
};

const verifyPasswordResetToken = (token) => {
    if (!PASSWORD_RESET_SECRET) {
        throw createAuthError(
            "Password reset is not configured on the server",
            500
        );
    }

    try {
        return jwt.verify(
            token,
            PASSWORD_RESET_SECRET
        );
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            throw createAuthError(
                "Password reset link has expired",
                400
            );
        }

        throw createAuthError(
            "Invalid or expired password reset link",
            400
        );
    }
};

const getSmtpTransporter = () => {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
        throw createAuthError(
            "Email service is not configured on the server",
            500
        );
    }

    return nodemailer.createTransport({
        host,
        port,
        secure:
            String(process.env.SMTP_SECURE || "").toLowerCase() ===
            "true" || port === 465,
        auth: {
            user,
            pass
        }
    });
};

const sendPasswordResetEmail = async (
    email,
    resetToken
) => {
    const frontendUrl =
        process.env.FRONTEND_URL ||
        "http://localhost:5173";

    const resetUrl =
        `${frontendUrl.replace(/\/+$/, "")}` +
        `/reset-password?token=${encodeURIComponent(resetToken)}`;

    const transporter =
        getSmtpTransporter();

    const from =
        process.env.SMTP_FROM ||
        process.env.SMTP_USER;

    if (!from) {
        throw createAuthError(
            "Email sender is not configured on the server",
            500
        );
    }

    await transporter.sendMail({
        from,
        to: email,
        subject: "Diamond ERP - Password Reset",
        text:
            "We received a request to reset your Diamond ERP password.\n\n" +
            `Reset your password using this link:\n${resetUrl}\n\n` +
            "This link expires in 10 minutes.\n\n" +
            "If you did not request this password reset, you can safely ignore this email.",
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #111827;">Diamond ERP</h2>

                <p>We received a request to reset your Diamond ERP password.</p>

                <p style="margin: 24px 0;">
                    <a
                        href="${resetUrl}"
                        style="display: inline-block; padding: 12px 20px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px;"
                    >
                        Reset Password
                    </a>
                </p>

                <p>This link expires in <strong>10 minutes</strong>.</p>

                <p>
                    If you did not request this password reset, you can safely ignore this email.
                </p>

                <p style="color: #6b7280; font-size: 13px;">
                    Diamond ERP - Workforce Management Suite
                </p>
            </div>
        `
    });
};


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


// ==========================================
// Admin Profile
// ==========================================

const getAdminProfile = async (adminId, companyId) => {

    const normalizedAdminId = Number(adminId);
    const normalizedCompanyId = Number(companyId);

    if (
        !Number.isInteger(normalizedAdminId) ||
        normalizedAdminId <= 0 ||
        !Number.isInteger(normalizedCompanyId) ||
        normalizedCompanyId <= 0
    ) {
        throw createAuthError(
            "Invalid admin account",
            400
        );
    }

    const admin =
        await prisma.admin.findFirst({
            where: {
                adminId: normalizedAdminId,
                companyId: normalizedCompanyId
            },
            select: {
                adminId: true,
                adminName: true,
                email: true,
                phone: true,
                companyId: true,
                createdAt: true,
                updatedAt: true
            }
        });

    if (!admin) {
        throw createAuthError(
            "Admin account not found",
            404
        );
    }

    return admin;
};

const updateAdminProfile = async (
    adminId,
    companyId,
    profileData = {}
) => {

    const normalizedAdminId = Number(adminId);
    const normalizedCompanyId = Number(companyId);

    if (
        !Number.isInteger(normalizedAdminId) ||
        normalizedAdminId <= 0 ||
        !Number.isInteger(normalizedCompanyId) ||
        normalizedCompanyId <= 0
    ) {
        throw createAuthError(
            "Invalid admin account",
            400
        );
    }

    if (
        !profileData ||
        typeof profileData !== "object" ||
        Array.isArray(profileData)
    ) {
        throw createAuthError(
            "Invalid profile data",
            400
        );
    }

    const admin =
        await prisma.admin.findFirst({
            where: {
                adminId: normalizedAdminId,
                companyId: normalizedCompanyId
            },
            select: {
                adminId: true,
                adminName: true,
                email: true,
                phone: true,
                passwordHash: true,
                companyId: true
            }
        });

    if (!admin) {
        throw createAuthError(
            "Admin account not found",
            404
        );
    }

    const updateData = {};

    if (profileData.adminName !== undefined) {
        if (typeof profileData.adminName !== "string") {
            throw createAuthError(
                "Admin name must be a valid string",
                400
            );
        }

        const adminName = profileData.adminName.trim();

        if (!adminName) {
            throw createAuthError(
                "Admin name is required",
                400
            );
        }

        if (adminName.length > 100) {
            throw createAuthError(
                "Admin name cannot exceed 100 characters",
                400
            );
        }

        updateData.adminName = adminName;
    }

    if (profileData.email !== undefined) {
        if (typeof profileData.email !== "string") {
            throw createAuthError(
                "Email address must be a valid string",
                400
            );
        }

        const email = profileData.email.trim().toLowerCase();

        if (
            !email ||
            email.length > 150 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            throw createAuthError(
                "Please provide a valid email address",
                400
            );
        }

        if (email !== admin.email.toLowerCase()) {
            if (
                typeof profileData.currentPassword !== "string" ||
                !profileData.currentPassword
            ) {
                throw createAuthError(
                    "Current password is required to change the login email",
                    400
                );
            }

            const passwordMatches =
                await bcrypt.compare(
                    profileData.currentPassword,
                    admin.passwordHash
                );

            if (!passwordMatches) {
                throw createAuthError(
                    "Current password is incorrect",
                    401
                );
            }

            const existingAdmin =
                await prisma.admin.findUnique({
                    where: {
                        email
                    },
                    select: {
                        adminId: true
                    }
                });

            if (
                existingAdmin &&
                existingAdmin.adminId !== admin.adminId
            ) {
                throw createAuthError(
                    "This email address is already in use by another admin",
                    409
                );
            }

            updateData.email = email;
        }
    }

    if (profileData.phone !== undefined) {
        if (
            profileData.phone !== null &&
            typeof profileData.phone !== "string"
        ) {
            throw createAuthError(
                "Phone number must be a valid string",
                400
            );
        }

        const phone =
            typeof profileData.phone === "string"
                ? profileData.phone.trim()
                : "";

        if (phone.length > 20) {
            throw createAuthError(
                "Phone number cannot exceed 20 characters",
                400
            );
        }

        updateData.phone = phone || null;
    }

    if (Object.keys(updateData).length === 0) {
        throw createAuthError(
            "No profile changes were provided",
            400
        );
    }

    try {
        await prisma.admin.update({
            where: {
                adminId: admin.adminId
            },
            data: updateData
        });
    } catch (error) {
        if (error.code === "P2002") {
            throw createAuthError(
                "This email address is already in use by another admin",
                409
            );
        }

        throw error;
    }

    return getAdminProfile(
        admin.adminId,
        admin.companyId
    );
};


// ==========================================
// Admin Change Password
// ==========================================

const changeAdminPassword = async (
    adminId,
    companyId,
    currentPassword,
    newPassword
) => {

    const normalizedAdminId = Number(adminId);
    const normalizedCompanyId = Number(companyId);

    if (
        !Number.isInteger(normalizedAdminId) ||
        normalizedAdminId <= 0 ||
        !Number.isInteger(normalizedCompanyId) ||
        normalizedCompanyId <= 0
    ) {
        throw createAuthError(
            "Invalid admin account",
            400
        );
    }

    if (
        typeof currentPassword !== "string" ||
        !currentPassword
    ) {
        throw createAuthError(
            "Current password is required",
            400
        );
    }

    validateNewPassword(newPassword);

    if (currentPassword === newPassword) {
        throw createAuthError(
            "New password must be different from the current password",
            400
        );
    }

    const admin =
        await prisma.admin.findFirst({
            where: {
                adminId: normalizedAdminId,
                companyId: normalizedCompanyId
            },
            select: {
                adminId: true,
                passwordHash: true
            }
        });

    if (!admin) {
        throw createAuthError(
            "Admin account not found",
            404
        );
    }

    const currentPasswordMatches =
        await bcrypt.compare(
            currentPassword,
            admin.passwordHash
        );

    if (!currentPasswordMatches) {
        throw createAuthError(
            "Current password is incorrect",
            401
        );
    }

    const passwordHash =
        await bcrypt.hash(
            newPassword,
            12
        );

    await prisma.admin.update({
        where: {
            adminId: admin.adminId
        },
        data: {
            passwordHash
        }
    });

    return {
        success: true,
        message: "Password changed successfully"
    };
};


// ==========================================
// Employee Change Password
// ==========================================

const changeEmployeePassword = async (
    employeeId,
    companyId,
    currentPassword,
    newPassword
) => {

    const employee =
        await prisma.employee.findFirst({
            where: {
                employeeId: Number(employeeId),
                companyId: Number(companyId)
            },
            select: {
                employeeId: true,
                passwordHash: true,
                status: true
            }
        });

    if (!employee) {
        const error = new Error(
            "Employee account not found"
        );
        error.statusCode = 404;
        throw error;
    }

    if (employee.status !== "ACTIVE") {
        const error = new Error(
            "Employee account is inactive"
        );
        error.statusCode = 403;
        throw error;
    }

    const currentPasswordMatches =
        await bcrypt.compare(
            currentPassword,
            employee.passwordHash
        );

    if (!currentPasswordMatches) {
        const error = new Error(
            "Current password is incorrect"
        );
        error.statusCode = 401;
        throw error;
    }

    if (currentPassword === newPassword) {
        const error = new Error(
            "New password must be different from the current password"
        );
        error.statusCode = 400;
        throw error;
    }

    validateNewPassword(newPassword);

    const passwordHash =
        await bcrypt.hash(
            newPassword,
            12
        );

    await prisma.employee.update({
        where: {
            employeeId: employee.employeeId
        },
        data: {
            passwordHash
        }
    });

    return {
        success: true
    };
};


// ==========================================
// Forgot Password
// ==========================================
// POST /api/auth/forgot-password
//
// Always returns the same success result whether
// the email exists or not, preventing account
// enumeration from the API response.

const forgotPassword = async (email) => {

    const normalizedEmail =
        typeof email === "string"
            ? email.trim().toLowerCase()
            : "";

    if (!normalizedEmail) {
        throw createAuthError(
            "Email address is required",
            400
        );
    }

    const [admin, employee] =
        await Promise.all([
            prisma.admin.findUnique({
                where: {
                    email: normalizedEmail
                },
                select: {
                    adminId: true,
                    email: true,
                    passwordHash: true
                }
            }),

            prisma.employee.findUnique({
                where: {
                    email: normalizedEmail
                },
                select: {
                    employeeId: true,
                    email: true,
                    passwordHash: true,
                    status: true
                }
            })
        ]);

    // No account: return the same public response.
    if (!admin && !employee) {
        return {
            success: true,
            message:
                "If an account exists with this email, password reset instructions have been sent."
        };
    }

    // Prefer an active employee when an email exists
    // in both account tables. Otherwise prefer admin.
    let accountType;
    let account;

    if (employee && employee.status === "ACTIVE") {
        accountType = "EMPLOYEE";
        account = employee;
    } else if (admin) {
        accountType = "ADMIN";
        account = admin;
    } else {
        return {
            success: true,
            message:
                "If an account exists with this email, password reset instructions have been sent."
        };
    }

    const resetToken =
        createPasswordResetToken({
            userId:
                accountType === "ADMIN"
                    ? account.adminId
                    : account.employeeId,
            email: account.email,
            accountType,
            passwordHash: account.passwordHash
        });

    await sendPasswordResetEmail(
        account.email,
        resetToken
    );

    return {
        success: true,
        message:
            "If an account exists with this email, password reset instructions have been sent."
    };
};


// ==========================================
// Reset Password
// ==========================================
// POST /api/auth/reset-password
//
// Request:
// {
//   token: "...",
//   newPassword: "..."
// }

const resetPassword = async (
    token,
    newPassword
) => {

    if (
        typeof token !== "string" ||
        !token.trim()
    ) {
        throw createAuthError(
            "Password reset token is required",
            400
        );
    }

    validateNewPassword(newPassword);

    const payload =
        verifyPasswordResetToken(
            token.trim()
        );

    const userId =
        Number(payload.sub);

    if (!Number.isInteger(userId) || userId <= 0) {
        throw createAuthError(
            "Invalid or expired password reset link",
            400
        );
    }

    if (
        payload.accountType !== "ADMIN" &&
        payload.accountType !== "EMPLOYEE"
    ) {
        throw createAuthError(
            "Invalid or expired password reset link",
            400
        );
    }

    if (
        typeof payload.email !== "string" ||
        !payload.email
    ) {
        throw createAuthError(
            "Invalid or expired password reset link",
            400
        );
    }

    let account;

    if (payload.accountType === "ADMIN") {
        account =
            await prisma.admin.findFirst({
                where: {
                    adminId: userId,
                    email: payload.email
                },
                select: {
                    adminId: true,
                    email: true,
                    passwordHash: true
                }
            });
    } else {
        account =
            await prisma.employee.findFirst({
                where: {
                    employeeId: userId,
                    email: payload.email
                },
                select: {
                    employeeId: true,
                    email: true,
                    passwordHash: true,
                    status: true
                }
            });

        if (
            account &&
            account.status !== "ACTIVE"
        ) {
            account = null;
        }
    }

    if (!account) {
        throw createAuthError(
            "Invalid or expired password reset link",
            400
        );
    }

    const currentFingerprint =
        createPasswordFingerprint(
            account.passwordHash
        );

    if (
        payload.passwordFingerprint !==
        currentFingerprint
    ) {
        throw createAuthError(
            "Invalid or expired password reset link",
            400
        );
    }

    const samePassword =
        await bcrypt.compare(
            newPassword,
            account.passwordHash
        );

    if (samePassword) {
        throw createAuthError(
            "New password must be different from the current password",
            400
        );
    }

    const passwordHash =
        await bcrypt.hash(
            newPassword,
            12
        );

    if (payload.accountType === "ADMIN") {
        await prisma.admin.update({
            where: {
                adminId: account.adminId
            },
            data: {
                passwordHash
            }
        });
    } else {
        await prisma.employee.update({
            where: {
                employeeId: account.employeeId
            },
            data: {
                passwordHash
            }
        });
    }

    return {
        success: true,
        message:
            "Password reset successfully"
    };
};


module.exports = {
    loginAdmin,
    loginEmployee,
    getAdminProfile,
    updateAdminProfile,
    changeAdminPassword,
    changeEmployeePassword,
    forgotPassword,
    resetPassword
};