const express = require("express");

const advanceController =
    require("../controllers/advance.controller");

const asyncHandler =
    require("../utils/asyncHandler");

const authenticate =
    require("../middleware/auth.middleware");

const authorizeRoles =
    require("../middleware/authorization.middleware");


const router = express.Router();


// ==========================================
// Advance Payment Protection
// ==========================================
// All /api/advances routes are ADMIN only
// Employee self-service uses /api/me/advances
// ==========================================

router.use(
    authenticate,
    authorizeRoles("ADMIN")
);


// ==========================================
// Create Advance
// POST /api/advances
// ==========================================

router.post(
    "/",
    asyncHandler(
        advanceController.createAdvance
    )
);


// ==========================================
// Get All Advances
// GET /api/advances
// ==========================================

router.get(
    "/",
    asyncHandler(
        advanceController.getAdvances
    )
);


// ==========================================
// Get Employee Advances
// GET /api/advances/employee/:employeeId
// ==========================================

router.get(
    "/employee/:employeeId",
    asyncHandler(
        advanceController.getEmployeeAdvances
    )
);


// ==========================================
// Get Advance By ID
// GET /api/advances/:id
// ==========================================

router.get(
    "/:id",
    asyncHandler(
        advanceController.getAdvanceById
    )
);


// ==========================================
// Update Advance Status
//
// PATCH /api/advances/:id/status
//
// Approve:
//
// {
//   "status": "APPROVED",
//   "approvedAmount": 1000
// }
//
// Pay:
//
// {
//   "status": "PAID",
//   "paidAmount": 1500
// }
//
// Reject:
//
// {
//   "status": "REJECTED"
// }
// ==========================================

router.patch(
    "/:id/status",
    asyncHandler(
        advanceController.updateAdvanceStatus
    )
);


// ==========================================
// Delete Advance
// DELETE /api/advances/:id
// ==========================================

router.delete(
    "/:id",
    asyncHandler(
        advanceController.deleteAdvance
    )
);


// ==========================================
// Export Router
// ==========================================

module.exports = router;