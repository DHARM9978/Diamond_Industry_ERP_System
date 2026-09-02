const express = require("express");

const router = express.Router();

const reportController =
    require("../controllers/report.controller");

const asyncHandler =
    require("../utils/asyncHandler");

const authenticate =
    require("../middleware/auth.middleware");

const authorizeRoles =
    require("../middleware/authorization.middleware");


// ======================================================
// ADMIN REPORT ACCESS
// ======================================================

router.use(
    authenticate,
    authorizeRoles("ADMIN")
);


// ======================================================
// DASHBOARD
// ======================================================

// GET /api/reports/dashboard
router.get(
    "/dashboard",
    asyncHandler(
        reportController.getDashboardSummary
    )
);


// ======================================================
// ATTENDANCE REPORT
// ======================================================

// GET /api/reports/attendance
router.get(
    "/attendance",
    asyncHandler(
        reportController.getAttendanceReport
    )
);


// ======================================================
// EMPLOYEE REPORT
// ======================================================

// GET /api/reports/employees
router.get(
    "/employees",
    asyncHandler(
        reportController.getEmployeeReport
    )
);


// ======================================================
// PAYROLL REPORT
// ======================================================

// GET /api/reports/payroll
router.get(
    "/payroll",
    asyncHandler(
        reportController.getPayrollReport
    )
);


// ======================================================
// ADVANCE REPORT
// ======================================================

// GET /api/reports/advances
router.get(
    "/advances",
    asyncHandler(
        reportController.getAdvanceReport
    )
);


// ======================================================
// LEAVE REPORT
// ======================================================

// GET /api/reports/leaves
router.get(
    "/leaves",
    asyncHandler(
        reportController.getLeaveReport
    )
);


// ======================================================
// EXPORT
// ======================================================

module.exports = router;