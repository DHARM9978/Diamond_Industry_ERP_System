
const express = require("express");

const externalProcessorController = require(
    "../controllers/externalProcessor.controller"
);

const asyncHandler = require("../utils/asyncHandler");
const authenticate = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/authorization.middleware");

const router = express.Router();

// Protect all External Processor endpoints.
router.use(authenticate, authorizeRoles("ADMIN"));

// POST /api/job-work/processors
router.post(
    "/",
    asyncHandler(externalProcessorController.createExternalProcessor)
);

// GET /api/job-work/processors
router.get(
    "/",
    asyncHandler(externalProcessorController.getExternalProcessors)
);

// GET /api/job-work/processors/:processorId/jobs
router.get(
    "/:processorId/jobs",
    asyncHandler(externalProcessorController.getExternalProcessorJobs)
);

// PATCH /api/job-work/processors/:processorId/status
router.patch(
    "/:processorId/status",
    asyncHandler(externalProcessorController.updateExternalProcessorStatus)
);

// GET /api/job-work/processors/:processorId
router.get(
    "/:processorId",
    asyncHandler(externalProcessorController.getExternalProcessorById)
);

// PATCH /api/job-work/processors/:processorId
router.patch(
    "/:processorId",
    asyncHandler(externalProcessorController.updateExternalProcessor)
);

module.exports = router;
