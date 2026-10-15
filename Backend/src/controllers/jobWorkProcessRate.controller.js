const jobWorkProcessRateService =
    require("../services/jobWorkProcessRate.service");

// ============================================================
// HELPERS
// ============================================================

const createControllerError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

// Get company ID from the authenticated user.
// Never accept companyId from the request body or query string.
const getCompanyId = (req) => {
    const companyId = Number(req?.user?.companyId);

    if (!Number.isInteger(companyId) || companyId < 1) {
        throw createControllerError("Invalid company ID", 400);
    }

    return companyId;
};

const getPositiveInteger = (value, fieldName) => {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1) {
        throw createControllerError(
            `Invalid ${fieldName}`,
            400
        );
    }

    return parsed;
};

// ============================================================
// CREATE MONTHLY PROCESSING RATE
//
// POST /api/job-work/process-rates
// ============================================================

const createProcessRate = async (req, res) => {
    const rate = await jobWorkProcessRateService.createProcessRate(
        getCompanyId(req),
        req.body || {}
    );

    return res.status(201).json({
        success: true,
        message: "Monthly processing rate created successfully",
        data: rate
    });
};

// ============================================================
// GET ALL MONTHLY PROCESSING RATES
//
// GET /api/job-work/process-rates
//
// Optional query parameters:
//   rateMonth=2026-10
//   processTypeId=1
// ============================================================

const getProcessRates = async (req, res) => {
    const filters = {
        rateMonth: req.query.rateMonth,
        processTypeId: req.query.processTypeId
    };

    const rates = await jobWorkProcessRateService.getProcessRates(
        getCompanyId(req),
        filters
    );

    return res.status(200).json({
        success: true,
        message: "Monthly processing rates fetched successfully",
        data: rates
    });
};

// ============================================================
// GET MONTHLY PROCESSING RATE BY ID
//
// GET /api/job-work/process-rates/:processRateId
// ============================================================

const getProcessRateById = async (req, res) => {
    const processRateId = getPositiveInteger(
        req.params.processRateId,
        "processing rate ID"
    );

    const rate = await jobWorkProcessRateService.getProcessRateById(
        getCompanyId(req),
        processRateId
    );

    return res.status(200).json({
        success: true,
        message: "Monthly processing rate fetched successfully",
        data: rate
    });
};

// ============================================================
// UPDATE MONTHLY PROCESSING RATE
//
// PATCH /api/job-work/process-rates/:processRateId
//
// Editable fields:
//   rate
//   chargeUnit
// ============================================================

const updateProcessRate = async (req, res) => {
    const processRateId = getPositiveInteger(
        req.params.processRateId,
        "processing rate ID"
    );

    const rate = await jobWorkProcessRateService.updateProcessRate(
        getCompanyId(req),
        processRateId,
        req.body || {}
    );

    return res.status(200).json({
        success: true,
        message: "Monthly processing rate updated successfully",
        data: rate
    });
};

// ============================================================
// EXPORT CONTROLLERS
// ============================================================

module.exports = {
    createProcessRate,
    getProcessRates,
    getProcessRateById,
    updateProcessRate
};