
const express = require("express");

const jobWorkOrderController =
    require("../controllers/jobWorkOrder.controller");

const asyncHandler =
    require("../utils/asyncHandler");

const authenticate =
    require("../middleware/auth.middleware");

const authorizeRoles =
    require("../middleware/authorization.middleware");

const router = express.Router();

// ============================================================
// ROUTE PROTECTION
// Only authenticated admins can access job-work orders.
// ============================================================

router.use(
    authenticate,
    authorizeRoles("ADMIN")
);

// ============================================================
// CREATE JOB WORK ORDER
// POST /api/job-work/orders
// ============================================================

router.post(
    "/",
    asyncHandler(
        jobWorkOrderController.createJobWorkOrder
    )
);

// ============================================================
// GET ALL JOB WORK ORDERS
// GET /api/job-work/orders
//
// Optional query parameters:
//   search
//   status
//   orderMonth=YYYY-MM
// ============================================================

router.get(
    "/",
    asyncHandler(
        jobWorkOrderController.getJobWorkOrders
    )
);

// ============================================================
// GET JOB WORK ORDER BY ID
// GET /api/job-work/orders/:jobWorkOrderId
// ============================================================

router.get(
    "/:jobWorkOrderId",
    asyncHandler(
        jobWorkOrderController.getJobWorkOrderById
    )
);

// ============================================================
// EXPORT
// ============================================================

module.exports = router;
