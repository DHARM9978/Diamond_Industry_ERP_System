
const prisma = require("../config/database");

// ============================================================
// CONSTANTS
// ============================================================

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
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1) {
        throw createError(`Invalid ${fieldName}`, 400);
    }

    return parsed;
}

function getCompanyId(companyId) {
    return getPositiveInteger(companyId, "company ID");
}

function getJobWorkOrderId(jobWorkOrderId) {
    return getPositiveInteger(
        jobWorkOrderId,
        "job work order ID"
    );
}

function validateInputObject(input) {
    if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input)
    ) {
        throw createError("Request body must be an object", 400);
    }
}

function normalizeOptionalText(value, fieldName, maxLength = 5000) {
    if (value === undefined || value === null) {
        return null;
    }

    if (typeof value !== "string") {
        throw createError(
            `${fieldName} must be a string or null`,
            400
        );
    }

    const text = value.trim();

    if (text.length > maxLength) {
        throw createError(
            `${fieldName} cannot exceed ${maxLength} characters`,
            400
        );
    }

    return text || null;
}

// ============================================================
// DATE VALIDATION
// ============================================================

function parseDateOnly(value, fieldName) {
    if (typeof value !== "string") {
        throw createError(
            `${fieldName} is required in YYYY-MM-DD format`,
            400
        );
    }

    const match = value.trim().match(
        /^(\d{4})-(\d{2})-(\d{2})$/
    );

    if (!match) {
        throw createError(
            `${fieldName} must use YYYY-MM-DD format`,
            400
        );
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(
        Date.UTC(year, month - 1, day)
    );

    if (
        year < 1000 ||
        year > 9999 ||
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        throw createError(`${fieldName} is not a valid date`, 400);
    }

    return date;
}

function getMonthStart(date) {
    return new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            1
        )
    );
}

// ============================================================
// RATE VALIDATION
// ============================================================

function normalizeChargeUnit(value) {
    if (typeof value !== "string") {
        throw createError("Invalid quoted charge unit", 400);
    }

    const unit = value.trim().toUpperCase();

    if (!VALID_CHARGE_UNITS.includes(unit)) {
        throw createError(
            `Quoted charge unit must be one of: ${VALID_CHARGE_UNITS.join(", ")}`,
            400
        );
    }

    return unit;
}

function normalizeOptionalRate(value) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null;
    }

    if (
        typeof value !== "string" &&
        typeof value !== "number"
    ) {
        throw createError("Invalid quoted rate", 400);
    }

    const text = String(value).trim();

    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
        throw createError(
            "Quoted rate must be non-negative with at most two decimal places",
            400
        );
    }

    const amount = Number(text);

    if (
        !Number.isFinite(amount) ||
        amount > MAX_RATE
    ) {
        throw createError(
            "Quoted rate is outside the supported range",
            400
        );
    }

    return text;
}

// ============================================================
// DATABASE ERROR HANDLING
// ============================================================

function handlePrismaError(error) {
    if (error?.code === "P2002") {
        return createError(
            "A job with this job number already exists for your company",
            409
        );
    }

    if (error?.code === "P2003") {
        return createError(
            "One or more selected records are invalid",
            400
        );
    }

    if (error?.code === "P2025") {
        return createError("Job work order not found", 404);
    }

    return error;
}

// ============================================================
// RELATIONS INCLUDED IN JOB WORK ORDER RESPONSES
//
// Select only necessary admin fields. Never return password hashes.
// ============================================================

const JOB_WORK_ORDER_INCLUDE = {
    branch: {
        select: {
            branchId: true,
            branchName: true,
            location: true
        }
    },

    externalProcessor: {
        select: {
            externalProcessorId: true,
            processorCode: true,
            name: true,
            status: true
        }
    },

    processType: {
        select: {
            processTypeId: true,
            code: true,
            name: true,
            chargeUnit: true,
            defaultRate: true
        }
    },

    createdByAdmin: {
        select: {
            adminId: true,
            adminName: true
        }
    },

    dispatches: {
        select: {
            dispatchId: true,
            challanNumber: true,
            jangadNumber: true,
            dispatchDate: true,
            expectedReturnDate: true,
            sentPieces: true,
            sentCarats: true,
            sentWeightGrams: true,

            receipts: {
                select: {
                    receiptId: true,
                    receiptNumber: true,
                    receivedDate: true,

                    items: {
                        select: {
                            receiptItemId: true,
                            returnCondition: true,
                            returnedPieces: true,
                            returnedCarats: true,
                            returnedWeightGrams: true,
                            appliedChargeUnit: true,
                            appliedRate: true,
                            billableQuantity: true,
                            processingCharge: true
                        }
                    }
                }
            }
        }
    }
};

// ============================================================
// VALIDATE BRANCH OWNERSHIP
// ============================================================

