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
// DEVICE: CHECK ENROLLMENT STATUS
// ======================================================
// GET /api/device/fingerprint-enroll/:id/status
//
// Used by the ESP32 while physical enrollment is running.
// This allows the machine to detect when the admin cancelled
// the enrollment from the ERP frontend.
// ======================================================

router.get(
    "/fingerprint-enroll/:id/status",
    authenticateDevice,
    asyncHandler(
        fingerprintController.getDeviceEnrollmentStatus
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
