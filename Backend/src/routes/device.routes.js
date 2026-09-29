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
// DEVICE AUTHENTICATION
// ==========================================

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
