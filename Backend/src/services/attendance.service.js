const prisma = require("../config/database");

// ======================================================
// INDIA STANDARD TIME
// ======================================================

const IST_OFFSET_MS =
    5.5 * 60 * 60 * 1000;


// ======================================================
// DATE / TIME HELPERS
// ======================================================

const getISTDateParts = (date) => {
    const utcDate = new Date(date);

    const istDate = new Date(
        utcDate.getTime() + IST_OFFSET_MS
    );

    return {
        year: istDate.getUTCFullYear(),
        month: istDate.getUTCMonth(),
        day: istDate.getUTCDate()
    };
};


const getStartOfDay = (date) => {
    const {
        year,
        month,
        day
    } = getISTDateParts(date);

    return new Date(
        Date.UTC(
            year,
            month,
            day,
            0,
            0,
            0,
            0
        ) - IST_OFFSET_MS
    );
};


const getEndOfDay = (date) => {
    return new Date(
        getStartOfDay(date).getTime() +
        (24 * 60 * 60 * 1000) -
        1
    );
};


const getISTDateString = (date) => {
    const {
        year,
        month,
        day
    } = getISTDateParts(date);

    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};


// ======================================================
// MYSQL TIME HELPERS
// ======================================================
//
// Prisma represents MySQL TIME values as Date objects
// based on 1970-01-01.
//
// IMPORTANT:
// We use UTC components because the TIME itself has no
// timezone information.
// ======================================================

const timeValueToMinutes = (timeValue) => {
    if (!timeValue) {
        return null;
    }

    if (typeof timeValue === "string") {
        const parts = timeValue
            .split(":")
            .map(Number);

        return (
            parts[0] * 60 +
            parts[1] +
            ((parts[2] || 0) / 60)
        );
    }

    return (
        timeValue.getUTCHours() * 60 +
        timeValue.getUTCMinutes() +
        (
            timeValue.getUTCSeconds() / 60
        )
    );
};


const formatTimeValue = (timeValue) => {
    if (!timeValue) {
        return null;
    }

    // Already a time string
    if (typeof timeValue === "string") {
        const match = timeValue.match(
            /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
        );

        if (!match) {
            return null;
        }

        const hours = String(
            Number(match[1])
        ).padStart(2, "0");

        const minutes = match[2];

        const seconds =
            match[3] || "00";

        return `${hours}:${minutes}:${seconds}`;
    }

    // Prisma MySQL TIME -> Date
    if (timeValue instanceof Date) {
        return [
            String(
                timeValue.getUTCHours()
            ).padStart(2, "0"),

            String(
                timeValue.getUTCMinutes()
            ).padStart(2, "0"),

            String(
                timeValue.getUTCSeconds()
            ).padStart(2, "0")
        ].join(":");
    }

    return null;
};


// ======================================================
// CONVERT REAL TIMESTAMP TO IST MYSQL TIME
// ======================================================
//
// AttendancePunch.punchedAt is a real DateTime instant.
// Attendance.checkInTime/checkOutTime are MySQL TIME values.
// Convert the instant to the Indian clock and keep only HH:mm:ss.
// ======================================================