async function findCompanyBranch(companyId, branchId) {
    const branch = await prisma.branch.findFirst({
        where: {
            companyId,
            branchId
        },
        select: {
            branchId: true,
            branchName: true,
            location: true,
            companyId: true
        }
    });

    if (!branch) {
        throw createError(
            "Branch not found for this company",
            404
        );
    }

    return branch;
}

// ============================================================
// VALIDATE EXTERNAL PROCESSOR OWNERSHIP
// ============================================================

async function findCompanyProcessor(
    companyId,
    externalProcessorId
) {
    const processor = await prisma.externalProcessor.findFirst({
        where: {
            companyId,
            externalProcessorId
        },
        select: {
            externalProcessorId: true,
            processorCode: true,
            name: true,
            status: true
        }
    });

    if (!processor) {
        throw createError(
            "External processor not found for this company",
            404
        );
    }

    if (processor.status !== "ACTIVE") {
        throw createError(
            "The selected external processor is inactive",
            400
        );
    }

    return processor;
}

// ============================================================
// VALIDATE PROCESSING TYPE OWNERSHIP
// ============================================================

async function findCompanyProcessType(
    companyId,
    processTypeId
) {
    const processType =
        await prisma.jobWorkProcessType.findFirst({
            where: {
                companyId,
                processTypeId
            }
        });

    if (!processType) {
        throw createError(
            "Processing type not found for this company",
            404
        );
    }

    if (!processType.isActive) {
        throw createError(
            "The selected processing type is inactive",
            400
        );
    }

    return processType;
}

// ============================================================
// GET MONTHLY RATE FOR THE ORDER MONTH
// ============================================================

async function findMonthlyRate(
    companyId,
    processTypeId,
    rateMonth
) {
    return prisma.jobWorkProcessRate.findFirst({
        where: {
            companyId,
            processTypeId,
            rateMonth
        }
    });
}

// ============================================================
// CREATE JOB WORK ORDER
//
// Required:
//   branchId
//   jobNumber
//   externalProcessorId
//   processTypeId
//   orderDate
//
// Optional:
//   description
//   notes
//   quotedRate
//   quotedChargeUnit
//
// Quotation rules:
//   1. A supplied quotedRate is a manual reference quotation.
//   2. Otherwise, use the configured monthly rate for orderDate.
//   3. If no monthly rate exists and no manual quote is supplied,
//      the quotation fields remain null.
//   4. Quotation data does not determine the final receipt charge.
// ============================================================

async function createJobWorkOrder(
    companyId,
    adminId,
    input
) {
    const company = getCompanyId(companyId);

    validateInputObject(input);

    const branchId = getPositiveInteger(
        input.branchId,
        "branch ID"
    );

    const externalProcessorId = getPositiveInteger(
        input.externalProcessorId,
        "external processor ID"
    );

    const processTypeId = getPositiveInteger(
        input.processTypeId,
        "processing type ID"
    );

    if (typeof input.jobNumber !== "string") {
        throw createError("Job number is required", 400);
    }

    const jobNumber = input.jobNumber.trim();

    if (!jobNumber) {
        throw createError("Job number is required", 400);
    }

    if (jobNumber.length > 40) {
        throw createError(
            "Job number cannot exceed 40 characters",
            400
        );
    }

    const orderDate = parseDateOnly(
        input.orderDate,
        "Order date"
    );

    const description = normalizeOptionalText(
        input.description,
        "Description"
    );

    const notes = normalizeOptionalText(
        input.notes,
        "Notes"
    );

    // Validate the optional user-entered quotation.
    const manualQuotedRate = normalizeOptionalRate(
        input.quotedRate
    );

    let manualQuotedChargeUnit = null;

    if (
        input.quotedChargeUnit !== undefined &&
        input.quotedChargeUnit !== null &&
        input.quotedChargeUnit !== ""
    ) {
        manualQuotedChargeUnit = normalizeChargeUnit(
            input.quotedChargeUnit
        );
    }

    // Reject a charge unit supplied without a quoted rate.
    if (
        manualQuotedRate === null &&
        manualQuotedChargeUnit !== null
    ) {
        throw createError(
            "Provide a quoted rate when specifying a quoted charge unit",
            400
        );
    }

    // Validate that any explicitly supplied admin belongs to the
    // authenticated company. The caller should obtain adminId from
    // the authenticated user, not from the request body.
    let createdByAdminId = null;

    if (
        adminId !== undefined &&
        adminId !== null
    ) {
        createdByAdminId = getPositiveInteger(
            adminId,
            "admin ID"
        );

        const admin = await prisma.admin.findFirst({
            where: {
                adminId: createdByAdminId,
                companyId: company
            },
            select: {
                adminId: true
            }
        });

        if (!admin) {
            throw createError(
                "Authenticated admin was not found for this company",
                403
            );
        }
    }

    // Confirm ownership and active status before creating the order.
    const [branch, processor, processType] =
        await Promise.all([
            findCompanyBranch(company, branchId),
            findCompanyProcessor(company, externalProcessorId),
            findCompanyProcessType(company, processTypeId)
        ]);

    // The order's quotation month comes from the order date.
    const quoteMonth = getMonthStart(orderDate);

    // Use the monthly configured rate as the default quotation.
    const monthlyRate = await findMonthlyRate(
        company,
        processTypeId,
        quoteMonth
    );

    let quotedRate = manualQuotedRate;
    let quotedChargeUnit = manualQuotedChargeUnit;

    if (quotedRate === null && monthlyRate) {
        quotedRate = String(monthlyRate.rate);
        quotedChargeUnit = monthlyRate.chargeUnit;
    } else if (
        quotedRate !== null &&
        quotedChargeUnit === null
    ) {
        // For a manual quotation, prefer the selected month's
        // unit, then fall back to the processing type's unit.
        quotedChargeUnit =
            monthlyRate?.chargeUnit ||
            processType.chargeUnit ||
            null;
    }

    if (
        quotedRate !== null &&
        !quotedChargeUnit
    ) {
        throw createError(
            "A quoted charge unit is required when a quoted rate is provided",
            400
        );
    }

    const data = {
        companyId: company,
        branchId: branch.branchId,
        jobNumber,
        externalProcessorId: processor.externalProcessorId,
        processTypeId: processType.processTypeId,
        orderDate,
        status: "OPEN",
        description,
        notes,
        createdByAdminId,

        // Preserve the quote as a snapshot. Later changes to
        // monthly rates must not silently change this order's quote.
        quotedRate,
        quotedChargeUnit,
        quotedRateMonth:
            quotedRate !== null
                ? quoteMonth
                : null
    };

    try {
        return await prisma.jobWorkOrder.create({
            data,
            include: JOB_WORK_ORDER_INCLUDE
        });
    } catch (error) {
        throw handlePrismaError(error);
    }
}

