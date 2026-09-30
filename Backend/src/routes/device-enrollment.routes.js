const express = require("express");

const fingerprintController =
    require("../controllers/fingerprint.controller");

const deviceController =
    require("../controllers/device.controller");

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
//
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
// Allows the ESP32 to detect status changes, including an
// administrator cancelling a running enrollment.
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


// ======================================================
// ESP32: FETCH WIFI CONFIGURATION
// ======================================================
// GET /api/device/wifi-config
//
// Authentication:
//   x-device-code
//   x-device-secret
//
// The authenticated ESP32 receives the decrypted Wi-Fi
// configuration assigned to its own device.
//
// The ESP32 must:
//   1. Fetch configuration.
//   2. Compare configVersion with its local version.
//   3. Test the new Wi-Fi configuration.
//   4. Test ERP/backend connectivity.
//   5. Only then commit the new credentials to NVS.
//
// The backend does not expose Wi-Fi credentials to the
// normal ERP/admin API.
// ======================================================

router.get(
    "/wifi-config",
    authenticateDevice,
    asyncHandler(
        deviceController.getWifiConfigurationForDevice
    )
);


// ======================================================
// ESP32: ACKNOWLEDGE WIFI CONFIGURATION
// ======================================================
// POST /api/device/wifi-config/ack
//
// Request body:
//
// {
//     "configVersion": 1,
//     "status": "APPLIED",
//     "activeNetwork": "PRIMARY",
//     "error": null
// }
//
// Or when configuration fails:
//
// {
//     "configVersion": 1,
//     "status": "FAILED",
//     "activeNetwork": "PRIMARY",
//     "error": "Unable to connect to secondary network"
// }
//
// The device can only acknowledge the configuration version
// currently assigned to it.
// ======================================================

router.post(
    "/wifi-config/ack",
    authenticateDevice,
    asyncHandler(
        deviceController.acknowledgeWifiConfiguration
    )
);


// ======================================================
// ESP32: REPORT WIFI RUNTIME STATE
// ======================================================
// POST /api/device/wifi-config/runtime
//
// Used by the ESP32 to report its current network state.
//
// Example:
//
// {
//     "activeNetwork": "PRIMARY",
//     "error": null
// }
//
// Or:
//
// {
//     "activeNetwork": "SECONDARY",
//     "error": "Primary Wi-Fi unavailable"
// }
//
// This allows the ERP to know which configured network the
// device is currently using and the latest Wi-Fi error.
// ======================================================

router.post(
    "/wifi-config/runtime",
    authenticateDevice,
    asyncHandler(
        deviceController.updateWifiRuntimeState
    )
);


// ======================================================
// EXPORT
// ======================================================

module.exports = router;