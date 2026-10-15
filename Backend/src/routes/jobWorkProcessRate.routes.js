const express = require("express");

const jobWorkProcessRateController =
    require("../controllers/jobWorkProcessRate.controller");

const asyncHandler =
    require("../utils/asyncHandler");

const authenticate =
    require("../middleware/auth.middleware");

const authorizeRoles =
    require("../middleware/authorization.middleware");

const router = express.Router();

// ============================================================
// MONTHLY PROCESSING RATE ROUTE PROTECTION
// ============================================================

router.use(
    authenticate,
    authorizeRoles("ADMIN")
);

// ============================================================
// CREATE MONTHLY PROCESSING RATE
// POST /api/job-work/process-rates
// ============================================================

router.post(
    "/",
    asyncHandler(
        jobWorkProcessRateController.createProcessRate
    )
);

// ============================================================
// GET ALL MONTHLY PROCESSING RATES
// GET /api/job-work/process-rates
// Optional query parameters:
//   rateMonth=2026-10
//   processTypeId=1
// ============================================================

router.get(
    "/",
    asyncHandler(
        jobWorkProcessRateController.getProcessRates
    )
);

// ============================================================
// GET MONTHLY PROCESSING RATE BY ID
// GET /api/job-work/process-rates/:processRateId
// ============================================================

router.get(
    "/:processRateId",
    asyncHandler(
        jobWorkProcessRateController.getProcessRateById
    )
);

// ============================================================
// UPDATE MONTHLY PROCESSING RATE
// PATCH /api/job-work/process-rates/:processRateId
// ============================================================

router.patch(
    "/:processRateId",
    asyncHandler(
        jobWorkProcessRateController.updateProcessRate
    )
);

// ============================================================
// EXPORT
// ============================================================

module.exports = router;
