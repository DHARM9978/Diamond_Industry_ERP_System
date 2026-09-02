const prisma = require("../config/database");

const VALID_STATUSES = ["ACTIVE", "INACTIVE"];

/**
 * Normalize leave code
 */
function normalizeCode(code) {
    return code.trim().toUpperCase();
}

/**
 * Validate Leave Type data
 */
function validateLeaveTypeData(data, isUpdate = false) {
    const errors = [];

    if (!isUpdate && !data.name) {
        errors.push("name is required");
    }

    if (data.name !== undefined) {
        if (
            typeof data.name !== "string" ||
            !data.name.trim()
        ) {
            errors.push("name must be a non-empty string");
        }
    }

    if (!isUpdate && !data.code) {
        errors.push("code is required");
    }

    if (data.code !== undefined) {
        if (
            typeof data.code !== "string" ||
            !data.code.trim()
        ) {
            errors.push("code must be a non-empty string");
        }
    }

    if (
        data.description !== undefined &&
        data.description !== null &&
        typeof data.description !== "string"
    ) {
        errors.push("description must be a string");
    }

    if (data.annualQuota !== undefined) {
        const quota = Number(data.annualQuota);

        if (!Number.isFinite(quota) || quota < 0) {
            errors.push(
                "annualQuota must be a non-negative number"
            );
        }
    }

    const booleanFields = [
        "isPaid",
        "requiresApproval",
        "allowHalfDay",
        "allowCarryForward"
    ];

    for (const field of booleanFields) {
        if (
            data[field] !== undefined &&
            typeof data[field] !== "boolean"
        ) {
            errors.push(`${field} must be a boolean`);
        }
    }

    if (
        data.status !== undefined &&
        !VALID_STATUSES.includes(data.status)
    ) {
        errors.push(
            `status must be one of: ${VALID_STATUSES.join(", ")}`
        );
    }

    return errors;
}

/**
 * Create Leave Type
 */
async function createLeaveType(companyId, data) {
    const company = Number(companyId);

    if (!Number.isInteger(company) || company <= 0) {
        const error = new Error("Invalid company ID");
        error.statusCode = 400;
        throw error;
    }

    const errors = validateLeaveTypeData(data);

    if (errors.length > 0) {
        const error = new Error(errors.join(", "));
        error.statusCode = 400;
        throw error;
    }

    const name = data.name.trim();
    const code = normalizeCode(data.code);

    const existingCode = await prisma.leaveType.findFirst({
        where: {
            companyId: company,
            code
        }
    });

    if (existingCode) {
        const error = new Error(
            "Leave type code already exists for this company"
        );

        error.statusCode = 409;
        throw error;
    }

    const existingName = await prisma.leaveType.findFirst({
        where: {
            companyId: company,
            name
        }
    });

    if (existingName) {
        const error = new Error(
            "Leave type name already exists for this company"
        );

        error.statusCode = 409;
        throw error;
    }

    const leaveType = await prisma.leaveType.create({
        data: {
            companyId: company,
            name,
            code,
            description:
                data.description?.trim() || null,

            annualQuota:
                data.annualQuota !== undefined
                    ? Number(data.annualQuota)
                    : null,

            isPaid:
                data.isPaid !== undefined
                    ? data.isPaid
                    : true,

            requiresApproval:
                data.requiresApproval !== undefined
                    ? data.requiresApproval
                    : true,

            allowHalfDay:
                data.allowHalfDay !== undefined
                    ? data.allowHalfDay
                    : true,

            allowCarryForward:
                data.allowCarryForward !== undefined
                    ? data.allowCarryForward
                    : false,

            status:
                data.status || "ACTIVE"
        }
    });

    return leaveType;
}

/**
 * Get all Leave Types
 */
async function getLeaveTypes(companyId, filters = {}) {
    const company = Number(companyId);

    if (!Number.isInteger(company) || company <= 0) {
        const error = new Error("Invalid company ID");
        error.statusCode = 400;
        throw error;
    }

    const where = {
        companyId: company
    };

    if (filters.status !== undefined) {
        if (!VALID_STATUSES.includes(filters.status)) {
            const error = new Error(
                `status must be one of: ${VALID_STATUSES.join(", ")}`
            );

            error.statusCode = 400;
            throw error;
        }

        where.status = filters.status;
    }

    return await prisma.leaveType.findMany({
        where,
        orderBy: {
            name: "asc"
        }
    });
}

/**
 * Get Leave Type by ID
 */
