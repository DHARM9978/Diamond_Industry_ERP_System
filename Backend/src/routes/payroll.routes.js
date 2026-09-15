const express = require("express");

const payrollController =
    require("../controllers/payroll.controller");

const asyncHandler =
    require("../utils/asyncHandler");

const authenticate =
    require("../middleware/auth.middleware");

const authorizeRoles =
    require("../middleware/authorization.middleware");


const router = express.Router();


// ==========================================
// Payroll Protection
// ==========================================

router.use(
    authenticate,
    authorizeRoles("ADMIN")
);


// ==========================================
// Create Payroll
// POST /api/payroll
// ==========================================

router.post(
    "/",
    asyncHandler(
        payrollController.createPayroll
    )
);


// ==========================================
// Get All Payroll
// GET /api/payroll
// ==========================================

router.get(
    "/",
    asyncHandler(
        payrollController.getPayroll
    )
);


// ==========================================
// Payroll Configuration
// ==========================================

// GET /api/payroll/configuration/:branchId

router.get(
    "/configuration/:branchId",
    asyncHandler(
        payrollController.getPayrollConfiguration
    )
);


// PUT /api/payroll/configuration/:branchId

router.put(
    "/configuration/:branchId",
    asyncHandler(
        payrollController.updatePayrollConfiguration
    )
);


// ==========================================
// Payroll Period Preview
// ==========================================

// GET /api/payroll/period/:branchId/current

router.get(
    "/period/:branchId/current",
    asyncHandler(
        payrollController.getCurrentPayrollPeriod
    )
);


// GET /api/payroll/period/:branchId/next

router.get(
    "/period/:branchId/next",
    asyncHandler(
        payrollController.getNextPayrollPeriod
    )
);


// ==========================================
// Payroll Generation
// ==========================================

// POST /api/payroll/generate/branch/:branchId/current

router.post(
    "/generate/branch/:branchId/current",
    asyncHandler(
        payrollController.generateCurrentBranchPayroll
    )
);


// POST /api/payroll/generate/branch/:branchId

router.post(
    "/generate/branch/:branchId",
    asyncHandler(
        payrollController.generatePayrollForBranch
    )
);


// ==========================================
// Get Employee Payroll
// GET /api/payroll/employee/:employeeId
// ==========================================

router.get(
    "/employee/:employeeId",
    asyncHandler(
        payrollController.getEmployeePayroll
    )
);


// ==========================================
// EXTRA WORK / OVERTIME
// ==========================================
//
// These routes are intentionally placed BEFORE
// "/:id" so they are treated as fixed paths.
//
// Pending overtime:
// GET /api/payroll/extra-work
//
// Settlement history:
// GET /api/payroll/extra-work/history
//
// Reject overtime:
// PATCH /api/payroll/extra-work/:id/reject
// ==========================================


// ------------------------------------------
// Get Pending Extra Work
// ------------------------------------------
//
// Returns employees whose overtime / extra-work
// hours are currently accumulated and have not
// yet been settled.
//
// GET /api/payroll/extra-work
// ------------------------------------------

router.get(
    "/extra-work",
    asyncHandler(
        payrollController.getExtraWorkRecords
    )
);


// ------------------------------------------
// Get Extra Work Settlement History
// ------------------------------------------
//
// Returns historical overtime settlements.
//
// GET /api/payroll/extra-work/history
// ------------------------------------------

router.get(
    "/extra-work/history",
    asyncHandler(
        payrollController.getExtraWorkSettlementHistory
    )
);


// ------------------------------------------
// Reject Extra Work
// ------------------------------------------
//
// Rejects the selected overtime record.
//
// IMPORTANT:
// This does NOT delete the record.
// Historical extra-work data must remain preserved.
//
// PATCH /api/payroll/extra-work/:id/reject
// ------------------------------------------

router.patch(
    "/extra-work/:id/reject",
    asyncHandler(
        payrollController.rejectExtraWork
    )
);


// ==========================================
// Mark Payroll As Paid
// PATCH /api/payroll/:id/pay
// ==========================================
//
// Body:
//
// {
//     "incentiveAmount": 2000
// }
//
// incentiveAmount is optional.
//
// The controller passes the incentive amount
// to the payroll service.
//
// The payroll service handles:
// - incentive validation
// - salary finalization
// - extra-work settlement
// - settlement history
// - resetting the current accumulated balance
//
// ==========================================

router.patch(
    "/:id/pay",
    asyncHandler(
        payrollController.markPayrollPaid
    )
);


// ==========================================
// Get Payroll By ID
// GET /api/payroll/:id
// ==========================================
//
// IMPORTANT:
// This route comes AFTER all fixed routes such as:
//
// /extra-work
// /extra-work/history
// /extra-work/:id/reject
// /employee/:employeeId
// /:id/pay
//
// ==========================================

router.get(
    "/:id",
    asyncHandler(
        payrollController.getPayrollById
    )
);


// ==========================================
// Update Payroll
// PUT /api/payroll/:id
// ==========================================

router.put(
    "/:id",
    asyncHandler(
        payrollController.updatePayroll
    )
);


// ==========================================
// Delete Payroll
// DELETE /api/payroll/:id
// ==========================================

router.delete(
    "/:id",
    asyncHandler(
        payrollController.deletePayroll
    )
);


// ==========================================
// EXPORT
// ==========================================

module.exports = router;