const prisma = require("../config/database");

const VALID_STATUSES = ["ACTIVE", "INACTIVE"];

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

/**
 * Normalize leave code
 */
function normalizeCode(code) {
    return code.trim().toUpperCase();
}

/**
 * Validate Leave Type data
 */
function validateLeaveTypeData(data = {}, isUpdate = false) {
    const errors = [];

    if (!isUpdate && !data.name) {
        errors.push("name is required");
    }

    if (data.name !== undefined) {
        if (
            typeof data.name !== "string" ||
            !data.name.trim()
        ) {
            errors.push(
                "name must be a non-empty string"
            );
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
            errors.push(
                "code must be a non-empty string"
            );
        }
    }

    if (
        data.description !== undefined &&
        data.description !== null &&
        typeof data.description !== "string"
    ) {
        errors.push(
            "description must be a string"
        );
    }

    if (data.annualQuota !== undefined) {
        const quota = Number(data.annualQuota);

        if (
            !Number.isFinite(quota) ||
            quota <= 0
        ) {
            errors.push(
                "annualQuota must be greater than zero"
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
            errors.push(
                `${field} must be a boolean`
            );
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
 * ============================================================
 * CREATE LEAVE TYPE
 * ============================================================
 *
 * Client-created leave types are always quota-controlled.
 *
 * The system-default Casual Leave is created separately by
 * the migration and cannot be created through this API.
 */
async function createLeaveType(
    companyId,
    data
) {
    const company = Number(companyId);

    if (
        !Number.isInteger(company) ||
        company <= 0
    ) {
        const error = new Error(
            "Invalid company ID"
        );

        error.statusCode = 400;
        throw error;
    }

    const errors =
        validateLeaveTypeData(data);

    if (errors.length > 0) {
        const error = new Error(
            errors.join(", ")
        );

        error.statusCode = 400;
        throw error;
    }

    if (
        data.annualQuota === undefined ||
        data.annualQuota === null ||
        data.annualQuota === ""
    ) {
        const error = new Error(
            "annualQuota is required for client-created leave types"
        );

        error.statusCode = 400;
        throw error;
    }

    const name = data.name.trim();
    const code = normalizeCode(data.code);
    const annualQuota = Number(
        data.annualQuota
    );

    const existingCode =
        await prisma.leaveType.findFirst({
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

    const existingName =
        await prisma.leaveType.findFirst({
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

    const leaveType =
        await prisma.leaveType.create({
            data: {
                companyId: company,

                name,

                code,

                description:
                    data.description?.trim() || null,

                annualQuota,

                // Client-created leave types must
                // always be normal/client leave types.
                isSystemDefault: false,

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
 * ============================================================
 * GET ALL LEAVE TYPES
 * ============================================================
 *
 * The system-default Casual Leave is returned here because
 * employees need it when the company has no client-created
 * leave types.
 */
async function getLeaveTypes(
    companyId,
    filters = {}
) {
    const company = Number(companyId);

    if (
        !Number.isInteger(company) ||
        company <= 0
    ) {
        const error = new Error(
            "Invalid company ID"
        );

        error.statusCode = 400;
        throw error;
    }

    const where = {
        companyId: company
    };

    if (filters.status !== undefined) {
        if (
            !VALID_STATUSES.includes(
                filters.status
            )
        ) {
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
 * ============================================================
 * GET LEAVE TYPE BY ID
 * ============================================================
 */
async function getLeaveTypeById(
    companyId,
    leaveTypeId
) {
    const company = Number(companyId);
    const id = Number(leaveTypeId);

    if (
        !Number.isInteger(company) ||
        company <= 0
    ) {
        const error = new Error(
            "Invalid company ID"
        );

        error.statusCode = 400;
        throw error;
    }

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
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
 * ============================================================
 * UPDATE LEAVE TYPE
 * ============================================================
 *
 * System-default Casual Leave is managed by the system and
 * cannot be changed through the client leave-type API.
 */
async function updateLeaveType(
    companyId,
    leaveTypeId,
    data
) {
    const company = Number(companyId);
    const id = Number(leaveTypeId);

    if (
        !Number.isInteger(company) ||
        company <= 0
    ) {
        const error = new Error(
            "Invalid company ID"
        );

        error.statusCode = 400;
        throw error;
    }

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        const error = new Error(
            "Invalid leave type ID"
        );

        error.statusCode = 400;
        throw error;
    }

    const errors =
        validateLeaveTypeData(
            data,
            true
        );

    if (errors.length > 0) {
        const error = new Error(
            errors.join(", ")
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

    if (
        existing.isSystemDefault === true
    ) {
        const error = new Error(
            "System default Casual Leave cannot be modified"
        );

        error.statusCode = 403;
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
        const code =
            normalizeCode(data.code);

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
        updateData.isPaid =
            data.isPaid;
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
        updateData.status =
            data.status;
    }

    return await prisma.leaveType.update({
        where: {
            leaveTypeId: id
        },

        data: updateData
    });
}


/**
 * ============================================================
 * DELETE LEAVE TYPE
 * ============================================================
 *
 * Business rules:
 *
 * 1. System-default Casual Leave cannot be deleted.
 *
 * 2. If the client-created leave type has any leave request,
 *    it cannot be deleted because request history must remain.
 *
 * 3. Automatically-created LeaveBalance rows with used = 0
 *    do not prevent deletion.
 *
 * 4. If a LeaveBalance contains actual used leave, deletion
 *    is blocked and the leave type must be deactivated instead.
 *
 * 5. Unused balance rows are removed in the same transaction
 *    before deleting the leave type.
 *
 * 6. The balance cleanup and leave-type deletion are atomic:
 *    if either operation fails, neither operation is committed.
 */
async function deleteLeaveType(
    companyId,
    leaveTypeId
) {
    const company = Number(companyId);
    const id = Number(leaveTypeId);

    if (!Number.isInteger(company) || company <= 0) {
        const error = new Error(
            "Invalid company ID"
        );

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

    return await prisma.$transaction(async (tx) => {
        const existing =
            await tx.leaveType.findFirst({
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

        /**
         * System fallback is permanent.
         */
        if (existing.isSystemDefault === true) {
            const error = new Error(
                "System default Casual Leave cannot be deleted"
            );

            error.statusCode = 403;
            throw error;
        }

        /**
         * Any existing leave request means the leave type
         * has historical usage and must be retained.
         */
        const requestCount =
            await tx.leaveRequest.count({
                where: {
                    leaveTypeId: id
                }
            });

        if (requestCount > 0) {
            const error = new Error(
                "Leave type cannot be deleted because it has leave request history. Deactivate it instead."
            );

            error.statusCode = 409;
            throw error;
        }

        /**
         * Automatically-created balances with used = 0 are not
         * historical usage and can therefore be cleaned up.
         *
         * A balance with used > 0 means employees have actually
         * consumed this leave type, so deletion would destroy
         * meaningful balance history.
         */
        const usedBalance =
            await tx.leaveBalance.findFirst({
                where: {
                    leaveTypeId: id,
                    used: {
                        gt: 0
                    }
                },
                select: {
                    leaveBalanceId: true
                }
            });

        if (usedBalance) {
            const error = new Error(
                "Leave type cannot be deleted because leave has already been used. Deactivate it instead."
            );

            error.statusCode = 409;
            throw error;
        }

        /**
         * Remove unused automatically-created balances first so
         * the LeaveType foreign-key constraint is satisfied.
         */
        await tx.leaveBalance.deleteMany({
            where: {
                leaveTypeId: id,
                used: {
                    equals: 0
                }
            }
        });

        await tx.leaveType.delete({
            where: {
                leaveTypeId: id
            }
        });

        return true;
    });
}

module.exports = {
    createLeaveType,
    getLeaveTypes,
    getLeaveTypeById,
    updateLeaveType,
    deleteLeaveType
};