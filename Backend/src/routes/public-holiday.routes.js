const express =
    require("express");

const publicHolidayController =
    require("../controllers/public-holiday.controller");

const asyncHandler =
    require("../utils/asyncHandler");

const authenticate =
    require("../middleware/auth.middleware");

const authorizeRoles =
    require("../middleware/authorization.middleware");

const router =
    express.Router();


// ============================================================
// ADMIN PROTECTION
// ============================================================
// Public-holiday management is restricted to administrators.
// ============================================================

const adminOnly = [
    authenticate,
    authorizeRoles("ADMIN")
];


// ============================================================
// CREATE PUBLIC HOLIDAY
// ============================================================
//
// POST /api/holidays
//
// Admin only.
// ============================================================

router.post(
    "/",
    ...adminOnly,
    asyncHandler(publicHolidayController.createPublicHoliday)
);


// ============================================================
// GET PUBLIC HOLIDAYS
// ============================================================
//
// GET /api/holidays
//
// Optional:
//
// ?year=2026
// ?branchId=1
// ?fromDate=2026-01-01
// ?toDate=2026-12-31
// ?isPaid=true
//
// Used by the admin holiday-management page.
// ============================================================

router.get(
    "/",
    ...adminOnly,
    asyncHandler(publicHolidayController.getPublicHolidays)
);


// ============================================================
// GET EMPLOYEE PUBLIC HOLIDAYS
// ============================================================
//
// GET /api/holidays/my
//
// Optional:
//
// ?year=2026
// ?fromDate=2026-01-01
// ?toDate=2026-12-31
//
// The service automatically determines the logged-in
// employee's branch.
// ============================================================

router.get(
    "/my",
    authenticate,
    authorizeRoles("EMPLOYEE"),
    asyncHandler(publicHolidayController.getMyPublicHolidays)
);


// ============================================================
// CHECK PUBLIC HOLIDAY
// ============================================================
//
// GET /api/holidays/check
//
// Example:
//
// /api/holidays/check?date=2026-10-02&branchId=1
//
// Admin only. The employee dashboard uses /my, which is
// branch-scoped by the authenticated employee on the backend.
//
// IMPORTANT:
// This route must be declared BEFORE /:id so that "check"
// is not interpreted as an ID.
// ============================================================

router.get(
    "/check",
    ...adminOnly,
    asyncHandler(publicHolidayController.checkPublicHoliday)
);


// ============================================================
// PUBLIC HOLIDAY CALENDAR
// ============================================================
//
// GET /api/holidays/calendar
//
// Optional:
//
// ?year=2026
// ?branchId=1
//
// Used by the admin holiday-management flow.
//
// This route must also be declared before /:id.
// ============================================================

router.get(
    "/calendar",
    ...adminOnly,
    asyncHandler(publicHolidayController.getPublicHolidayCalendar)
);


// ============================================================
// GET PUBLIC HOLIDAY BY ID
// ============================================================
//
// GET /api/holidays/:id
// ============================================================

router.get(
    "/:id",
    ...adminOnly,
    asyncHandler(publicHolidayController.getPublicHolidayById)
);


// ============================================================
// UPDATE PUBLIC HOLIDAY
// ============================================================
//
// PUT /api/holidays/:id
//
// Allows the admin to change the branch, date, name,
// working hours, or paid/unpaid status.
// ============================================================

router.put(
    "/:id",
    ...adminOnly,
    asyncHandler(publicHolidayController.updatePublicHoliday)
);


// ============================================================
// DELETE PUBLIC HOLIDAY
// ============================================================
//
// DELETE /api/holidays/:id
// ============================================================

router.delete(
    "/:id",
    ...adminOnly,
    asyncHandler(publicHolidayController.deletePublicHoliday)
);


// ============================================================
// EXPORT
// ============================================================

module.exports =
    router;