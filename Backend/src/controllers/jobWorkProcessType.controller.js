
const jobWorkProcessTypeService = require(
    "../services/jobWorkProcessType.service"
);

// ============================================================
// HELPERS
// ============================================================

function createControllerError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

/**
 * Obtain company ID from the authenticated user.
 * Never trust companyId supplied by the request body.
 */
function getCompanyId(req) {
    const companyId = Number(req?.user?.companyId);

    if (!Number.isInteger(companyId) || companyId < 1) {
        throw createControllerError("Invalid company ID", 400);
    }

    return companyId;
}

/**
 * Validate the processing type ID from the route parameter.
 */
function getProcessTypeId(req) {
    const processTypeId = Number(req.params.processTypeId);

    if (!Number.isInteger(processTypeId) || processTypeId < 1) {
        throw createControllerError(
            "Invalid processing type ID",
            400
        );
    }

    return processTypeId;
}

// ============================================================
// CREATE PROCESSING TYPE
// POST /api/job-work/process-types
// ============================================================

async function createProcessType(req, res) {
    const processType =
        await jobWorkProcessTypeService.createProcessType(
            getCompanyId(req),
            req.body || {}
        );

    return res.status(201).json({
        success: true,
        message: "Processing type created successfully",
        data: processType
    });
}

// ============================================================
// GET ALL PROCESSING TYPES
// GET /api/job-work/process-types
// Optional query parameters: search, status
// ============================================================

async function getProcessTypes(req, res) {
    const filters = {
        search: req.query.search,
        status: req.query.status || undefined
    };

    const processTypes =
        await jobWorkProcessTypeService.getProcessTypes(
            getCompanyId(req),
            filters
        );

    return res.status(200).json({
        success: true,
        message: "Processing types fetched successfully",
        data: processTypes
    });
}

// ============================================================
// GET PROCESSING TYPE BY ID
// GET /api/job-work/process-types/:processTypeId
// ============================================================

async function getProcessTypeById(req, res) {
    const processType =
        await jobWorkProcessTypeService.getProcessTypeById(
            getCompanyId(req),
            getProcessTypeId(req)
        );

    return res.status(200).json({
        success: true,
        message: "Processing type fetched successfully",
        data: processType
    });
}

// ============================================================
// UPDATE PROCESSING TYPE
// PATCH /api/job-work/process-types/:processTypeId
// ============================================================

async function updateProcessType(req, res) {
    const processType =
        await jobWorkProcessTypeService.updateProcessType(
            getCompanyId(req),
            getProcessTypeId(req),
            req.body || {}
        );

    return res.status(200).json({
        success: true,
        message: "Processing type updated successfully",
        data: processType
    });
}

// ============================================================
// UPDATE PROCESSING TYPE STATUS
// PATCH /api/job-work/process-types/:processTypeId/status
//
// Request body:
// { "status": "ACTIVE" }
// or
// { "status": "INACTIVE" }
// ============================================================

async function updateProcessTypeStatus(req, res) {
    const status = String(req.body?.status || "")
        .trim()
        .toUpperCase();

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
        throw createControllerError(
            "Status must be ACTIVE or INACTIVE",
            400
        );
    }

    const processType =
        await jobWorkProcessTypeService.updateProcessTypeStatus(
            getCompanyId(req),
            getProcessTypeId(req),
            status
        );

    return res.status(200).json({
        success: true,
        message: "Processing type status updated successfully",
        data: processType
    });
}

// ============================================================
// EXPORT CONTROLLERS
// ============================================================

module.exports = {
    createProcessType,
    getProcessTypes,
    getProcessTypeById,
    updateProcessType,
    updateProcessTypeStatus
};
