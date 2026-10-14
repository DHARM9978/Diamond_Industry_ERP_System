
const externalProcessorService = require("../services/externalProcessor.service");

// ============================================================
// HELPERS
// ============================================================

function createError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function getCompanyId(req) {
    const companyId = Number(req?.user?.companyId);

    if (!Number.isInteger(companyId) || companyId < 1) {
        throw createError("Invalid company ID", 400);
    }

    return companyId;
}

function getProcessorId(req) {
    const processorId = Number(req.params.processorId);

    if (!Number.isInteger(processorId) || processorId < 1) {
        throw createError("Invalid external processor ID", 400);
    }

    return processorId;
}

// ============================================================
// CREATE EXTERNAL PROCESSOR
// ============================================================

async function createExternalProcessor(req, res) {
    const processor = await externalProcessorService.createExternalProcessor(
        getCompanyId(req),
        req.body || {}
    );

    return res.status(201).json({
        success: true,
        message: "External processor created successfully",
        data: processor
    });
}

// ============================================================
// GET ALL EXTERNAL PROCESSORS
// ============================================================

async function getExternalProcessors(req, res) {
    const processors = await externalProcessorService.getExternalProcessors(
        getCompanyId(req),
        {
            search: req.query.search,
            status: req.query.status || undefined
        }
    );

    return res.status(200).json({
        success: true,
        message: "External processors fetched successfully",
        data: processors
    });
}

// ============================================================
// GET EXTERNAL PROCESSOR BY ID
// ============================================================

async function getExternalProcessorById(req, res) {
    const processor = await externalProcessorService.getExternalProcessorById(
        getCompanyId(req),
        getProcessorId(req)
    );

    return res.status(200).json({
        success: true,
        message: "External processor fetched successfully",
        data: processor
    });
}

// ============================================================
// UPDATE EXTERNAL PROCESSOR
// ============================================================

async function updateExternalProcessor(req, res) {
    const processor = await externalProcessorService.updateExternalProcessor(
        getCompanyId(req),
        getProcessorId(req),
        req.body || {}
    );

    return res.status(200).json({
        success: true,
        message: "External processor updated successfully",
        data: processor
    });
}

// ============================================================
// UPDATE EXTERNAL PROCESSOR STATUS
// ============================================================

async function updateExternalProcessorStatus(req, res) {
    const processor = await externalProcessorService.updateExternalProcessorStatus(
        getCompanyId(req),
        getProcessorId(req),
        req.body?.status
    );

    return res.status(200).json({
        success: true,
        message: "External processor status updated successfully",
        data: processor
    });
}

// ============================================================
// GET JOBS FOR AN EXTERNAL PROCESSOR
// ============================================================

async function getExternalProcessorJobs(req, res) {
    const jobs = await externalProcessorService.getExternalProcessorJobs(
        getCompanyId(req),
        getProcessorId(req),
        {
            status: req.query.status || undefined
        }
    );

    return res.status(200).json({
        success: true,
        message: "External processor jobs fetched successfully",
        data: jobs
    });
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
    createExternalProcessor,
    getExternalProcessors,
    getExternalProcessorById,
    updateExternalProcessor,
    updateExternalProcessorStatus,
    getExternalProcessorJobs
};
