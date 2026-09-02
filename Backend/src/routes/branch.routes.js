const express = require("express");

const branchController = require("../controllers/branch.controller");
const asyncHandler = require("../utils/asyncHandler");
const authenticate = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/authorization.middleware");

const router = express.Router();


// ==========================================
// Branch routes
// ==========================================

router.use(
    authenticate,
    authorizeRoles("ADMIN")
);


// ==========================================
// Create Branch
// POST /api/branches
// ==========================================

router.post(
    "/",
    asyncHandler(branchController.createBranch)
);


// ==========================================
// Get All Branches
// GET /api/branches
// ==========================================

router.get(
    "/",
    asyncHandler(branchController.getBranches)
);


// ==========================================
// Get Branch By ID
// GET /api/branches/:id
// ==========================================

router.get(
    "/:id",
    asyncHandler(branchController.getBranch)
);


// ==========================================
// Update Branch
// PUT /api/branches/:id
// ==========================================

router.put(
    "/:id",
    asyncHandler(branchController.updateBranch)
);


// ==========================================
// Delete Branch
// DELETE /api/branches/:id
// ==========================================

router.delete(
    "/:id",
    asyncHandler(branchController.deleteBranch)
);


module.exports = router;