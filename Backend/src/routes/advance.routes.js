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
// PATCH /api/advances/:id/status
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


module.exports = router;