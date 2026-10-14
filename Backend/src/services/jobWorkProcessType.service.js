
const prisma = require("../config/database");

const VALID_STATUSES = ["ACTIVE", "INACTIVE"];

const VALID_CHARGE_UNITS = [
    "PER_CARAT",
    "PER_PIECE",
    "PER_GRAM",
    "PER_JOB"
];

// ============================================================
// HELPERS
// ============================================================

function createError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function getCompanyId(companyId) {
    const id = Number(companyId);

    if (!Number.isInteger(id) || id < 1) {
        throw createError("Invalid company ID", 400);
    }

    return id;
}

function getProcessTypeId(processTypeId) {
    const id = Number(processTypeId);

    if (!Number.isInteger(id) || id < 1) {
        throw createError("Invalid processing type ID", 400);
    }

    return id;
}

function normalizeOptionalText(value) {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== "string") {
        throw createError("Optional text fields must be strings or null", 400);
    }

    return value.trim() || null;
}

function validateInputObject(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw createError("Request body must be an object", 400);
    }
}

function handlePrismaError(error) {
    if (error?.code === "P2002") {
        return createError(
            "A processing type with this code or name already exists for your company",
            409
        );
    }

    if (error?.code === "P2025") {
        return createError("Processing type not found", 404);
    }

    return error;
}

// ============================================================
// BUILD AND VALIDATE CREATE/UPDATE DATA
// ============================================================

function buildProcessTypeData(input, isUpdate = false, existing = null) {
    validateInputObject(input);

    const data = {};

    // Process code
    if (!isUpdate || input.code !== undefined) {
        if (typeof input.code !== "string") {
            throw createError("Process code is required", 400);
        }

        const code = input.code.trim().toUpperCase();

        if (!code) {
            throw createError("Process code is required", 400);
        }

        if (code.length > 30) {
            throw createError(
                "Process code cannot exceed 30 characters",
                400
            );
        }

        if (!/^[A-Z0-9_-]+$/.test(code)) {
            throw createError(
                "Process code may contain only letters, numbers, hyphens and underscores",
                400
            );
        }

        data.code = code;
    }

    // Processing type name
    if (!isUpdate || input.name !== undefined) {
        if (typeof input.name !== "string") {
            throw createError("Processing type name is required", 400);
        }

        const name = input.name.trim();

        if (!name) {
            throw createError("Processing type name is required", 400);
        }

        if (name.length > 100) {
            throw createError(
                "Processing type name cannot exceed 100 characters",
                400
            );
        }

        data.name = name;
    }

    // Description
    if (input.description !== undefined) {
        const description = normalizeOptionalText(input.description);

        if (description && description.length > 5000) {
            throw createError(
                "Description cannot exceed 5000 characters",
                400
            );
        }

        data.description = description;
    }

    // Charge unit
    if (input.chargeUnit !== undefined) {
        if (input.chargeUnit === null || input.chargeUnit === "") {
            data.chargeUnit = null;
        } else {
            if (typeof input.chargeUnit !== "string") {
                throw createError("Invalid charge unit", 400);
            }

            const chargeUnit = input.chargeUnit.trim().toUpperCase();

            if (!VALID_CHARGE_UNITS.includes(chargeUnit)) {
                throw createError(
                    `Charge unit must be one of: ${VALID_CHARGE_UNITS.join(", ")}`,
                    400
                );
            }

            data.chargeUnit = chargeUnit;
        }
    }

    // Default rate: use a decimal string to avoid unnecessary
    // floating-point conversion before Prisma writes the value.
    if (input.defaultRate !== undefined) {
        if (input.defaultRate === null || input.defaultRate === "") {
            data.defaultRate = null;
        } else {
            if (
                typeof input.defaultRate !== "string" &&
                typeof input.defaultRate !== "number"
            ) {
                throw createError("Invalid default rate", 400);
            }

            const rateText = String(input.defaultRate).trim();

            if (!/^\d+(\.\d{1,2})?$/.test(rateText)) {
                throw createError(
                    "Default rate must be non-negative with at most two decimal places",
                    400
                );
            }

            const rate = Number(rateText);

            if (!Number.isFinite(rate) || rate > 9999999999.99) {
                throw createError(
                    "Default rate is outside the supported range",
                    400
                );
            }

            data.defaultRate = rateText;
        }
    }

    if (isUpdate && Object.keys(data).length === 0) {
        throw createError(
            "Provide at least one valid field to update",
            400
        );
    }

    // A configured rate must have a charge unit.
    const effectiveRate =
        data.defaultRate !== undefined
            ? data.defaultRate
            : existing?.defaultRate;

    const effectiveChargeUnit =
        data.chargeUnit !== undefined
            ? data.chargeUnit
            : existing?.chargeUnit;

    const hasRate =
        effectiveRate !== null &&
        effectiveRate !== undefined &&
        String(effectiveRate) !== "";

    if (hasRate && !effectiveChargeUnit) {
        throw createError(
            "Select a charge unit when setting a default rate",
            400
        );
    }

    return data;
}

