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
//
// POST /api/attendance/punch
//
// This endpoint is used by the fingerprint device/client.
//
// Device authentication happens before the controller.
//
// The controller forwards:
// - sensorSlot
// - optional eventId
//
// to attendance.service.js.
//
// eventId is supported for idempotent device retries.
// ======================================================

router.post(
    "/punch",
    authenticateDevice,
    asyncHandler(
        attendancePunchController.processPunch
    )
);


// ======================================================
// DEVICE ATTENDANCE BATCH
// ======================================================
//
// POST /api/attendance/batch
//
// This endpoint is used by the fingerprint device/client
// to upload multiple attendance events in one request.
//
// Device authentication happens before the controller.
//
// The controller forwards:
// - events
// - optional officeCloseTime
//
// to attendance.service.js.
//
// Batch processing supports:
// - multiple employee events
// - delayed device uploads
// - eventId-based duplicate protection
// - attendance resolution
// ======================================================

router.post(
    "/batch",
    authenticateDevice,
    asyncHandler(
        attendanceController.processAttendanceBatch
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
//
// GET /api/attendance/live
//
// Existing live-attendance endpoint.
// ======================================================

router.get(
    "/live",
    asyncHandler(
        attendanceController.getLiveAttendance
    )
);


// ======================================================
// ATTENDANCE SETTINGS
// ======================================================
//
// GET /api/attendance/settings/office-close-time
//
// PUT /api/attendance/settings/office-close-time
//
// These endpoints are ADMIN-protected and use the authenticated
// administrator's companyId to read/write the company setting.
// ======================================================

router.get(
    "/settings/office-close-time",
    asyncHandler(
        attendanceController.getOfficeCloseTime
    )
);


router.put(
    "/settings/office-close-time",
    asyncHandler(
        attendanceController.updateOfficeCloseTime
    )
);


// ======================================================
// RAW ATTENDANCE PUNCHES
// ======================================================
//
// GET /api/attendance/punches
// ======================================================

router.get(
    "/punches",
    asyncHandler(
        attendanceController.getPunches
    )
);


// ======================================================
// GET RAW ATTENDANCE PUNCH BY ID
// ======================================================
//
// GET /api/attendance/punches/:id
// ======================================================

router.get(
    "/punches/:id",
    asyncHandler(
        attendanceController.getPunchById
    )
);


// ======================================================
// EMPLOYEE RAW PUNCH HISTORY
// ======================================================
//
// GET /api/attendance/employee/:employeeId/punches
// ======================================================

router.get(
    "/employee/:employeeId/punches",
    asyncHandler(
        attendanceController.getEmployeePunchHistory
    )
);


// ======================================================
// EMPLOYEE ATTENDANCE SUMMARY
// ======================================================
//
// GET /api/attendance/employee/:employeeId/summary
// ======================================================

router.get(
    "/employee/:employeeId/summary",
    asyncHandler(
        attendanceController.getEmployeeAttendanceSummary
    )
);


// ======================================================
// EMPLOYEE ATTENDANCE
// ======================================================
//
// GET /api/attendance/employee/:employeeId
// ======================================================

router.get(
    "/employee/:employeeId",
    asyncHandler(
        attendanceController.getEmployeeAttendance
    )
);


// ======================================================
// DAILY ATTENDANCE SUMMARY
// ======================================================
//
// GET /api/attendance/summary
// ======================================================

router.get(
    "/summary",
    asyncHandler(
        attendanceController.getAttendanceSummary
    )
);


// ======================================================
// DAILY ATTENDANCE
// ======================================================
//
// GET /api/attendance
// ======================================================

router.get(
    "/",
    asyncHandler(
        attendanceController.getAttendance
    )
);


// ======================================================
// ADMIN ATTENDANCE CORRECTION
// ======================================================
//
// PUT /api/attendance/:id
//
// Used by ADMIN to manually correct attendance.
//
// ======================================================

router.put(
    "/:id",
    asyncHandler(
        attendanceController.updateAttendance
    )
);


// ======================================================
// GET ATTENDANCE BY ID
// ======================================================
//
// GET /api/attendance/:id
// ======================================================

router.get(
    "/:id",
    asyncHandler(
        attendanceController.getAttendanceById
    )
);


// ======================================================
// EXPORT
// ======================================================

module.exports = router;