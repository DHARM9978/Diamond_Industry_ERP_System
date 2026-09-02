const express = require("express");

const employeeController =
    require("../controllers/employee.controller");

const asyncHandler =
    require("../utils/asyncHandler");

const authenticate =
    require("../middleware/auth.middleware");

const authorizeRoles =
    require("../middleware/authorization.middleware");

const router = express.Router();


// ==========================================
// Employee Protection
// ==========================================

router.use(
    authenticate,
    authorizeRoles("ADMIN")
);


// ==========================================
// Create Employee
// POST /api/employees
// ==========================================

router.post(
    "/",
    asyncHandler(employeeController.createEmployee)
);


// ==========================================
// Get All Employees
// GET /api/employees
// ==========================================

router.get(
    "/",
    asyncHandler(employeeController.getEmployees)
);


// ==========================================
// Get Employee
// GET /api/employees/:id
// ==========================================

router.get(
    "/:id",
    asyncHandler(employeeController.getEmployee)
);


// ==========================================
// Update Employee
// PUT /api/employees/:id
// ==========================================

router.put(
    "/:id",
    asyncHandler(employeeController.updateEmployee)
);


// ==========================================
// Delete Employee
// DELETE /api/employees/:id
// ==========================================

router.delete(
    "/:id",
    asyncHandler(employeeController.deleteEmployee)
);


module.exports = router;