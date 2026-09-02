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


module.exports = router;