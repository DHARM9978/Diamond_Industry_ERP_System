const express = require("express");

const companyController = require("../controllers/company.controller");
const asyncHandler = require("../utils/asyncHandler");
const authenticate = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/authorization.middleware");

const router = express.Router();


// ==========================================
// All company routes require authentication
// and ADMIN role
// ==========================================

router.use(
    authenticate,
    authorizeRoles("ADMIN")
);


// ==========================================
// Create Company
// POST /api/companies
// ==========================================

router.post(
    "/",
    asyncHandler(companyController.createCompany)
);


// ==========================================
// Get All Companies
// GET /api/companies
// ==========================================

router.get(
    "/",
    asyncHandler(companyController.getCompanies)
);


// ==========================================
// Get Company By ID
// GET /api/companies/:id
// ==========================================

router.get(
    "/:id",
    asyncHandler(companyController.getCompany)
);


// ==========================================
// Update Company
// PUT /api/companies/:id
// ==========================================

router.put(
    "/:id",
    asyncHandler(companyController.updateCompany)
);


// ==========================================
// Delete Company
// DELETE /api/companies/:id
// ==========================================

router.delete(
    "/:id",
    asyncHandler(companyController.deleteCompany)
);


module.exports = router;