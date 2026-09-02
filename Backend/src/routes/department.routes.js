const express = require("express");

const departmentController =
    require("../controllers/department.controller");

const asyncHandler =
    require("../utils/asyncHandler");

const authenticate =
    require("../middleware/auth.middleware");

const authorizeRoles =
    require("../middleware/authorization.middleware");

const router = express.Router();


// ==========================================
// Department Protection
// ==========================================

router.use(
    authenticate,
    authorizeRoles("ADMIN")
);


// ==========================================
// Create Department
// POST /api/departments
// ==========================================

router.post(
    "/",
    asyncHandler(departmentController.createDepartment)
);


// ==========================================
// Get All Departments
// GET /api/departments
// ==========================================

router.get(
    "/",
    asyncHandler(departmentController.getDepartments)
);


// ==========================================
// Get Department By ID
// GET /api/departments/:id
// ==========================================

router.get(
    "/:id",
    asyncHandler(departmentController.getDepartment)
);


// ==========================================
// Update Department
// PUT /api/departments/:id
// ==========================================

router.put(
    "/:id",
    asyncHandler(departmentController.updateDepartment)
);


// ==========================================
// Delete Department
// DELETE /api/departments/:id
// ==========================================

router.delete(
    "/:id",
    asyncHandler(departmentController.deleteDepartment)
);


module.exports = router;