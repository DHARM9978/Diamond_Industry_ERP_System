const express = require("express");

const deviceController =
    require("../controllers/device.controller");

const asyncHandler =
    require("../utils/asyncHandler");

const authenticate =
    require("../middleware/auth.middleware");

const authorizeRoles =
    require("../middleware/authorization.middleware");

const router = express.Router();


// ==========================================
// ADMIN DEVICE MANAGEMENT
// ==========================================

router.use(
    authenticate,
    authorizeRoles("ADMIN")
);


// ==========================================
// Create Device
// ==========================================

router.post(
    "/",
    asyncHandler(
        deviceController.createDevice
    )
);


// ==========================================
// Get All Devices
// ==========================================

router.get(
    "/",
    asyncHandler(
        deviceController.getDevices
    )
);


// ==========================================
// Get Device
// ==========================================

router.get(
    "/:id",
    asyncHandler(
        deviceController.getDevice
    )
);


// ==========================================
// Update Device
// ==========================================

router.put(
    "/:id",
    asyncHandler(
        deviceController.updateDevice
    )
);


// ==========================================
// Delete Device
// ==========================================

router.delete(
    "/:id",
    asyncHandler(
        deviceController.deleteDevice
    )
);


module.exports = router;