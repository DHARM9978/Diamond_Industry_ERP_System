const express = require("express");

const fingerprintController =
    require("../controllers/fingerprint.controller");

const asyncHandler =
    require("../utils/asyncHandler");

const authenticateDevice =
    require("../middleware/deviceAuth.middleware");

const router = express.Router();


// ==========================================
// DEVICE FINGERPRINT ENROLLMENT
// ==========================================

router.post(
    "/fingerprint-enroll",

    authenticateDevice,

    asyncHandler(
        fingerprintController.enrollFingerprintFromDevice
    )
);


module.exports = router;