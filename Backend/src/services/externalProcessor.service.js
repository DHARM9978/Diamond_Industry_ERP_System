
const prisma = require("../config/database");

const VALID_STATUSES = ["ACTIVE", "INACTIVE"];

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

function createError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;

    return error;
}

function validateCompanyId(companyId) {
    const company = Number(companyId);

    if (!Number.isInteger(company) || company <= 0) {
        throw createError("Invalid company ID", 400);
    }

    return company;
}

function validateProcessorId(processorId) {
    const id = Number(processorId);

    if (!Number.isInteger(id) || id <= 0) {
        throw createError("Invalid external processor ID", 400);
    }

    return id;
}

function normalizeProcessorCode(code) {
    return code.trim().toUpperCase();
}

function normalizeOptionalString(value) {
    if (value === null || value === undefined) {
        return null;
    }

    return value.trim() || null;
}

function validateOptionalString(
    data,
    field,
    errors,
    maxLength
) {
    if (
        data[field] !== undefined &&
        data[field] !== null
    ) {
        if (typeof data[field] !== "string") {
            errors.push(`${field} must be a string or null`);
            return;
        }

        if (data[field].length > maxLength) {
            errors.push(
                `${field} cannot exceed ${maxLength} characters`
            );
        }
    }
}

function validateProcessorData(data = {}, isUpdate = false) {
    const errors = [];

    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw createError(
            "Request data must be an object",
            400
        );
    }

    if (!isUpdate && !data.processorCode) {
        errors.push("processorCode is required");
    }

    if (!isUpdate && !data.name) {
        errors.push("name is required");
    }

    if (data.processorCode !== undefined) {
        if (
            typeof data.processorCode !== "string" ||
            !data.processorCode.trim()
        ) {
            errors.push(
                "processorCode must be a non-empty string"
            );
        } else if (data.processorCode.trim().length > 30) {
            errors.push(
                "processorCode cannot exceed 30 characters"
            );
        }
    }

    if (data.name !== undefined) {
        if (
            typeof data.name !== "string" ||
            !data.name.trim()
        ) {
            errors.push(
                "name must be a non-empty string"
            );
        } else if (data.name.trim().length > 150) {
            errors.push(
                "name cannot exceed 150 characters"
            );
        }
    }

    validateOptionalString(data, "contactPerson", errors, 100);
    validateOptionalString(data, "phone", errors, 20);
    validateOptionalString(data, "email", errors, 150);
    validateOptionalString(data, "address", errors, 10000);
    validateOptionalString(data, "gstin", errors, 20);
    validateOptionalString(data, "pan", errors, 10);
    validateOptionalString(data, "paymentTerms", errors, 100);
    validateOptionalString(data, "notes", errors, 10000);

    if (
        typeof data.email === "string" &&
        data.email.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())
    ) {
        errors.push("email must be a valid email address");
    }

    if (data.status !== undefined) {
        if (!VALID_STATUSES.includes(data.status)) {
            errors.push(
                `status must be one of: ${VALID_STATUSES.join(", ")}`
            );
        }
    }

    return errors;
}

function buildProcessorData(data, isUpdate = false) {
    const result = {};

    if (data.processorCode !== undefined) {
        result.processorCode =
            normalizeProcessorCode(data.processorCode);
    }

    if (data.name !== undefined) {
        result.name = data.name.trim();
    }

    const optionalFields = [
        "contactPerson",
        "phone",
        "email",
        "address",
        "gstin",
        "pan",
        "paymentTerms",
        "notes"
    ];

    for (const field of optionalFields) {
        if (data[field] !== undefined) {
            const value = normalizeOptionalString(data[field]);

            if (field === "email" || field === "gstin" || field === "pan") {
                result[field] = value ? value.toUpperCase() : null;

                if (field === "email" && value) {
                    result[field] = value;
                }
            } else {
                result[field] = value;
            }
        }
    }

    if (!isUpdate) {
        result.status = "ACTIVE";
    }

    return result;
}

function handlePrismaError(error) {
    if (error?.code === "P2002") {
        return createError(
            "An external processor with this code already exists for your company",
            409
        );
    }

    return error;
}

async function verifyProcessor(companyId, processorId, client = prisma) {
    const company = validateCompanyId(companyId);
    const id = validateProcessorId(processorId);

    const processor = await client.externalProcessor.findFirst({
        where: {
            externalProcessorId: id,
            companyId: company
        }
    });

    if (!processor) {
        throw createError("External processor not found", 404);
    }

    return processor;
}

/**
 * ============================================================
 * CREATE EXTERNAL PROCESSOR
 * ============================================================
 */

async function createExternalProcessor(companyId, data) {
    const company = validateCompanyId(companyId);

    const errors = validateProcessorData(data);

    if (errors.length > 0) {
        throw createError(errors.join(", "), 400);
    }

    const processorData = buildProcessorData(data);

    try {
        return await prisma.externalProcessor.create({
            data: {
                ...processorData,
                companyId: company
            }
        });
    } catch (error) {
        throw handlePrismaError(error);
    }
}

