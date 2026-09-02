const bcrypt = require("bcrypt");

const prisma = require("../config/database");


// ======================================================
// DEVICE AUTHENTICATION MIDDLEWARE
// ======================================================

const authenticateDevice = async (req, res, next) => {

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

        if (!deviceCode || !deviceSecret) {

            return res.status(401).json({

                success: false,

                message:
                    "Device credentials are required"
            });
        }


        // ==============================================
        // Find device
        // ==============================================

        const device =
            await prisma.iotDevice.findUnique({

                where: {
                    deviceCode
                }
            });


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

        if (device.status !== "ACTIVE") {

            return res.status(403).json({

                success: false,

                message:
                    "Device is not active"
            });
        }


        // ==============================================
        // Check secret hash exists
        // ==============================================

        if (!device.deviceSecretHash) {

            return res.status(401).json({

                success: false,

                message:
                    "Device credentials are not configured"
            });
        }


        // ==============================================
        // Compare secret
        // ==============================================

        const validSecret =
            await bcrypt.compare(
                deviceSecret,
                device.deviceSecretHash
            );


        if (!validSecret) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid device credentials"
            });
        }


        // ==============================================
        // Attach device to request
        // ==============================================

        req.device = device;


        // ==============================================
        // Update last seen
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
        // Continue
        // ==============================================

        next();

    } catch (error) {

        next(error);
    }
};


module.exports = authenticateDevice;