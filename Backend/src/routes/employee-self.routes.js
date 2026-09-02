const express = require("express");

const employeeSelfController =
    require("../controllers/employee-self.controller");

const asyncHandler =
    require("../utils/asyncHandler");

const authenticate =
    require("../middleware/auth.middleware");

const authorizeRoles =
    require("../middleware/authorization.middleware");


const router = express.Router();


// ==========================================
// Employee Self-Service Protection
// ==========================================

router.use(
    authenticate,
    authorizeRoles("EMPLOYEE")
);


// ==========================================
// Get My Profile
// GET /api/me/profile
// ==========================================

router.get(
    "/profile",
    asyncHandler(
        employeeSelfController.getMyProfile
    )
);


// ==========================================
// Get My Attendance
// GET /api/me/attendance
// ==========================================

router.get(
    "/attendance",
    asyncHandler(
        employeeSelfController.getMyAttendance
    )
);


// ==========================================
// Get My Attendance Summary
// GET /api/me/attendance/summary
// ==========================================

router.get(
    "/attendance/summary",
    asyncHandler(
        employeeSelfController.getMyAttendanceSummary
    )
);


// ==========================================
// Get My Payroll
// GET /api/me/payroll
// ==========================================

router.get(
    "/payroll",
    asyncHandler(
        employeeSelfController.getMyPayroll
    )
);


// ==========================================
// Get My Advances
// GET /api/me/advances
// ==========================================

router.get(
    "/advances",
    asyncHandler(
        employeeSelfController.getMyAdvances
    )
);


// ==========================================
// Request My Advance
// POST /api/me/advances
// ==========================================

router.post(
    "/advances",
    asyncHandler(
        employeeSelfController.createMyAdvance
    )
);


module.exports = router;