// ============================================================
// FIND A TYPE WITH COMPANY OWNERSHIP CHECK
// ============================================================

async function findProcessType(companyId, processTypeId) {
    const company = getCompanyId(companyId);
    const id = getProcessTypeId(processTypeId);

    const processType = await prisma.jobWorkProcessType.findFirst({
        where: {
            companyId: company,
            processTypeId: id
        }
    });

    if (!processType) {
        throw createError("Processing type not found", 404);
    }

    return processType;
}

// ============================================================
// CREATE PROCESSING TYPE
// ============================================================

async function createProcessType(companyId, input) {
    const company = getCompanyId(companyId);
    const data = buildProcessTypeData(input);

    try {
        return await prisma.jobWorkProcessType.create({
            data: {
                ...data,
                companyId: company,
                isActive: true
            }
        });
    } catch (error) {
        throw handlePrismaError(error);
    }
}

// ============================================================
// GET ALL PROCESSING TYPES
// Supports filters.search and filters.status
// ============================================================

async function getProcessTypes(companyId, filters = {}) {
    const company = getCompanyId(companyId);

    const where = {
        companyId: company
    };

    if (filters.status !== undefined && filters.status !== "") {
        const status = String(filters.status).trim().toUpperCase();

        if (!VALID_STATUSES.includes(status)) {
            throw createError(
                "Status must be ACTIVE or INACTIVE",
                400
            );
        }

        // The Prisma schema uses Boolean isActive, not a status string.
        where.isActive = status === "ACTIVE";
    }

    if (filters.search !== undefined && filters.search !== null) {
        const search = String(filters.search).trim();

        if (search) {
            where.OR = [
                { code: { contains: search } },
                { name: { contains: search } },
                { description: { contains: search } },
                { chargeUnit: { contains: search } }
            ];
        }
    }

    return prisma.jobWorkProcessType.findMany({
        where,
        orderBy: [
            { name: "asc" },
            { processTypeId: "asc" }
        ]
    });
}

// ============================================================
// GET PROCESSING TYPE BY ID
// ============================================================

async function getProcessTypeById(companyId, processTypeId) {
    return findProcessType(companyId, processTypeId);
}

// ============================================================
// UPDATE PROCESSING TYPE
// ============================================================

async function updateProcessType(companyId, processTypeId, input) {
    const company = getCompanyId(companyId);
    const id = getProcessTypeId(processTypeId);

    const existing = await findProcessType(company, id);
    const data = buildProcessTypeData(input, true, existing);

    try {
        // updateMany permits company-scoped updates so that an ID
        // belonging to another company cannot be modified.
        const result = await prisma.jobWorkProcessType.updateMany({
            where: {
                companyId: company,
                processTypeId: id
            },
            data
        });

        if (result.count !== 1) {
            throw createError("Processing type not found", 404);
        }

        return findProcessType(company, id);
    } catch (error) {
        throw handlePrismaError(error);
    }
}

// ============================================================
// ACTIVATE / DEACTIVATE
// ============================================================

async function updateProcessTypeStatus(companyId, processTypeId, status) {
    const company = getCompanyId(companyId);
    const id = getProcessTypeId(processTypeId);

    const normalizedStatus = String(status || "")
        .trim()
        .toUpperCase();

    if (!VALID_STATUSES.includes(normalizedStatus)) {
        throw createError(
            "Status must be ACTIVE or INACTIVE",
            400
        );
    }

    await findProcessType(company, id);

    await prisma.jobWorkProcessType.updateMany({
        where: {
            companyId: company,
            processTypeId: id
        },
        data: {
            isActive: normalizedStatus === "ACTIVE"
        }
    });

    return findProcessType(company, id);
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    createProcessType,
    getProcessTypes,
    getProcessTypeById,
    updateProcessType,
    updateProcessTypeStatus
};
