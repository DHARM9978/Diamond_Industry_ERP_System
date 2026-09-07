const express = require("express");

const fingerprintController =
    require("../controllers/fingerprint.controller");

const asyncHandler =
    require("../utils/asyncHandler");

const authenticate =
    require("../middleware/auth.middleware");

const authorizeRoles =
    require("../middleware/authorization.middleware");

const router = express.Router();


// ==========================================
// Fingerprint Protection
// ==========================================

router.use(
    authenticate,
    authorizeRoles("ADMIN")
);


// ==========================================
// Enroll Fingerprint
// POST /api/fingerprints
// ==========================================

router.post(
    "/",
    asyncHandler(
        fingerprintController.enrollFingerprint
    )
);


// ==========================================
// Get All Fingerprints
// GET /api/fingerprints
// ==========================================

router.get(
    "/",
    asyncHandler(
        fingerprintController.getFingerprints
    )
);


// ==========================================
// Get Enrollment Status
// GET /api/fingerprints/enrollment/:id/status
// ==========================================

router.get(
    "/enrollment/:id/status",
    asyncHandler(
        fingerprintController.getEnrollmentStatus
    )
);


// ==========================================
// Get Fingerprint
// GET /api/fingerprints/:id
// ==========================================

router.get(
    "/:id",
    asyncHandler(
        fingerprintController.getFingerprint
    )
);

// ==========================================
// Update Fingerprint
// PUT /api/fingerprints/:id
// ==========================================

router.put(
    "/:id",
    asyncHandler(
        fingerprintController.updateFingerprint
    )
);


// ==========================================
// Delete Fingerprint
// DELETE /api/fingerprints/:id
// ==========================================

router.delete(
    "/:id",
    asyncHandler(
        fingerprintController.deleteFingerprint
    )
);

// ==========================================
// Adding new fingerprint
// POST /api/device/fingerprint-enroll
// ==========================================

router.post(
    "/fingerprint-enroll",
    asyncHandler(
        fingerprintController.enrollFingerprintFromDevice
    )
);


module.exports = router;