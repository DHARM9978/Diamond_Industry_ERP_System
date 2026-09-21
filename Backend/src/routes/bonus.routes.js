const express =
    require("express");

const bonusController =
    require("../controllers/bonus.controller");

const authMiddleware =
    require("../middleware/auth.middleware");

const authorizeRoles =
    require("../middleware/authorization.middleware");

const router =
    express.Router();


// ============================================================
// ADMIN BONUS ROUTES
// ============================================================
//
// These routes handle extra-hours based bonus/incentive
// settlement.
//
// Authentication and ADMIN authorization are required.
//
// Company/employee authorization is enforced inside the
// bonus service using the authenticated company context.
//
// ============================================================

router.use(
    authMiddleware,
    authorizeRoles("ADMIN")
);


// ------------------------------------------------------------
// GET EXTRA-WORK RECORDS
// ------------------------------------------------------------
//
// Returns accumulated extra-work records that are available
// for bonus settlement.
//
// GET /api/bonuses/extra-work
//
// Optional:
//
// ?employeeId=123
// ?status=ACCUMULATED
// ?fromDate=2026-09-01
// ?toDate=2026-09-30
//
// ------------------------------------------------------------

router.get(
    "/extra-work",
    bonusController.getExtraWorkRecords
);


// ------------------------------------------------------------
// GET BONUS SETTLEMENT HISTORY
// ------------------------------------------------------------
//
// Returns previously settled extra-hours bonuses.
//
// GET /api/bonuses/history
//
// Optional:
//
// ?employeeId=123
//
// ------------------------------------------------------------

router.get(
    "/history",
    bonusController.getBonusHistory
);


// ------------------------------------------------------------
// PAY / SETTLE BONUS
// ------------------------------------------------------------
//
// Settles the employee's accumulated extra hours and records
// the associated incentive/bonus amount.
//
// POST /api/bonuses/pay
//
// Body:
//
// {
//     employeeId: 123,
//     payrollId: 456,
//     incentiveAmount: 2000
// }
//
// payrollId is optional.
//
// ------------------------------------------------------------

router.post(
    "/pay",
    bonusController.settleExtraWork
);


// ------------------------------------------------------------
// REJECT EXTRA-WORK RECORD
// ------------------------------------------------------------
//
// Keeps the original record but marks it as REJECTED.
//
// PATCH /api/bonuses/extra-work/:id/reject
//
// ------------------------------------------------------------

router.patch(
    "/extra-work/:id/reject",
    bonusController.rejectExtraWork
);


module.exports =
    router;