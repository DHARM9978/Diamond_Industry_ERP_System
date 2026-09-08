const express = require("express");

const attendanceController =
    require("../controllers/attendance.controller");

const attendancePunchController =
    require("../controllers/attendance-punch.controller");

const asyncHandler =
    require("../utils/asyncHandler");

const authenticate =
    require("../middleware/auth.middleware");

const authorizeRoles =
    require("../middleware/authorization.middleware");

const authenticateDevice =
    require("../middleware/deviceAuth.middleware");

const router =
    express.Router();


// ======================================================
// DEVICE ATTENDANCE PUNCH
// ======================================================

router.post(
    "/punch",
    authenticateDevice,
    asyncHandler(
        attendancePunchController.processPunch
    )
);


// ======================================================
// ADMIN ATTENDANCE APIs
// ======================================================

router.use(
    authenticate,
    authorizeRoles("ADMIN")
);


// ======================================================
// LIVE ATTENDANCE
// ======================================================

// GET /api/attendance/live
router.get(
    "/live",
    asyncHandler(
        attendanceController.getLiveAttendance
    )
);


// ======================================================
// RAW ATTENDANCE PUNCHES
// ======================================================

// GET /api/attendance/punches
router.get(
    "/punches",
    asyncHandler(
        attendanceController.getPunches
    )
);


// GET /api/attendance/punches/:id
router.get(
    "/punches/:id",
    asyncHandler(
        attendanceController.getPunchById
    )
);


// ======================================================
// EMPLOYEE RAW PUNCH HISTORY
// ======================================================

// GET /api/attendance/employee/:employeeId/punches
router.get(
    "/employee/:employeeId/punches",
    asyncHandler(
        attendanceController.getEmployeePunchHistory
    )
);


// ======================================================
// EMPLOYEE ATTENDANCE SUMMARY
// ======================================================

// GET /api/attendance/employee/:employeeId/summary
router.get(
    "/employee/:employeeId/summary",
    asyncHandler(
        attendanceController.getEmployeeAttendanceSummary
    )
);


// ======================================================
// EMPLOYEE ATTENDANCE
// ======================================================

// GET /api/attendance/employee/:employeeId
router.get(
    "/employee/:employeeId",
    asyncHandler(
        attendanceController.getEmployeeAttendance
    )
);


// ======================================================
// DAILY ATTENDANCE SUMMARY
// ======================================================

// GET /api/attendance/summary
router.get(
    "/summary",
    asyncHandler(
        attendanceController.getAttendanceSummary
    )
);


// ======================================================
// DAILY ATTENDANCE
// ======================================================

// GET /api/attendance
router.get(
    "/",
    asyncHandler(
        attendanceController.getAttendance
    )
);


// ======================================================
// ADMIN ATTENDANCE CORRECTION
// ======================================================

// PUT /api/attendance/:id
router.put(
    "/:id",
    asyncHandler(
        attendanceController.updateAttendance
    )
);


// GET /api/attendance/:id
router.get(
    "/:id",
    asyncHandler(
        attendanceController.getAttendanceById
    )
);


module.exports = router;