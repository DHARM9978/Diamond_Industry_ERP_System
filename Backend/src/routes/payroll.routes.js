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
// Mark Payroll As Paid
// PATCH /api/payroll/:id/pay
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