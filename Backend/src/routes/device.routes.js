const express = require("express");

const deviceController =
    require("../controllers/device.controller");

const asyncHandler =
    require("../utils/asyncHandler");

const authenticate =
    require("../middleware/auth.middleware");

const authorizeRoles =
    require("../middleware/authorization.middleware");

const router =
    express.Router();


// ==========================================
// ERP USER AUTHENTICATION
// ==========================================
//
// All routes in this file are ERP/admin routes.
//
// ESP32/device-authenticated routes are handled
// separately under /api/device using
// deviceAuth.middleware.
//

router.use(
    authenticate
);


// ==========================================
// GET DEVICES
//
// CLIENT ADMIN:
// - Can view devices
//
// SUPERADMIN:
// - Can view devices
// ==========================================

router.get(
    "/",
    authorizeRoles(
        "ADMIN",
        "SUPERADMIN"
    ),
    asyncHandler(
        deviceController.getDevices
    )
);


// ==========================================
// GET SINGLE DEVICE
//
// CLIENT ADMIN:
// - Can view device details
//
// SUPERADMIN:
// - Can view device details
// ==========================================

router.get(
    "/:id",
    authorizeRoles(
        "ADMIN",
        "SUPERADMIN"
    ),
    asyncHandler(
        deviceController.getDevice
    )
);


// ==========================================
// GET WIFI CONFIGURATION STATUS
//
// CLIENT ADMIN:
// - Can view Wi-Fi configuration status
//
// SUPERADMIN:
// - Can view Wi-Fi configuration status
//
// IMPORTANT:
// This does NOT return Wi-Fi passwords.
// ==========================================

router.get(
    "/:id/wifi",
    authorizeRoles(
        "ADMIN",
        "SUPERADMIN"
    ),
    asyncHandler(
        deviceController.getWifiConfiguration
    )
);


// ==========================================
// CREATE DEVICE
//
// SUPERADMIN ONLY
//
// The client admin must NOT be able to
// register a new fingerprint device.
// ==========================================

router.post(
    "/",
    authorizeRoles(
        "SUPERADMIN"
    ),
    asyncHandler(
        deviceController.createDevice
    )
);


// ==========================================
// SET WIFI CONFIGURATION
//
// SUPERADMIN ONLY
//
// This allows the ERP administrator to send
// Primary + Secondary Wi-Fi credentials to
// the device.
//
// The service encrypts the credentials before
// storing them in the database.
//
// Example request body:
//
// {
//     "primarySsid": "Office-WiFi",
//     "primaryPassword": "password123",
//     "secondarySsid": "Office-Backup",
//     "secondaryPassword": "backup123"
// }
//
// The credentials are marked PENDING until
// the ESP32 retrieves, tests, and acknowledges
// the configuration.
// ==========================================

router.put(
    "/:id/wifi",
    authorizeRoles(
        "SUPERADMIN"
    ),
    asyncHandler(
        deviceController.setWifiConfiguration
    )
);


// ==========================================
// UPDATE DEVICE
//
// SUPERADMIN ONLY
//
// Includes changes such as:
// - device name
// - branch
// - location
// - status
// ==========================================

router.put(
    "/:id",
    authorizeRoles(
        "SUPERADMIN"
    ),
    asyncHandler(
        deviceController.updateDevice
    )
);


// ==========================================
// DELETE DEVICE
//
// SUPERADMIN ONLY
// ==========================================

router.delete(
    "/:id",
    authorizeRoles(
        "SUPERADMIN"
    ),
    asyncHandler(
        deviceController.deleteDevice
    )
);


// ==========================================
// EXPORT
// ==========================================

module.exports = router;