const createMySQLTimeFromIST = (dateValue) => {
    if (!dateValue) {
        return null;
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const istDate = new Date(
        date.getTime() + IST_OFFSET_MS
    );

    return new Date(
        Date.UTC(
            1970,
            0,
            1,
            istDate.getUTCHours(),
            istDate.getUTCMinutes(),
            istDate.getUTCSeconds(),
            0
        )
    );
};


// ======================================================
// BUILD TODAY'S ATTENDANCE VIEW FROM RAW PUNCHES
// ======================================================
//
// AttendancePunch.punchedAt is the source of truth.
// If the last punch is IN, hours continue up to the current time.
// Checkout stays null until an OUT punch is recorded.
// ======================================================

const buildTodayAttendanceFromPunches = (punches, now) => {
    const groups = new Map();

    for (const punch of punches) {
        const key =
            `${punch.employeeId}|${getISTDateString(punch.punchedAt)}`;

        if (!groups.has(key)) {
            groups.set(key, {
                employeeId: punch.employeeId,
                employee: punch.employee || null,
                date: getStartOfDay(punch.punchedAt),
                punches: []
            });
        }

        groups.get(key).punches.push(punch);
    }

    const result = [];

    for (const group of groups.values()) {
        let firstIn = null;
        let lastOut = null;
        let openIn = null;
        let totalMilliseconds = 0;

        for (const punch of group.punches) {
            if (punch.punchType === "IN") {
                if (firstIn === null) {
                    firstIn = new Date(punch.punchedAt);
                }

                if (openIn === null) {
                    openIn = new Date(punch.punchedAt);
                }
            }
            else if (punch.punchType === "OUT") {
                lastOut = new Date(punch.punchedAt);

                if (openIn !== null) {
                    const duration =
                        lastOut.getTime() - openIn.getTime();

                    if (duration > 0) {
                        totalMilliseconds += duration;
                    }

                    openIn = null;
                }
            }
        }

        // Still checked in: count time from the unmatched IN until now.
        if (openIn !== null) {
            const ongoingDuration =
                now.getTime() - openIn.getTime();

            if (ongoingDuration > 0) {
                totalMilliseconds += ongoingDuration;
            }
        }

        const totalHours =
            totalMilliseconds /
            (1000 * 60 * 60);

        result.push({
            employeeId: group.employeeId,
            date: group.date,
            checkInTime: firstIn
                ? createMySQLTimeFromIST(firstIn)
                : null,
            checkOutTime: lastOut
                ? createMySQLTimeFromIST(lastOut)
                : null,
            totalHours: totalHours > 0
                ? Number(totalHours.toFixed(2))
                : null,
            status: "PRESENT",
            employee: group.employee
        });
    }

    return result;
};


const parseTime = (
    value,
    fieldName
) => {
    if (value === null) {
        return null;
    }

    if (
        typeof value !== "string" ||
        !/^\d{2}:\d{2}(:\d{2})?$/.test(value)
    ) {
        const error = new Error(
            `${fieldName} must use HH:mm or HH:mm:ss format`
        );

        error.statusCode = 400;

        throw error;
    }

    const parts =
        value.split(":").map(Number);

    const hours = parts[0];
    const minutes = parts[1];
    const seconds = parts[2] ?? 0;

    if (
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59 ||
        seconds < 0 ||
        seconds > 59
    ) {
        const error = new Error(
            `${fieldName} contains an invalid time`
        );

        error.statusCode = 400;

        throw error;
    }

    return new Date(
        Date.UTC(
            1970,
            0,
            1,
            hours,
            minutes,
            seconds,
            0
        )
    );
};


// ======================================================
// COMBINE ATTENDANCE DATE + TIME
// ======================================================

const combineAttendanceDateAndTime = (
    attendanceDate,
    timeValue
) => {
    if (
        !attendanceDate ||
        !timeValue
    ) {
        return null;
    }

    const {
        year,
        month,
        day
    } = getISTDateParts(attendanceDate);

    const hours =
        timeValue instanceof Date
            ? timeValue.getUTCHours()
            : Number(
                String(timeValue)
                    .split(":")[0]
            );

    const minutes =
        timeValue instanceof Date
            ? timeValue.getUTCMinutes()
            : Number(
                String(timeValue)
                    .split(":")[1]
            );

    const seconds =
        timeValue instanceof Date
            ? timeValue.getUTCSeconds()
            : Number(
                String(timeValue)
                    .split(":")[2] || 0
            );

    const milliseconds =
        timeValue instanceof Date
            ? timeValue.getUTCMilliseconds()
            : 0;

    return new Date(
        Date.UTC(
            year,
            month,
            day,
            hours,
            minutes,
            seconds,
            milliseconds
        ) - IST_OFFSET_MS
    );
};


// ======================================================
// CALCULATE TOTAL HOURS
// ======================================================

const calculateTotalHours = (
    attendanceDate,
    checkInTime,
    checkOutTime
) => {
    if (
        !attendanceDate ||
        !checkInTime ||
        !checkOutTime
    ) {
        return null;
    }

    const checkInInstant =
        combineAttendanceDateAndTime(
            attendanceDate,
            checkInTime
        );

    if (!checkInInstant) {
        return null;
    }

    const checkOutInstant =
        new Date(checkOutTime);

    let milliseconds =
        checkOutInstant.getTime() -
        checkInInstant.getTime();

    /*
     * If the OUT time is earlier because the
     * attendance crossed midnight, add one day.
     */
    if (milliseconds < 0) {
        milliseconds +=
            24 * 60 * 60 * 1000;
    }

    const hours =
        milliseconds /
        (1000 * 60 * 60);

    return Number(
        hours.toFixed(2)
    );
};


// ======================================================
// FORMAT TOTAL HOURS
// ======================================================

const formatDuration = (hours) => {
    const totalMinutes =
        Math.round(
            Number(hours || 0) * 60
        );

    const wholeHours =
        Math.floor(
            totalMinutes / 60
        );

    const minutes =
        totalMinutes % 60;

    if (
        wholeHours === 0 &&
        minutes === 0
    ) {
        return "0 minutes";
    }

    if (wholeHours === 0) {
        return `${minutes} ${
            minutes === 1
                ? "minute"
                : "minutes"
        }`;
    }

    if (minutes === 0) {
        return `${wholeHours} ${
            wholeHours === 1
                ? "hour"
                : "hours"
        }`;
    }

    return `${wholeHours} ${
        wholeHours === 1
            ? "hour"
            : "hours"
    } ${minutes} ${
        minutes === 1
            ? "minute"
            : "minutes"
    }`;
};


// ======================================================
// SERIALIZE ATTENDANCE RECORD
// ======================================================
//
// This is the important fix.
//
// Instead of returning:
//
// 1970-01-01T22:41:02.000Z
//
// the API returns:
//
// 22:41:02
//
// And instead of:
//
// 2026-09-07T00:00:00.000Z
//
// the API returns:
//
// 2026-09-07
// ======================================================

const serializeAttendance = (
    attendance
) => {
    if (!attendance) {
        return null;
    }

    return {
        ...attendance,

        date:
            attendance.date
                ? getISTDateString(
                    attendance.date
                )
                : null,

        checkInTime:
            formatTimeValue(
                attendance.checkInTime
            ),

        checkOutTime:
            formatTimeValue(
                attendance.checkOutTime
            ),

        totalHours:
            attendance.totalHours !== null &&
            attendance.totalHours !== undefined
                ? Number(attendance.totalHours)
                : null
    };
};


// ======================================================
// PROCESS DEVICE ATTENDANCE PUNCH
// ======================================================

const processDevicePunch = async (data) => {
    const {
        device,
        sensorSlot
    } = data;

    const DUPLICATE_WINDOW_SECONDS = 30;


    // ==================================================
    // VALIDATE DEVICE
    // ==================================================

    if (!device) {
        const error = new Error(
            "Authenticated device is required"
        );

        error.statusCode = 401;

        throw error;
    }


    // ==================================================
    // VALIDATE SENSOR SLOT
    // ==================================================

    if (
        sensorSlot === undefined ||
        sensorSlot === null
    ) {
        const error = new Error(
            "Sensor slot is required"
        );

        error.statusCode = 400;

        throw error;
    }

    const slot =
        Number(sensorSlot);

    if (
        !Number.isInteger(slot) ||
        slot < 1
    ) {
        const error = new Error(
            "Sensor slot must be a positive integer"
        );

        error.statusCode = 400;

        throw error;
    }


    // ==================================================
    // UPDATE DEVICE LAST SEEN
    // ==================================================

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


    // ==================================================
    // FIND FINGERPRINT
    // ==================================================

    const fingerprint =
        await prisma.fingerprintTemplate.findUnique({
            where: {
                sensorSlot: slot
            },

            include: {
                employee: true
            }
        });


    if (!fingerprint) {
        const error = new Error(
            "No fingerprint is registered for this sensor slot"
        );

        error.statusCode = 404;

        throw error;
    }


    // ==================================================
    // CHECK FINGERPRINT STATUS
    // ==================================================

    if (
        fingerprint.status !== "ACTIVE"
    ) {
        const error = new Error(
            "Fingerprint template is inactive"
        );

        error.statusCode = 403;

        throw error;
    }


    // ==================================================
    // EMPLOYEE
    // ==================================================

    const employee =
        fingerprint.employee;


    if (
        employee.status !== "ACTIVE"
    ) {
        const error = new Error(
            "Employee is not active"
        );

        error.statusCode = 403;

        throw error;
    }


    // ==================================================
    // CURRENT TIME
    // ==================================================

    const punchedAt =
        new Date();


    // ==================================================
    // TODAY IN IST
    // ==================================================

    const startOfToday =
        getStartOfDay(punchedAt);

    const endOfToday =
        getEndOfDay(punchedAt);


    // ==================================================
    // GET TODAY'S PUNCHES
    // ==================================================

    const todayPunches =
        await prisma.attendancePunch.findMany({
            where: {
                employeeId:
                    employee.employeeId,

                punchedAt: {
                    gte:
                        startOfToday,

                    lte:
                        endOfToday
                }
            },

            orderBy: {
                punchedAt: "desc"
            }
        });


    // ==================================================
    // DUPLICATE PROTECTION
    // ==================================================

    if (
        todayPunches.length > 0
    ) {
        const lastPunch =
            todayPunches[0];

        const secondsSinceLastPunch =
            (
                punchedAt.getTime() -
                new Date(
                    lastPunch.punchedAt
                ).getTime()
            ) / 1000;

        if (
            secondsSinceLastPunch >= 0 &&
            secondsSinceLastPunch <
                DUPLICATE_WINDOW_SECONDS
        ) {
            const error = new Error(
                `Duplicate punch detected. Please wait ${DUPLICATE_WINDOW_SECONDS} seconds before scanning again.`
            );

            error.statusCode = 409;

            throw error;
        }
    }


    // ==================================================
    // DETERMINE IN / OUT
    // ==================================================

    let punchType = "IN";

    if (
        todayPunches.length > 0
    ) {
        const lastPunch =
            todayPunches[0];

        punchType =
            lastPunch.punchType === "IN"
                ? "OUT"
                : "IN";
    }


    console.log(
        "Attendance punch type:",
        punchType
    );


    // ==================================================
    // TRANSACTION
    // ==================================================

    const result =
        await prisma.$transaction(
            async (tx) => {

                // ======================================
                // CREATE RAW PUNCH
                // ======================================

                const punch =
                    await tx.attendancePunch.create({
                        data: {
                            employeeId:
                                employee.employeeId,

                            deviceId:
                                device.deviceId,

                            sensorSlot:
                                slot,

                            punchType:
                                punchType,

                            punchedAt:
                                punchedAt
                        },

                        include: {
                            employee: {
                                select: {
                                    employeeId: true,
                                    firstName: true,
                                    lastName: true,
                                    email: true
                                }
                            },

                            device: {
                                select: {
                                    deviceId: true,
                                    deviceCode: true,
                                    deviceName: true,
                                    branchId: true
                                }
                            }
                        }
                    });


                // ======================================
                // GET ALL TODAY'S PUNCHES
                // ======================================

                const allPunches =
                    await tx.attendancePunch.findMany({
                        where: {
                            employeeId:
                                employee.employeeId,

                            punchedAt: {
                                gte:
                                    startOfToday,

                                lte:
                                    endOfToday
                            }
                        },

                        orderBy: {
                            punchedAt: "asc"
                        }
                    });


                // ======================================
                // CALCULATE TOTAL WORKING TIME
                // ======================================

                let totalMilliseconds = 0;
                let openInTime = null;


                for (
                    const currentPunch
                    of allPunches
                ) {

                    if (
                        currentPunch.punchType === "IN"
                    ) {
                        if (
                            openInTime === null
                        ) {
                            openInTime =
                                new Date(
                                    currentPunch.punchedAt
                                );
                        }
                    }

                    else if (
                        currentPunch.punchType === "OUT"
                    ) {

                        if (
                            openInTime !== null
                        ) {

                            const outTime =
                                new Date(
                                    currentPunch.punchedAt
                                );

                            const duration =
                                outTime.getTime() -
                                openInTime.getTime();

                            if (
                                duration > 0
                            ) {
                                totalMilliseconds +=
                                    duration;
                            }

                            openInTime = null;
                        }
                    }
                }


                const totalHours =
                    totalMilliseconds /
                    (
                        1000 *
                        60 *
                        60
                    );


                const totalHoursRounded =
                    totalHours > 0
                        ? Number(
                            totalHours.toFixed(2)
                        )
                        : null;


                // ======================================
                // FIND ATTENDANCE
                // ======================================

                let attendance =
                    await tx.attendance.findUnique({
                        where: {
                            employeeId_date: {
                                employeeId:
                                    employee.employeeId,

                                date:
                                    startOfToday
                            }
                        }
                    });


                // ======================================
                // FIRST PUNCH / CREATE
                // ======================================

                if (!attendance) {

                    attendance =
                        await tx.attendance.create({
                            data: {
                                employeeId:
                                    employee.employeeId,

                                date:
                                    startOfToday,

                                checkInTime:
                                    punchType === "IN"
                                        ? createMySQLTimeFromIST(
                                            punchedAt
                                        )
                                        : null,

                                checkOutTime:
                                    punchType === "OUT"
                                        ? createMySQLTimeFromIST(
                                            punchedAt
                                        )
                                        : null,

                                totalHours:
                                    totalHoursRounded,

                                status:
                                    "PRESENT"
                            }
                        });
                }

                // ======================================
                // UPDATE ATTENDANCE
                // ======================================

                else {

                    let firstInTime = null;
                    let lastOutTime = null;


                    for (
                        const currentPunch
                        of allPunches
                    ) {

                        if (
                            currentPunch.punchType === "IN"
                        ) {

                            if (
                                firstInTime === null
                            ) {
                                firstInTime =
                                    createMySQLTimeFromIST(
                                        currentPunch.punchedAt
                                    );
                            }
                        }

                        else if (
                            currentPunch.punchType === "OUT"
                        ) {

                            lastOutTime =
                                createMySQLTimeFromIST(
                                    currentPunch.punchedAt
                                );
                        }
                    }


                    attendance =
                        await tx.attendance.update({
                            where: {
                                attendanceId:
                                    attendance.attendanceId
                            },

                            data: {
                                checkInTime:
                                    firstInTime,

                                checkOutTime:
                                    lastOutTime,

                                totalHours:
                                    totalHoursRounded,

                                status:
                                    "PRESENT"
                            }
                        });
                }


                return {
                    punch,
                    attendance,
                    totalHours:
                        totalHoursRounded || 0,

                    totalHoursFormatted:
                        formatDuration(
                            totalHours
                        )
                };
            }
        );


    return result;
};


// ======================================================
// GET ALL ATTENDANCE
// ======================================================

const getAllAttendance = async (
    filters = {}
) => {

    const {
        date,
        from,
        to
    } = filters;

    const where = {};


    if (date) {

        const selectedDate =
            new Date(
                `${date}T00:00:00`
            );

        if (
            Number.isNaN(
                selectedDate.getTime()
            )
        ) {
            const error = new Error(
                "Invalid date. Use YYYY-MM-DD"
            );

            error.statusCode = 400;

            throw error;
        }

        where.date = {
            gte:
                getStartOfDay(
                    selectedDate
                ),

            lt:
                getEndOfDay(
                    selectedDate
                )
        };
    }

    else if (
        from ||
        to
    ) {

        where.date = {};

        if (from) {

            const fromDate =
                new Date(
                    `${from}T00:00:00`
                );

            if (
                Number.isNaN(
                    fromDate.getTime()
                )
            ) {
                const error = new Error(
                    "Invalid from date. Use YYYY-MM-DD"
                );

                error.statusCode = 400;

                throw error;
            }

            where.date.gte =
                getStartOfDay(
                    fromDate
                );
        }


        if (to) {

            const toDate =
                new Date(
                    `${to}T00:00:00`
                );

            if (
                Number.isNaN(
                    toDate.getTime()
                )
            ) {
                const error = new Error(
                    "Invalid to date. Use YYYY-MM-DD"
                );

                error.statusCode = 400;

                throw error;
            }

            where.date.lt =
                getEndOfDay(
                    toDate
                );
        }
    }


    const attendance =
        await prisma.attendance.findMany({
            where,

            include: {
                employee: {
                    select: {
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        status: true
                    }
                }
            },

            orderBy: [
                {
                    date: "desc"
                },

                {
                    employeeId: "asc"
                }
            ]
        });


    return attendance.map(
        serializeAttendance
    );
};


// ======================================================
// GET ATTENDANCE BY ID
// ======================================================

const getAttendanceById = async (
    attendanceId
) => {

    const id =
        Number(attendanceId);

    if (
        !Number.isInteger(id) ||
        id < 1
    ) {
        const error = new Error(
            "Invalid attendance ID"
        );

        error.statusCode = 400;

        throw error;
    }


    const attendance =
        await prisma.attendance.findUnique({
            where: {
                attendanceId: id
            },

            include: {
                employee: {
                    select: {
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        status: true
                    }
                }
            }
        });


    if (!attendance) {
        const error = new Error(
            "Attendance record not found"
        );

        error.statusCode = 404;

        throw error;
    }


    return serializeAttendance(
        attendance
    );
};


// ======================================================
// GET EMPLOYEE ATTENDANCE
// ======================================================

const getEmployeeAttendance = async (
    employeeId,
    filters = {}
) => {

    const id =
        Number(employeeId);

    if (
        !Number.isInteger(id) ||
        id < 1
    ) {
        const error = new Error(
            "Invalid employee ID"
        );

        error.statusCode = 400;

        throw error;
    }


    const {
        from,
        to
    } = filters;


    const where = {
        employeeId: id
    };


    if (
        from ||
        to
    ) {

        where.date = {};


        if (from) {

            const fromDate =
                new Date(
                    `${from}T00:00:00`
                );

            if (
                Number.isNaN(
                    fromDate.getTime()
                )
            ) {
                const error = new Error(
                    "Invalid from date. Use YYYY-MM-DD"
                );

                error.statusCode = 400;

                throw error;
            }

            where.date.gte =
                getStartOfDay(
                    fromDate
                );
        }


        if (to) {

            const toDate =
                new Date(
                    `${to}T00:00:00`
                );

            if (
                Number.isNaN(
                    toDate.getTime()
                )
            ) {
                const error = new Error(
                    "Invalid to date. Use YYYY-MM-DD"
                );

                error.statusCode = 400;

                throw error;
            }

            where.date.lt =
                getEndOfDay(
                    toDate
                );
        }
    }


    const attendance =
        await prisma.attendance.findMany({
            where,

            include: {
                employee: {
                    select: {
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        status: true
                    }
                }
            },

            orderBy: {
                date: "desc"
            }
        });


    return attendance.map(
        serializeAttendance
    );
};


// ======================================================
// GET DAILY ATTENDANCE SUMMARY
// ======================================================

const getAttendanceSummary = async (
    date
) => {

    const targetDate =
        date
            ? new Date(
                `${date}T00:00:00`
            )
            : new Date();


    if (
        Number.isNaN(
            targetDate.getTime()
        )
    ) {
        const error = new Error(
            "Invalid date. Use YYYY-MM-DD"
        );

        error.statusCode = 400;

        throw error;
    }


    const startOfDay =
        getStartOfDay(
            targetDate
        );

    const endOfDay =
        getEndOfDay(
            targetDate
        );


    const totalEmployees =
        await prisma.employee.count({
            where: {
                status: "ACTIVE"
            }
        });


    const attendance =
        await prisma.attendance.findMany({
            where: {
                date: {
                    gte: startOfDay,
                    lt: endOfDay
                },

                employee: {
                    status: "ACTIVE"
                }
            },

            select: {
                employeeId: true,
                checkInTime: true,
                checkOutTime: true,
                totalHours: true,
                status: true
            }
        });


    const present =
        attendance.filter(
            record =>
                record.status === "PRESENT"
        ).length;


    const checkedIn =
        attendance.filter(
            record =>
                record.checkInTime &&
                !record.checkOutTime
        ).length;


    const checkedOut =
        attendance.filter(
            record =>
                !!record.checkOutTime
        ).length;


    const absent =
        Math.max(
            totalEmployees - present,
            0
        );


    const totalHours =
        attendance.reduce(
            (total, record) =>
                total +
                (
                    record.totalHours
                        ? Number(
                            record.totalHours
                        )
                        : 0
                ),
            0
        );


    return {
        date:
            getISTDateString(
                targetDate
            ),

        totalEmployees,

        present,

        absent,

        checkedIn,

        checkedOut,

        totalHours:
            Number(
                totalHours.toFixed(2)
            )
    };
};


// ======================================================
// GET EMPLOYEE ATTENDANCE SUMMARY
// ======================================================

const getEmployeeAttendanceSummary = async (
    employeeId,
    filters = {}
) => {

    const id =
        Number(employeeId);

    if (
        !Number.isInteger(id) ||
        id < 1
    ) {
        const error = new Error(
            "Invalid employee ID"
        );

        error.statusCode = 400;

        throw error;
    }


    const employee =
        await prisma.employee.findUnique({
            where: {
                employeeId: id
            },

            select: {
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
                status: true
            }
        });


    if (!employee) {
        const error = new Error(
            "Employee not found"
        );

        error.statusCode = 404;

        throw error;
    }


    const {
        from,
        to
    } = filters;


    const where = {
        employeeId: id
    };


    if (
        from ||
        to
    ) {

        where.date = {};


        if (from) {

            const fromDate =
                new Date(
                    `${from}T00:00:00`
                );

            if (
                Number.isNaN(
                    fromDate.getTime()
                )
            ) {
                const error = new Error(
                    "Invalid from date. Use YYYY-MM-DD"
                );

                error.statusCode = 400;

                throw error;
            }

            where.date.gte =
                getStartOfDay(
                    fromDate
                );
        }


        if (to) {

            const toDate =
                new Date(
                    `${to}T00:00:00`
                );

            if (
                Number.isNaN(
                    toDate.getTime()
                )
            ) {
                const error = new Error(
                    "Invalid to date. Use YYYY-MM-DD"
                );

                error.statusCode = 400;

                throw error;
            }

            where.date.lt =
                getEndOfDay(
                    toDate
                );
        }
    }


    const attendance =
        await prisma.attendance.findMany({
            where,

            orderBy: {
                date: "asc"
            }
        });


    const totalDays =
        attendance.length;


    const presentDays =
        attendance.filter(
            record =>
                record.status === "PRESENT"
        ).length;


    const absentDays =
        attendance.filter(
            record =>
                record.status === "ABSENT"
        ).length;


    const totalHours =
        attendance.reduce(
            (total, record) =>
                total +
                (
                    record.totalHours
                        ? Number(
                            record.totalHours
                        )
                        : 0
                ),
            0
        );


    const averageHours =
        presentDays > 0
            ? totalHours / presentDays
            : 0;


    return {
        employee: {
            employeeId:
                employee.employeeId,

            firstName:
                employee.firstName,

            lastName:
                employee.lastName,

            email:
                employee.email,

            status:
                employee.status
        },

        from:
            from || null,

        to:
            to || null,

        totalDays,

        presentDays,

        absentDays,

        totalHours:
            Number(
                totalHours.toFixed(2)
            ),

        totalHoursFormatted:
            formatDuration(
                totalHours
            ),

        averageHours:
            Number(
                averageHours.toFixed(2)
            ),

        averageHoursFormatted:
            formatDuration(
                averageHours
            )
    };
};


// ======================================================
// GET ATTENDANCE WITH FILTERS + PAGINATION
// ======================================================

const getAttendancePaginated = async (
    filters = {}
) => {

    const {
        date,
        from,
        to,
        employeeId,
        page = 1,
        limit = 20
    } = filters;


    const parsedPage =
        Number(page);

    const parsedLimit =
        Number(limit);


    // ==============================================
    // VALIDATE PAGE
    // ==============================================

    if (
        !Number.isInteger(parsedPage) ||
        parsedPage < 1
    ) {
        const error = new Error(
            "Page must be a positive integer"
        );

        error.statusCode = 400;
        throw error;
    }


    // ==============================================
    // VALIDATE LIMIT
    // ==============================================

    if (
        !Number.isInteger(parsedLimit) ||
        parsedLimit < 1 ||
        parsedLimit > 100
    ) {
        const error = new Error(
            "Limit must be between 1 and 100"
        );

        error.statusCode = 400;
        throw error;
    }


    // ==============================================
    // WHERE
    // ==============================================

    const where = {};


    if (
        employeeId !== undefined &&
        employeeId !== ""
    ) {
        const id = Number(employeeId);

        if (
            !Number.isInteger(id) ||
            id < 1
        ) {
            const error = new Error(
                "Invalid employee ID"
            );

            error.statusCode = 400;
            throw error;
        }

        where.employeeId = id;
    }


    // ==============================================
    // DATE FILTER
    // ==============================================

    if (date) {
        const selectedDate =
            new Date(`${date}T00:00:00`);

        if (
            Number.isNaN(
                selectedDate.getTime()
            )
        ) {
            const error = new Error(
                "Invalid date. Use YYYY-MM-DD"
            );

            error.statusCode = 400;
            throw error;
        }

        where.date = {
            gte:
                getStartOfDay(selectedDate),
            lt:
                getEndOfDay(selectedDate)
        };
    }
    else if (from || to) {
        where.date = {};

        if (from) {
            const fromDate =
                new Date(`${from}T00:00:00`);

            if (
                Number.isNaN(
                    fromDate.getTime()
                )
            ) {
                const error = new Error(
                    "Invalid from date. Use YYYY-MM-DD"
                );

                error.statusCode = 400;
                throw error;
            }

            where.date.gte =
                getStartOfDay(fromDate);
        }

        if (to) {
            const toDate =
                new Date(`${to}T00:00:00`);

            if (
                Number.isNaN(
                    toDate.getTime()
                )
            ) {
                const error = new Error(
                    "Invalid to date. Use YYYY-MM-DD"
                );

                error.statusCode = 400;
                throw error;
            }

            where.date.lt =
                getEndOfDay(toDate);
        }
    }


    const skip =
        (parsedPage - 1) * parsedLimit;


    // ==============================================
    // LOAD STORED ATTENDANCE
    // ==============================================

    const attendance =
        await prisma.attendance.findMany({
            where,

            include: {
                employee: {
                    select: {
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        status: true
                    }
                }
            }
        });


    // ==============================================
    // LOAD TODAY'S RAW PUNCHES
    // ==============================================
    //
    // When no historical date filter is selected, include today's
    // punches so the Attendance page behaves like a current-day view.
    // ==============================================

    const now = new Date();
    const todayStart = getStartOfDay(now);
    const todayEnd = getEndOfDay(now);

    const includeToday =
        !date &&
        !from &&
        !to;

    const todayPunches =
        includeToday
            ? await prisma.attendancePunch.findMany({
                where: {
                    punchedAt: {
                        gte: todayStart,
                        lte: todayEnd
                    },

                    ...(employeeId !== undefined &&
                    employeeId !== ""
                        ? {
                            employeeId: Number(employeeId)
                        }
                        : {})
                },

                include: {
                    employee: {
                        select: {
                            employeeId: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            status: true
                        }
                    }
                },

                orderBy: {
                    punchedAt: "asc"
                }
            })
            : [];


    const todayViews =
        buildTodayAttendanceFromPunches(
            todayPunches,
            now
        );


    // ==============================================
    // MERGE TODAY'S RAW DATA INTO ATTENDANCE DATA
    // ==============================================

    const merged = new Map();


    for (const record of attendance) {
        const key =
            `${record.employeeId}|${getISTDateString(
                record.date
            )}`;

        merged.set(key, record);
    }


    for (const todayView of todayViews) {
        const key =
            `${todayView.employeeId}|${getISTDateString(
                todayView.date
            )}`;

        const existing = merged.get(key);

        if (existing) {
            merged.set(key, {
                ...existing,
                checkInTime:
                    todayView.checkInTime,
                checkOutTime:
                    todayView.checkOutTime,
                totalHours:
                    todayView.totalHours,
                status: "PRESENT",
                employee:
                    existing.employee ||
                    todayView.employee
            });
        }
        else {
            // Defensive fallback: a raw IN punch must be visible even
            // when its summary Attendance row has not been created.
            merged.set(key, {
                attendanceId: null,
                employeeId:
                    todayView.employeeId,
                date:
                    todayView.date,
                checkInTime:
                    todayView.checkInTime,
                checkOutTime:
                    todayView.checkOutTime,
                totalHours:
                    todayView.totalHours,
                status:
                    "PRESENT",
                createdAt:
                    now,
                updatedAt:
                    now,
                employee:
                    todayView.employee
            });
        }
    }


    // ==============================================
    // SORT ALL RECORDS
    // ==============================================

    const mergedAttendance =
        Array.from(merged.values()).sort(
            (a, b) => {
                const aTime =
                    new Date(a.date).getTime();

                const bTime =
                    new Date(b.date).getTime();

                if (aTime !== bTime) {
                    return bTime - aTime;
                }

                return (
                    Number(a.employeeId) -
                    Number(b.employeeId)
                );
            }
        );


    const total =
        mergedAttendance.length;


    // ==============================================
    // PAGINATION
    // ==============================================

    const pagedAttendance =
        mergedAttendance.slice(
            skip,
            skip + parsedLimit
        );


    // ==============================================
    // SERIALIZE
    // ==============================================

    const serializedAttendance =
        pagedAttendance.map(
            serializeAttendance
        );


    const totalPages =
        Math.ceil(
            total /
            parsedLimit
        );


    return {
        data:
            serializedAttendance,

        pagination: {
            page:
                parsedPage,

            limit:
                parsedLimit,

            total,

            totalPages,

            hasNextPage:
                parsedPage < totalPages,

            hasPreviousPage:
                parsedPage > 1
        }
    };
};


// ======================================================
// GET ATTENDANCE PUNCH HISTORY
// ======================================================

const getAttendancePunchHistory = async (
    employeeId,
    filters = {}
) => {

    const id =
        Number(employeeId);

    if (
        !Number.isInteger(id) ||
        id < 1
    ) {
        const error = new Error(
            "Invalid employee ID"
        );

        error.statusCode = 400;

        throw error;
    }


    const employee =
        await prisma.employee.findUnique({
            where: {
                employeeId: id
            },

            select: {
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
                status: true
            }
        });


    if (!employee) {
        const error = new Error(
            "Employee not found"
        );

        error.statusCode = 404;

        throw error;
    }


    const {
        date,
        from,
        to
    } = filters;


    const where = {
        employeeId: id
    };


    if (date) {

        const selectedDate =
            new Date(
                `${date}T00:00:00`
            );


        if (
            Number.isNaN(
                selectedDate.getTime()
            )
        ) {
            const error = new Error(
                "Invalid date. Use YYYY-MM-DD"
            );

            error.statusCode = 400;

            throw error;
        }


        where.punchedAt = {
            gte:
                getStartOfDay(
                    selectedDate
                ),

            lt:
                getEndOfDay(
                    selectedDate
                )
        };
    }

    else if (
        from ||
        to
    ) {

        where.punchedAt = {};


        if (from) {

            const fromDate =
                new Date(
                    `${from}T00:00:00`
                );


            if (
                Number.isNaN(
                    fromDate.getTime()
                )
            ) {
                const error = new Error(
                    "Invalid from date. Use YYYY-MM-DD"
                );

                error.statusCode = 400;

                throw error;
            }


            where.punchedAt.gte =
                getStartOfDay(
                    fromDate
                );
        }


        if (to) {

            const toDate =
                new Date(
                    `${to}T00:00:00`
                );


            if (
                Number.isNaN(
                    toDate.getTime()
                )
            ) {
                const error = new Error(
                    "Invalid to date. Use YYYY-MM-DD"
                );

                error.statusCode = 400;

                throw error;
            }


            where.punchedAt.lt =
                getEndOfDay(
                    toDate
                );
        }
    }


    const punches =
        await prisma.attendancePunch.findMany({
            where,

            include: {
                device: {
                    select: {
                        deviceId: true,
                        deviceCode: true,
                        deviceName: true,
                        branchId: true
                    }
                }
            },

            orderBy: {
                punchedAt: "asc"
            }
        });


    return {
        employee,

        filters: {
            date:
                date || null,

            from:
                from || null,

            to:
                to || null
        },

        totalPunches:
            punches.length,

        punches:
            punches.map(
                punch => ({
                    ...punch,

                    punchId:
                        punch.punchId.toString()
                })
            )
    };
};


// ======================================================
// ADMIN ATTENDANCE CORRECTION
// ======================================================

const updateAttendance = async (
    attendanceId,
    data,
    adminUser = null
) => {

    const id =
        Number(attendanceId);


    if (
        !Number.isInteger(id) ||
        id < 1
    ) {
        const error = new Error(
            "Invalid attendance ID"
        );

        error.statusCode = 400;

        throw error;
    }


    const existingAttendance =
        await prisma.attendance.findUnique({
            where: {
                attendanceId: id
            },

            include: {
                employee: {
                    select: {
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        status: true
                    }
                }
            }
        });


    if (!existingAttendance) {
        const error = new Error(
            "Attendance record not found"
        );

        error.statusCode = 404;

        throw error;
    }


    const {
        checkInTime,
        checkOutTime,
        status
    } = data;


    if (
        checkInTime === undefined &&
        checkOutTime === undefined &&
        status === undefined
    ) {
        const error = new Error(
            "At least one attendance field is required"
        );

        error.statusCode = 400;

        throw error;
    }


    const newCheckInTime =
        checkInTime !== undefined
            ? parseTime(
                checkInTime,
                "checkInTime"
            )
            : existingAttendance.checkInTime;


    const newCheckOutTime =
        checkOutTime !== undefined
            ? parseTime(
                checkOutTime,
                "checkOutTime"
            )
            : existingAttendance.checkOutTime;


    let totalHours = null;
    let totalHoursFormatted =
        "0 minutes";


    if (
        newCheckInTime &&
        newCheckOutTime
    ) {

        const checkInMinutes =
            timeValueToMinutes(
                newCheckInTime
            );


        const checkOutMinutes =
            timeValueToMinutes(
                newCheckOutTime
            );


        let durationMinutes =
            checkOutMinutes -
            checkInMinutes;


        if (
            durationMinutes < 0
        ) {
            durationMinutes +=
                24 * 60;
        }


        if (
            durationMinutes > 0
        ) {

            totalHours =
                Number(
                    (
                        durationMinutes / 60
                    ).toFixed(2)
                );


            totalHoursFormatted =
                formatDuration(
                    totalHours
                );
        }
    }


    const updateData = {};


    if (
        checkInTime !== undefined
    ) {
        updateData.checkInTime =
            newCheckInTime;
    }


    if (
        checkOutTime !== undefined
    ) {
        updateData.checkOutTime =
            newCheckOutTime;
    }


    if (
        checkInTime !== undefined ||
        checkOutTime !== undefined
    ) {
        updateData.totalHours =
            totalHours;
    }


    if (
        status !== undefined
    ) {

        const allowedStatuses = [
            "PRESENT",
            "ABSENT"
        ];


        if (
            !allowedStatuses.includes(
                status
            )
        ) {
            const error = new Error(
                "Invalid attendance status"
            );

            error.statusCode = 400;

            throw error;
        }


        updateData.status =
            status;
    }


    const updatedAttendance =
        await prisma.attendance.update({
            where: {
                attendanceId: id
            },

            data: updateData,

            include: {
                employee: {
                    select: {
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        status: true
                    }
                }
            }
        });


    return {
        attendance:
            serializeAttendance(
                updatedAttendance
            ),

        totalHours,

        totalHoursFormatted,

        correctedBy:
            adminUser?.userId ||
            adminUser?.id ||
            null
    };
};


// ======================================================
// EXPORT
// ======================================================

module.exports = {
    processDevicePunch,

    getAllAttendance,

    getAttendancePaginated,

    getAttendancePunchHistory,

    getAttendanceById,

    getEmployeeAttendance,

    getAttendanceSummary,

    getEmployeeAttendanceSummary,

    updateAttendance
};