// ============================================================
// GET ALL JOB WORK ORDERS
//
// Optional filters:
//   search
//   status
//   orderMonth=YYYY-MM
// ============================================================

async function getJobWorkOrders(
    companyId,
    filters = {}
) {
    const company = getCompanyId(companyId);

    const where = {
        companyId: company
    };

    if (
        filters.status !== undefined &&
        filters.status !== null &&
        String(filters.status).trim() !== ""
    ) {
        const status = String(filters.status).trim().toUpperCase();

        if (status.length > 30) {
            throw createError("Invalid job status filter", 400);
        }

        where.status = status;
    }

    if (
        filters.orderMonth !== undefined &&
        filters.orderMonth !== null &&
        String(filters.orderMonth).trim() !== ""
    ) {
        const monthKey = String(filters.orderMonth).trim();

        const match = monthKey.match(
            /^(\d{4})-(0[1-9]|1[0-2])$/
        );

        if (!match) {
            throw createError(
                "Order month must use YYYY-MM format",
                400
            );
        }

        const year = Number(match[1]);
        const month = Number(match[2]);

        const startDate = new Date(
            Date.UTC(year, month - 1, 1)
        );

        const nextMonth = new Date(
            Date.UTC(year, month, 1)
        );

        where.orderDate = {
            gte: startDate,
            lt: nextMonth
        };
    }

    if (
        filters.search !== undefined &&
        filters.search !== null
    ) {
        const search = String(filters.search).trim();

        if (search) {
            where.OR = [
                {
                    jobNumber: {
                        contains: search
                    }
                },
                {
                    description: {
                        contains: search
                    }
                },
                {
                    externalProcessor: {
                        is: {
                            name: {
                                contains: search
                            }
                        }
                    }
                },
                {
                    processType: {
                        is: {
                            name: {
                                contains: search
                            }
                        }
                    }
                }
            ];
        }
    }

    return prisma.jobWorkOrder.findMany({
        where,
        include: JOB_WORK_ORDER_INCLUDE,
        orderBy: [
            { orderDate: "desc" },
            { jobWorkOrderId: "desc" }
        ]
    });
}

// ============================================================
// GET JOB WORK ORDER BY ID
// ============================================================

async function getJobWorkOrderById(
    companyId,
    jobWorkOrderId
) {
    const company = getCompanyId(companyId);
    const id = getJobWorkOrderId(jobWorkOrderId);

    const order = await prisma.jobWorkOrder.findFirst({
        where: {
            companyId: company,
            jobWorkOrderId: id
        },
        include: JOB_WORK_ORDER_INCLUDE
    });

    if (!order) {
        throw createError("Job work order not found", 404);
    }

    return order;
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    createJobWorkOrder,
    getJobWorkOrders,
    getJobWorkOrderById
};