/**
 * ============================================================
 * GET ALL EXTERNAL PROCESSORS
 * ============================================================
 *
 * Supports:
 *   filters.search
 *   filters.status
 */

async function getExternalProcessors(companyId, filters = {}) {
    const company = validateCompanyId(companyId);

    const where = {
        companyId: company
    };

    if (filters.status !== undefined) {
        if (!VALID_STATUSES.includes(filters.status)) {
            throw createError(
                `status must be one of: ${VALID_STATUSES.join(", ")}`,
                400
            );
        }

        where.status = filters.status;
    }

    if (
        filters.search !== undefined &&
        filters.search !== null &&
        String(filters.search).trim()
    ) {
        const search = String(filters.search).trim();

        where.OR = [
            {
                name: {
                    contains: search
                }
            },
            {
                processorCode: {
                    contains: search
                }
            },
            {
                contactPerson: {
                    contains: search
                }
            },
            {
                phone: {
                    contains: search
                }
            },
            {
                email: {
                    contains: search
                }
            }
        ];
    }

    return await prisma.externalProcessor.findMany({
        where,
        orderBy: [
            {
                name: "asc"
            },
            {
                externalProcessorId: "asc"
            }
        ]
    });
}

/**
 * ============================================================
 * GET EXTERNAL PROCESSOR BY ID
 * ============================================================
 */

async function getExternalProcessorById(
    companyId,
    processorId
) {
    return await verifyProcessor(companyId, processorId);
}

/**
 * ============================================================
 * UPDATE EXTERNAL PROCESSOR
 * ============================================================
 *
 * Status is managed by a separate status endpoint.
 */

async function updateExternalProcessor(
    companyId,
    processorId,
    data
) {
    const company = validateCompanyId(companyId);
    const id = validateProcessorId(processorId);

    const errors = validateProcessorData(data, true);

    if (errors.length > 0) {
        throw createError(errors.join(", "), 400);
    }

    const editableFields = [
        "processorCode",
        "name",
        "contactPerson",
        "phone",
        "email",
        "address",
        "gstin",
        "pan",
        "paymentTerms",
        "notes"
    ];

    const hasEditableField = editableFields.some(
        (field) => data[field] !== undefined
    );

    if (!hasEditableField) {
        throw createError(
            "Provide at least one field to update",
            400
        );
    }

    await verifyProcessor(company, id);

    const updateData = buildProcessorData(data, true);

    try {
        return await prisma.externalProcessor.update({
            where: {
                externalProcessorId: id
            },
            data: updateData
        });
    } catch (error) {
        throw handlePrismaError(error);
    }
}

/**
 * ============================================================
 * UPDATE EXTERNAL PROCESSOR STATUS
 * ============================================================
 *
 * Existing processor records are retained.
 * Inactive processors cannot be selected for new jobs by
 * the job creation service.
 */

async function updateExternalProcessorStatus(
    companyId,
    processorId,
    status
) {
    const company = validateCompanyId(companyId);
    const id = validateProcessorId(processorId);

    if (!VALID_STATUSES.includes(status)) {
        throw createError(
            `status must be one of: ${VALID_STATUSES.join(", ")}`,
            400
        );
    }

    await verifyProcessor(company, id);

    return await prisma.externalProcessor.update({
        where: {
            externalProcessorId: id
        },
        data: {
            status: status
        }
    });
}

/**
 * ============================================================
 * GET JOBS FOR AN EXTERNAL PROCESSOR
 * ============================================================
 *
 * Returns job history belonging to the authenticated company.
 * No inventory balances or packet-location information is used.
 */

async function getExternalProcessorJobs(
    companyId,
    processorId,
    filters = {}
) {
    const company = validateCompanyId(companyId);
    const id = validateProcessorId(processorId);

    await verifyProcessor(company, id);

    const where = {
        companyId: company,
        externalProcessorId: id
    };

    if (filters.status !== undefined) {
        const validJobStatuses = [
            "OPEN",
            "PARTIALLY_RETURNED",
            "AWAITING_RECONCILIATION",
            "COMPLETED",
            "CANCELLED"
        ];

        if (!validJobStatuses.includes(filters.status)) {
            throw createError(
                `status must be one of: ${validJobStatuses.join(", ")}`,
                400
            );
        }

        where.status = filters.status;
    }

    return await prisma.jobWorkOrder.findMany({
        where,
        include: {
            processType: true,
            branch: {
                select: {
                    branchId: true,
                    branchName: true
                }
            },
            dispatches: {
                include: {
                    receipts: {
                        include: {
                            items: true
                        },
                        orderBy: {
                            receivedDate: "desc"
                        }
                    }
                },
                orderBy: {
                    dispatchDate: "desc"
                }
            }
        },
        orderBy: [
            {
                orderDate: "desc"
            },
            {
                jobWorkOrderId: "desc"
            }
        ]
    });
}

module.exports = {
    createExternalProcessor,
    getExternalProcessors,
    getExternalProcessorById,
    updateExternalProcessor,
    updateExternalProcessorStatus,
    getExternalProcessorJobs
};
