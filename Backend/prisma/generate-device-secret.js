require("dotenv/config");

const crypto = require("crypto");
const bcrypt = require("bcrypt");

const prisma = require("../src/config/database");


// ======================================================
// GENERATE DEVICE SECRET
// ======================================================

const generateDeviceSecret = () => {

    return crypto.randomBytes(32).toString("hex");
};


// ======================================================
// MAIN
// ======================================================

const main = async () => {

    const deviceCode = "ESP32-001";


    // ==============================================
    // Find Device
    // ==============================================

    const device =
        await prisma.iotDevice.findUnique({

            where: {
                deviceCode
            }
        });


    if (!device) {

        throw new Error(
            `Device ${deviceCode} not found`
        );
    }


    // ==============================================
    // Generate Secret
    // ==============================================

    const deviceSecret =
        generateDeviceSecret();


    // ==============================================
    // Hash Secret
    // ==============================================

    const deviceSecretHash =
        await bcrypt.hash(
            deviceSecret,
            12
        );


    // ==============================================
    // Save Hash
    // ==============================================

    await prisma.iotDevice.update({

        where: {
            deviceId:
                device.deviceId
        },

        data: {

            deviceSecretHash
        }
    });


    // ==============================================
    // IMPORTANT
    // ==============================================

    console.log("");
    console.log(
        "=========================================="
    );

    console.log(
        "DEVICE CREDENTIALS"
    );

    console.log(
        "=========================================="
    );

    console.log(
        `Device Code : ${deviceCode}`
    );

    console.log(
        `Device Secret: ${deviceSecret}`
    );

    console.log(
        "=========================================="
    );

    console.log("");

    console.log(
        "IMPORTANT: Save the Device Secret."
    );

    console.log(
        "It will NOT be stored as plain text in"
    );

    console.log(
        "the database."
    );

    console.log("");
};


// ======================================================
// RUN
// ======================================================

main()

    .catch((error) => {

        console.error(
            "Failed to generate device secret:"
        );

        console.error(error);

        process.exit(1);
    })

    .finally(async () => {

        await prisma.$disconnect();
    });