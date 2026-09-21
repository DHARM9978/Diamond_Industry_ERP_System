const express = require("express");

const bonusController =
    require("../controllers/bonus.controller");

const asyncHandler =
    require("../utils/asyncHandler");

const authenticate =
    require("../middleware/auth.middleware");

const authorizeRoles =
    require("../middleware/authorization.middleware");


const router = express.Router();


// ==========================================
// Employee Bonus Protection
// ==========================================

router.use(
    authenticate,
    authorizeRoles("EMPLOYEE")
);


// ==========================================
// Get My Bonus Payments
// GET /api/me/bonuses
// ==========================================

router.get(
    "/",
    asyncHandler(
        bonusController.getMyBonuses
    )
);


// ==========================================
// EXPORT
// ==========================================

module.exports = router;