async function getLeaveTypeById(
    companyId,
    leaveTypeId
) {
    const company = Number(companyId);
    const id = Number(leaveTypeId);

    if (!Number.isInteger(company) || company <= 0) {
        const error = new Error("Invalid company ID");
        error.statusCode = 400;
        throw error;
    }

    if (!Number.isInteger(id) || id <= 0) {
        const error = new Error(
            "Invalid leave type ID"
        );

        error.statusCode = 400;
        throw error;
    }

    const leaveType =
        await prisma.leaveType.findFirst({
            where: {
                leaveTypeId: id,
                companyId: company
            }
        });

    if (!leaveType) {
        const error = new Error(
            "Leave type not found"
        );

        error.statusCode = 404;
        throw error;
    }

    return leaveType;
}

/**
 * Update Leave Type
 */
async function updateLeaveType(
    companyId,
    leaveTypeId,
    data
) {
    const company = Number(companyId);
    const id = Number(leaveTypeId);

    if (!Number.isInteger(company) || company <= 0) {
        const error = new Error("Invalid company ID");
        error.statusCode = 400;
        throw error;
    }

    if (!Number.isInteger(id) || id <= 0) {
        const error = new Error(
            "Invalid leave type ID"
        );

        error.statusCode = 400;
        throw error;
    }

    const errors =
        validateLeaveTypeData(data, true);

    if (errors.length > 0) {
        const error = new Error(errors.join(", "));
        error.statusCode = 400;
        throw error;
    }

    const existing =
        await prisma.leaveType.findFirst({
            where: {
                leaveTypeId: id,
                companyId: company
            }
        });

    if (!existing) {
        const error = new Error(
            "Leave type not found"
        );

        error.statusCode = 404;
        throw error;
    }

    const updateData = {};

    if (data.name !== undefined) {
        const name = data.name.trim();

        const duplicateName =
            await prisma.leaveType.findFirst({
                where: {
                    companyId: company,
                    name,
                    NOT: {
                        leaveTypeId: id
                    }
                }
            });

        if (duplicateName) {
            const error = new Error(
                "Leave type name already exists for this company"
            );

            error.statusCode = 409;
            throw error;
        }

        updateData.name = name;
    }

    if (data.code !== undefined) {
        const code = normalizeCode(data.code);

        const duplicateCode =
            await prisma.leaveType.findFirst({
                where: {
                    companyId: company,
                    code,
                    NOT: {
                        leaveTypeId: id
                    }
                }
            });

        if (duplicateCode) {
            const error = new Error(
                "Leave type code already exists for this company"
            );

            error.statusCode = 409;
            throw error;
        }

        updateData.code = code;
    }

    if (data.description !== undefined) {
        updateData.description =
            data.description?.trim() || null;
    }

    if (data.annualQuota !== undefined) {
        updateData.annualQuota =
            Number(data.annualQuota);
    }

    if (data.isPaid !== undefined) {
        updateData.isPaid = data.isPaid;
    }

    if (data.requiresApproval !== undefined) {
        updateData.requiresApproval =
            data.requiresApproval;
    }

    if (data.allowHalfDay !== undefined) {
        updateData.allowHalfDay =
            data.allowHalfDay;
    }

    if (data.allowCarryForward !== undefined) {
        updateData.allowCarryForward =
            data.allowCarryForward;
    }

    if (data.status !== undefined) {
        updateData.status = data.status;
    }

    return await prisma.leaveType.update({
        where: {
            leaveTypeId: id
        },
        data: updateData
    });
}

/**
 * Delete Leave Type
 */
async function deleteLeaveType(
    companyId,
    leaveTypeId
) {
    const company = Number(companyId);
    const id = Number(leaveTypeId);

    if (!Number.isInteger(company) || company <= 0) {
        const error = new Error("Invalid company ID");
        error.statusCode = 400;
        throw error;
    }

    if (!Number.isInteger(id) || id <= 0) {
        const error = new Error(
            "Invalid leave type ID"
        );

        error.statusCode = 400;
        throw error;
    }

    const existing =
        await prisma.leaveType.findFirst({
            where: {
                leaveTypeId: id,
                companyId: company
            }
        });

    if (!existing) {
        const error = new Error(
            "Leave type not found"
        );

        error.statusCode = 404;
        throw error;
    }

    const balanceCount =
        await prisma.leaveBalance.count({
            where: {
                leaveTypeId: id
            }
        });

    const requestCount =
        await prisma.leaveRequest.count({
            where: {
                leaveTypeId: id
            }
        });

    if (
        balanceCount > 0 ||
        requestCount > 0
    ) {
        const error = new Error(
            "Leave type cannot be deleted because it is already in use. Deactivate it instead."
        );

        error.statusCode = 409;
        throw error;
    }

    await prisma.leaveType.delete({
        where: {
            leaveTypeId: id
        }
    });

    return true;
}

module.exports = {
    createLeaveType,
    getLeaveTypes,
    getLeaveTypeById,
    updateLeaveType,
    deleteLeaveType
};