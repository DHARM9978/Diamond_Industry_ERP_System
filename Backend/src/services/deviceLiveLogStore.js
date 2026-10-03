// ======================================================
// DEVICE LIVE LOG STORE
// ======================================================
//
// Purpose:
//   Keeps recent live output reported by ESP32 devices.
//
// This is an in-memory store.
// It does NOT create or modify any Prisma/database tables.
//
// Data is separated by deviceId so that live output from
// one ESP32 device can never be mixed with another device.
//
// The store intentionally keeps a limited number of entries
// per device to prevent unlimited memory growth.
//
// ======================================================


// ======================================================
// CONFIGURATION
// ======================================================

// Maximum number of live-output entries retained for each
// device.
//
// Older entries are automatically removed when this limit
// is exceeded.
const MAX_LOGS_PER_DEVICE = 200;


// ======================================================
// INTERNAL STORE
// ======================================================
//
// Map structure:
//
// deviceId -> [
//     {
//         id,
//         level,
//         category,
//         message,
//         timestamp,
//         metadata
//     },
//     ...
// ]
//
// ======================================================

const deviceLiveLogs = new Map();


// ======================================================
// VALIDATION HELPERS
// ======================================================

const normalizeDeviceId = (deviceId) => {

    if (
        deviceId === undefined ||
        deviceId === null ||
        deviceId === ""
    ) {
        const error = new Error(
            "Device ID is required"
        );

        error.statusCode = 400;

        throw error;
    }

    return String(deviceId);
};


const normalizeString = (
    value,
    defaultValue = ""
) => {

    if (
        value === undefined ||
        value === null
    ) {
        return defaultValue;
    }

    return String(value).trim();
};


const normalizeLevel = (level) => {

    const normalized =
        normalizeString(
            level,
            "INFO"
        ).toUpperCase();

    const allowedLevels = [
        "DEBUG",
        "INFO",
        "WARNING",
        "WARN",
        "ERROR",
        "SUCCESS"
    ];

    if (
        !allowedLevels.includes(
            normalized
        )
    ) {
        return "INFO";
    }

    return normalized === "WARN"
        ? "WARNING"
        : normalized;
};


const normalizeTimestamp = (
    timestamp
) => {

    if (!timestamp) {
        return new Date().toISOString();
    }

    const date =
        new Date(timestamp);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return new Date().toISOString();
    }

    return date.toISOString();
};


// ======================================================
// CREATE LIVE LOG ENTRY
// ======================================================

const createLiveLogEntry = (
    data = {}
) => {

    const message =
        normalizeString(
            data.message
        );

    if (!message) {

        const error = new Error(
            "Live output message is required"
        );

        error.statusCode = 400;

        throw error;
    }


    return {

        // Unique identifier for this
        // live-output entry.
        id:
            `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 10)}`,

        // INFO / DEBUG / WARNING /
        // ERROR / SUCCESS
        level:
            normalizeLevel(
                data.level
            ),

        // Example:
        //
        // WIFI
        // FINGERPRINT
        // ATTENDANCE
        // SYSTEM
        // NETWORK
        // ERROR
        //
        category:
            normalizeString(
                data.category,
                "SYSTEM"
            ),

        // Human-readable device message.
        message,

        // Timestamp supplied by ESP32
        // when valid, otherwise backend
        // timestamp.
        timestamp:
            normalizeTimestamp(
                data.timestamp
            ),

        // Optional structured information.
        //
        // Example:
        //
        // {
        //     ssid: "OfficeWiFi",
        //     ip: "192.168.1.50"
        // }
        //
        metadata:
            data.metadata &&
            typeof data.metadata === "object"
                ? data.metadata
                : null
    };
};


// ======================================================
// APPEND LIVE OUTPUT
// ======================================================
//
// Adds one live-output entry for a device.
//
// Example:
//
// appendLiveOutput(
//     12,
//     {
//         level: "INFO",
//         category: "WIFI",
//         message: "Connected to Primary Wi-Fi"
//     }
// );
//
// ======================================================

const appendLiveOutput = (
    deviceId,
    data
) => {

    const normalizedDeviceId =
        normalizeDeviceId(
            deviceId
        );

    const entry =
        createLiveLogEntry(
            data
        );


    // Create the device's log array
    // if it does not exist yet.
    if (
        !deviceLiveLogs.has(
            normalizedDeviceId
        )
    ) {

        deviceLiveLogs.set(
            normalizedDeviceId,
            []
        );
    }


    const logs =
        deviceLiveLogs.get(
            normalizedDeviceId
        );


    logs.push(entry);


    // Keep only the newest entries.
    //
    // If the maximum is 200, then
    // entry 201 removes entry 1.
    if (
        logs.length >
        MAX_LOGS_PER_DEVICE
    ) {

        logs.splice(
            0,
            logs.length -
                MAX_LOGS_PER_DEVICE
        );
    }


    return entry;
};


// ======================================================
// GET LIVE OUTPUT
// ======================================================
//
// Returns the newest live-output entries.
//
// Results are returned newest first.
//
// ======================================================

const getLiveOutput = (
    deviceId,
    limit = 50
) => {

    const normalizedDeviceId =
        normalizeDeviceId(
            deviceId
        );


    const logs =
        deviceLiveLogs.get(
            normalizedDeviceId
        ) || [];


    let requestedLimit =
        Number(limit);


    if (
        !Number.isInteger(
            requestedLimit
        ) ||
        requestedLimit < 1
    ) {

        requestedLimit = 50;
    }


    // Prevent a caller from requesting
    // an unnecessarily large amount of
    // data.
    requestedLimit =
        Math.min(
            requestedLimit,
            MAX_LOGS_PER_DEVICE
        );


    return logs
        .slice(-requestedLimit)
        .reverse();
};


// ======================================================
// GET ALL DEVICE LIVE OUTPUT
// ======================================================
//
// Primarily useful for diagnostics.
//
// Returns an object:
//
// {
//     "1": [...],
//     "2": [...]
// }
//
// ======================================================

const getAllLiveOutput = () => {

    const result = {};


    for (
        const [
            deviceId,
            logs
        ] of deviceLiveLogs.entries()
    ) {

        result[deviceId] =
            logs
                .slice()
                .reverse();
    }


    return result;
};


// ======================================================
// CLEAR DEVICE LIVE OUTPUT
// ======================================================

const clearLiveOutput = (
    deviceId
) => {

    const normalizedDeviceId =
        normalizeDeviceId(
            deviceId
        );

    deviceLiveLogs.delete(
        normalizedDeviceId
    );

    return true;
};


// ======================================================
// CLEAR ALL LIVE OUTPUT
// ======================================================

const clearAllLiveOutput = () => {

    deviceLiveLogs.clear();

    return true;
};


// ======================================================
// GET STORE STATISTICS
// ======================================================
//
// Useful for diagnostics and testing.
//
// ======================================================

const getLiveLogStoreStats = () => {

    let totalEntries = 0;


    for (
        const logs
        of deviceLiveLogs.values()
    ) {

        totalEntries +=
            logs.length;
    }


    return {

        deviceCount:
            deviceLiveLogs.size,

        totalEntries,

        maxLogsPerDevice:
            MAX_LOGS_PER_DEVICE
    };
};


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    MAX_LOGS_PER_DEVICE,

    appendLiveOutput,

    getLiveOutput,

    getAllLiveOutput,

    clearLiveOutput,

    clearAllLiveOutput,

    getLiveLogStoreStats
};