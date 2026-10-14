
const express = require("express");

const jobWorkProcessTypeController = require(
    "../controllers/jobWorkProcessType.controller"
);

const asyncHandler = require("../utils/asyncHandler");
const authenticate = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/authorization.middleware");

const router = express.Router();

// ============================================================
// AUTHENTICATION AND AUTHORIZATION
// ============================================================

// All processing-type endpoints require an authenticated admin.
router.use(authenticate, authorizeRoles("ADMIN"));

// ============================================================
// PROCESSING TYPE MASTER
// Base path: /api/job-work/process-types
// ============================================================

// Create a processing type.
// POST /api/job-work/process-types
router.post(
    "/",
    asyncHandler(
        jobWorkProcessTypeController.createProcessType
    )
);

// Get all processing types.
// GET /api/job-work/process-types
// Optional query parameters: search, status
router.get(
    "/",
    asyncHandler(
        jobWorkProcessTypeController.getProcessTypes
    )
);

// Update processing type status.
// PATCH /api/job-work/process-types/:processTypeId/status
router.patch(
    "/:processTypeId/status",
    asyncHandler(
        jobWorkProcessTypeController.updateProcessTypeStatus
    )
);

// Get one processing type.
// GET /api/job-work/process-types/:processTypeId
router.get(
    "/:processTypeId",
    asyncHandler(
        jobWorkProcessTypeController.getProcessTypeById
    )
);

// Update processing type details.
// PATCH /api/job-work/process-types/:processTypeId
router.patch(
    "/:processTypeId",
    asyncHandler(
        jobWorkProcessTypeController.updateProcessType
    )
);

module.exports = router;
