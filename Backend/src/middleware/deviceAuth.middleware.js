const bcrypt = require("bcrypt");

const prisma =
    require("../config/database");


// ======================================================
// DEVICE AUTHENTICATION MIDDLEWARE
// ======================================================
//
// Authenticates fingerprint / IoT devices before allowing
// them to access device-protected API endpoints.
//
// Expected request headers:
//
//     x-device-code
//     x-device-secret
//
// On successful authentication:
//
//     req.device = authenticated IotDevice record
//
// This middleware is used by:
//
//     POST /api/attendance/punch
//     POST /api/attendance/batch
//
// ======================================================

const authenticateDevice = async (
    req,
    res,
    next
) => {

    try {

        // ==============================================
        // Get credentials from request headers
        // ==============================================

        const deviceCode =
            req.headers["x-device-code"];

        const deviceSecret =
            req.headers["x-device-secret"];


        // ==============================================
        // Validate credentials exist
        // ==============================================

        if (
            !deviceCode ||
            !deviceSecret
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Device credentials are required"
            });
        }


        // ==============================================
        // Find device by unique device code
        // ==============================================

        const device =
            await prisma.iotDevice.findUnique({

                where: {
                    deviceCode
                }
            });


        // ==============================================
        // Reject unknown device
        // ==============================================

        if (!device) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid device credentials"
            });
        }


        // ==============================================
        // Check device status
        // ==============================================

        if (
            device.status !== "ACTIVE"
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Device is not active"
            });
        }


        // ==============================================
        // Check secret hash exists
        // ==============================================

        if (
            !device.deviceSecretHash
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Device credentials are not configured"
            });
        }


        // ==============================================
        // Compare supplied secret with stored hash
        // ==============================================

        const validSecret =
            await bcrypt.compare(
                deviceSecret,
                device.deviceSecretHash
            );


        // ==============================================
        // Reject invalid secret
        // ==============================================

        if (!validSecret) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid device credentials"
            });
        }


        // ==============================================
        // Attach authenticated device to request
        // ==============================================
        //
        // Controllers/services use req.device to identify
        // the authenticated device and its company/branch.
        //
        // ==============================================

        req.device =
            device;


        // ==============================================
        // Update device last-seen timestamp
        // ==============================================

        await prisma.iotDevice.update({

            where: {
                deviceId:
                    device.deviceId
            },

            data: {
                lastSeenAt:
                    new Date()
            }
        });


        // ==============================================
        // Continue to the protected endpoint
        // ==============================================

        next();

    } catch (error) {

        next(error);
    }
};


// ======================================================
// EXPORT
// ======================================================

module.exports =
    authenticateDevice;
