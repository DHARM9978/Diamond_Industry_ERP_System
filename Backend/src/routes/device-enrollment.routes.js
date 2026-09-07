const express = require("express");

const fingerprintController =
    require("../controllers/fingerprint.controller");

const asyncHandler =
    require("../utils/asyncHandler");

const authenticateDevice =
    require("../middleware/deviceAuth.middleware");

const router = express.Router();


// ======================================================
// DEVICE: LEGACY DIRECT FINGERPRINT ENROLLMENT
// ======================================================
// POST /api/device/fingerprint-enroll
//
// Kept for compatibility with the existing API.
// The new recommended workflow is:
//   Admin -> POST /api/fingerprints
//   ESP32 -> GET /api/device/fingerprint-enroll/pending
//   ESP32 -> POST /api/device/fingerprint-enroll/result
// ======================================================

router.post(
    "/fingerprint-enroll",
    authenticateDevice,
    asyncHandler(
        fingerprintController.enrollFingerprintFromDevice
    )
);


// ======================================================
// DEVICE: FETCH PENDING ENROLLMENT
// ======================================================
// GET /api/device/fingerprint-enroll/pending
// ======================================================

router.get(
    "/fingerprint-enroll/pending",
    authenticateDevice,
    asyncHandler(
        fingerprintController.getPendingEnrollment
    )
);


// ======================================================
// DEVICE: REPORT ENROLLMENT PROGRESS LOG
// ======================================================
// POST /api/device/fingerprint-enroll/log
// ======================================================

router.post(
    "/fingerprint-enroll/log",
    authenticateDevice,
    asyncHandler(
        fingerprintController.reportEnrollmentLog
    )
);


// ======================================================
// DEVICE: REPORT ENROLLMENT RESULT
// ======================================================
// POST /api/device/fingerprint-enroll/result
// ======================================================

router.post(
    "/fingerprint-enroll/result",
    authenticateDevice,
    asyncHandler(
        fingerprintController.reportEnrollmentResult
    )
);


module.exports = router;
