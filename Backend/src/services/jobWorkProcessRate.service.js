const prisma = require("../config/database");

const VALID_CHARGE_UNITS = [
    "PER_CARAT",
    "PER_PIECE",
    "PER_GRAM",
    "PER_JOB"
];

const MAX_RATE = 9999999999.99;

// ============================================================
// HELPERS
// ============================================================

function createError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function getPositiveInteger(value, fieldName) {
    const id = Number(value);

    if (!Number.isInteger(id) || id < 1) {
        throw createError(`Invalid ${fieldName}`, 400);
    }

    return id;
}

function getCompanyId(companyId) {
    return getPositiveInteger(companyId, "company ID");
}

function getProcessRateId(processRateId) {
    return getPositiveInteger(processRateId, "process rate ID");
}

function validateInputObject(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw createError("Request body must be an object", 400);
    }
}

// ============================================================
// MONTH VALIDATION
//
// Accepts YYYY-MM or YYYY-MM-DD.
// Every rate is stored against the first day of its month.
// Example: 2026-10 becomes 2026-10-01.
// ============================================================

function normalizeRateMonth(value) {
    if (typeof value !== "string") {
        throw createError(
            "Rate month is required in YYYY-MM format",
            400
        );
    }

    const input = value.trim();

    const match = input.match(
        /^(\d{4})-(\d{2})(?:-(\d{2}))?$/
    );

    if (!match) {
        throw createError(
            "Invalid rate month. Use YYYY-MM or YYYY-MM-DD",
            400
        );
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = match[3] === undefined
        ? 1
        : Number(match[3]);

    if (year < 1000 || year > 9999 || month < 1 || month > 12) {
        throw createError("Invalid rate month", 400);
    }

    const daysInMonth = new Date(
        Date.UTC(year, month, 0)
    ).getUTCDate();

    if (day < 1 || day > daysInMonth) {
        throw createError("Invalid rate month date", 400);
    }

    return new Date(Date.UTC(year, month - 1, 1));
}

// ============================================================
// RATE VALIDATION
// ============================================================

function normalizeChargeUnit(value) {
    if (typeof value !== "string") {
        throw createError("Charge unit is required", 400);
    }

    const chargeUnit = value.trim().toUpperCase();

    if (!VALID_CHARGE_UNITS.includes(chargeUnit)) {
        throw createError(
            `Charge unit must be one of: ${VALID_CHARGE_UNITS.join(", ")}`,
            400
        );
    }

    return chargeUnit;
}

function normalizeRate(value) {
    if (
        typeof value !== "string" &&
        typeof value !== "number"
    ) {
        throw createError("Rate is required", 400);
    }

    const rateText = String(value).trim();

    if (!/^\d+(?:\.\d{1,2})?$/.test(rateText)) {
        throw createError(
            "Rate must be non-negative with at most two decimal places",
            400
        );
    }

    const rate = Number(rateText);

    if (!Number.isFinite(rate) || rate > MAX_RATE) {
        throw createError(
            "Rate is outside the supported range",
            400
        );
    }

    // Preserve the decimal representation when passing the rate
    // to Prisma rather than performing arithmetic with floats.
    return rateText;
}

// ============================================================
// PRISMA ERROR HANDLING
// ============================================================

function handlePrismaError(error) {
    if (error?.code === "P2002") {
        return createError(
            "A rate already exists for this company, processing type and month",
            409
        );
    }

    if (error?.code === "P2025") {
        return createError("Monthly processing rate not found", 404);
    }

    if (error?.code === "P2003") {
        return createError(
            "The selected company or processing type is invalid",
            400
        );
    }

    return error;
}

// ============================================================
// FIND PROCESSING TYPE WITH COMPANY OWNERSHIP CHECK
// ============================================================

async function findCompanyProcessType(companyId, processTypeId) {
    const company = getCompanyId(companyId);
    const typeId = getPositiveInteger(
        processTypeId,
        "processing type ID"
    );

    const processType = await prisma.jobWorkProcessType.findFirst({
        where: {
            companyId: company,
            processTypeId: typeId
        }
    });

    if (!processType) {
        throw createError(
            "Processing type not found for this company",
            404
        );
    }

    return processType;
}

// ============================================================
// FIND MONTHLY RATE WITH COMPANY OWNERSHIP CHECK
// ============================================================

async function findProcessRate(companyId, processRateId) {
    const company = getCompanyId(companyId);
    const id = getProcessRateId(processRateId);

    const processRate = await prisma.jobWorkProcessRate.findFirst({
        where: {
            companyId: company,
            processRateId: id
        },
        include: {
            processType: {
                select: {
                    processTypeId: true,
                    code: true,
                    name: true,
                    chargeUnit: true,
                    isActive: true
                }
            }
        }
    });

    if (!processRate) {
        throw createError("Monthly processing rate not found", 404);
    }

    return processRate;
}

// ============================================================
// CREATE MONTHLY PROCESSING RATE
//
// Required:
// companyId (from the authenticated company context)
// processTypeId
// rateMonth: YYYY-MM
// chargeUnit
// rate
// ============================================================

async function createProcessRate(companyId, input) {
    const company = getCompanyId(companyId);

    validateInputObject(input);

    const processTypeId = getPositiveInteger(
        input.processTypeId,
        "processing type ID"
    );

    const rateMonth = normalizeRateMonth(input.rateMonth);
    const chargeUnit = normalizeChargeUnit(input.chargeUnit);
    const rate = normalizeRate(input.rate);

    // Ensure this processing type belongs to this company.
    await findCompanyProcessType(company, processTypeId);

    try {
        return await prisma.jobWorkProcessRate.create({
            data: {
                companyId: company,
                processTypeId,
                rateMonth,
                chargeUnit,
                rate
            },
            include: {
                processType: {
                    select: {
                        processTypeId: true,
                        code: true,
                        name: true,
                        chargeUnit: true,
                        isActive: true
                    }
                }
            }
        });
    } catch (error) {
        throw handlePrismaError(error);
    }
}

// ============================================================
// GET MONTHLY PROCESSING RATES
//
// Optional filters:
// rateMonth: YYYY-MM
// processTypeId
// ============================================================

async function getProcessRates(companyId, filters = {}) {
    const company = getCompanyId(companyId);

    const where = {
        companyId: company
    };

    if (
        filters.rateMonth !== undefined &&
        filters.rateMonth !== null &&
        String(filters.rateMonth).trim() !== ""
    ) {
        where.rateMonth = normalizeRateMonth(
            String(filters.rateMonth)
        );
    }

    if (
        filters.processTypeId !== undefined &&
        filters.processTypeId !== null &&
        String(filters.processTypeId).trim() !== ""
    ) {
        where.processTypeId = getPositiveInteger(
            filters.processTypeId,
            "processing type ID"
        );
    }

    return prisma.jobWorkProcessRate.findMany({
        where,
        include: {
            processType: {
                select: {
                    processTypeId: true,
                    code: true,
                    name: true,
                    chargeUnit: true,
                    isActive: true
                }
            }
        },
        orderBy: [
            { rateMonth: "desc" },
            { processTypeId: "asc" },
            { processRateId: "desc" }
        ]
    });
}

// ============================================================
// GET MONTHLY PROCESSING RATE BY ID
// ============================================================

async function getProcessRateById(companyId, processRateId) {
    return findProcessRate(companyId, processRateId);
}

// ============================================================
// UPDATE MONTHLY PROCESSING RATE
//
// Only rate and chargeUnit are editable.
// The processing type and month remain fixed so that a rate
// record keeps its original monthly identity.
// ============================================================

async function updateProcessRate(
    companyId,
    processRateId,
    input
) {
    const company = getCompanyId(companyId);
    const id = getProcessRateId(processRateId);

    validateInputObject(input);

    const data = {};

    if (input.rate !== undefined) {
        data.rate = normalizeRate(input.rate);
    }

    if (input.chargeUnit !== undefined) {
        data.chargeUnit = normalizeChargeUnit(input.chargeUnit);
    }

    if (Object.keys(data).length === 0) {
        throw createError(
            "Provide rate or chargeUnit to update",
            400
        );
    }

    await findProcessRate(company, id);

    try {
        const result = await prisma.jobWorkProcessRate.updateMany({
            where: {
                companyId: company,
                processRateId: id
            },
            data
        });

        if (result.count !== 1) {
            throw createError(
                "Monthly processing rate not found",
                404
            );
        }

        return findProcessRate(company, id);
    } catch (error) {
        throw handlePrismaError(error);
    }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    createProcessRate,
    getProcessRates,
    getProcessRateById,
    updateProcessRate
};