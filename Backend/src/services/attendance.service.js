const prisma = require("../config/database");


// ======================================================
// INDIA STANDARD TIME
// ======================================================

const IST_OFFSET_MS =
    5.5 * 60 * 60 * 1000;


// ======================================================
// GET IST DATE PARTS
// ======================================================

const getISTDateParts = (date) => {

    const utcDate =
        new Date(date);

    const istDate =
        new Date(
            utcDate.getTime() +
            IST_OFFSET_MS
        );

    return {

        year:
            istDate.getUTCFullYear(),

        month:
            istDate.getUTCMonth(),

        day:
            istDate.getUTCDate()
    };
};


// ======================================================
// GET START OF DAY - IST
// ======================================================

const getStartOfDay = (date) => {

    const {
        year,
        month,
        day
    } = getISTDateParts(date);

    // Midnight of the IST calendar day,
    // represented internally as a UTC instant.
    return new Date(
        Date.UTC(
            year,
            month,
            day,
            0,
            0,
            0,
            0
        ) -
        IST_OFFSET_MS
    );
};


// ======================================================
// GET END OF DAY - IST
// ======================================================

const getEndOfDay = (date) => {

    return new Date(
        getStartOfDay(date).getTime() +
        (24 * 60 * 60 * 1000) -
        1
    );
};


// ======================================================
// GET IST DATE STRING
// ======================================================

const getISTDateString = (date) => {

    const {
        year,
        month,
        day
    } = getISTDateParts(date);

    const monthString =
        String(month + 1).padStart(2, "0");

    const dayString =
        String(day).padStart(2, "0");

    return `${year}-${monthString}-${dayString}`;
};


// ======================================================
// CONVERT MYSQL TIME VALUE TO MINUTES
// ======================================================
//
// Prisma represents MySQL TIME values as Date objects
// using 1970-01-01. We only use the UTC time components.
// ======================================================

const timeValueToMinutes = (timeValue) => {

    if (!timeValue) {
        return null;
    }

    return (
        timeValue.getUTCHours() * 60
    ) +
    timeValue.getUTCMinutes() +
    (
        timeValue.getUTCSeconds() / 60
    );
};


// ======================================================
// CREATE IST INSTANT FROM ATTENDANCE DATE + TIME
// ======================================================
//
// attendanceDate is the MySQL DATE represented by Prisma.
// timeValue is the MySQL TIME represented by Prisma.
//
// This reconstructs the actual IST instant.
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
        timeValue.getUTCHours();

    const minutes =
        timeValue.getUTCMinutes();

    const seconds =
        timeValue.getUTCSeconds();

    const milliseconds =
        timeValue.getUTCMilliseconds();

    // Create the IST clock time as UTC first,
    // then subtract the IST offset to get the real instant.
    return new Date(
        Date.UTC(
            year,
            month,
            day,
            hours,
            minutes,
            seconds,
            milliseconds
        ) -
        IST_OFFSET_MS
    );
};


// ======================================================
// CALCULATE TOTAL WORKING HOURS
// ======================================================
//
// attendanceDate = Attendance.date
// checkInTime    = MySQL TIME
// checkOutTime   = actual punch DateTime
//
// This handles normal and overnight shifts correctly.
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

    const milliseconds =
        new Date(checkOutTime).getTime() -
        checkInInstant.getTime();

    if (milliseconds < 0) {

        return null;
    }

    const hours =
        milliseconds /
        (1000 * 60 * 60);

    return Number(
        hours.toFixed(2)
    );
};


// ======================================================
// PROCESS DEVICE ATTENDANCE PUNCH
// ======================================================

// ======================================================
// PROCESS DEVICE ATTENDANCE PUNCH
// ======================================================

// ======================================================
// PROCESS DEVICE ATTENDANCE PUNCH
// ======================================================

const processDevicePunch = async (data) => {

    const {
        device,
        sensorSlot
    } = data;


    // ==================================================
    // CONFIGURATION
    // ==================================================

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
    // GET EMPLOYEE
    // ==================================================

    const employee =
        fingerprint.employee;


    // ==================================================
    // CHECK EMPLOYEE STATUS
    // ==================================================

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
    // TODAY RANGE
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

                punchedAt:
                    "desc"
            }
        });


    // ==================================================
    // DUPLICATE PUNCH PROTECTION
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
    // DETERMINE PUNCH TYPE
    // ==================================================

    let punchType;


    if (
        todayPunches.length === 0
    ) {

        // First punch of the day
        punchType = "IN";

    } else {

        const lastPunch =
            todayPunches[0];


        if (
            lastPunch.punchType === "IN"
        ) {

            // IN → OUT
            punchType = "OUT";

        } else {

            // OUT → IN
            punchType = "IN";
        }
    }


    console.log(
        "Attendance punch type:",
        punchType
    );


    // ==================================================
    // GET ATTENDANCE RECORD
    // ==================================================

    let attendance =
        await prisma.attendance.findUnique({

            where: {

                employeeId_date: {

                    employeeId:
                        employee.employeeId,

                    date:
                        startOfToday
                }
            }
        });


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
                //
                // Include the punch we just created.
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

                            punchedAt:
                                "asc"
                        }
                    });


                // ======================================
                // CALCULATE TOTAL WORKING HOURS
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

                        // Only open a new interval if
                        // there isn't already an open IN.

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

                        // Only calculate OUT if we have
                        // a corresponding IN.

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


                            // Close this IN → OUT pair.

                            openInTime = null;
                        }
                    }
                }


                // ======================================
                // CONVERT TO HOURS
                // ======================================

                const totalHours =
                    totalMilliseconds /
                    (
                        1000 *
                        60 *
                        60
                    );

                const totalHoursFormatted =formatDuration(totalHours);


                // ======================================
                // CREATE / UPDATE ATTENDANCE
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
                                    punchedAt,

                                checkOutTime:
                                    punchType === "OUT"
                                        ? punchedAt
                                        : null,

                                totalHours:
                                    totalHours > 0
                                        ? Number(
                                            totalHours.toFixed(2)
                                        )
                                        : null,

                                status:
                                    "PRESENT"
                            }
                        });

                } else {

                    // ==================================
                    // UPDATE EXISTING ATTENDANCE
                    // ==================================

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
                                    currentPunch.punchedAt;
                            }

                        } else if (
                            currentPunch.punchType === "OUT"
                        ) {

                            lastOutTime =
                                currentPunch.punchedAt;
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
                                    totalHours > 0
                                        ? Number(
                                            totalHours.toFixed(2)
                                        )
                                        : null,

                                status:
                                    "PRESENT"
                            }
                        });
                }


                // ======================================
                // RETURN
                // ======================================
                return {

                    punch,

                    attendance,

                    totalHours:
                        totalHours > 0
                            ? Number(
                                totalHours.toFixed(2)
                            )
                            : 0,

                    totalHoursFormatted:
                        totalHoursFormatted
                };
            }
        );


    // ==================================================
    // RETURN RESULT
    // ==================================================

    return result;
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


    // ==========================================
    // Specific date
    // ==========================================

    if (date) {

        const selectedDate =
            new Date(
                `${date}T00:00:00`
            );

        const nextDate =
            new Date(
                selectedDate
            );

        nextDate.setDate(
            nextDate.getDate() + 1
        );


        where.date = {

            gte:
                selectedDate,

            lt:
                nextDate
        };
    }


    // ==========================================
    // Date range
    // ==========================================

    else if (
        from ||
        to
    ) {

        where.date = {};


        if (from) {

            where.date.gte =
                new Date(
                    `${from}T00:00:00`
                );
        }


        if (to) {

            const endDate =
                new Date(
                    `${to}T00:00:00`
                );

            endDate.setDate(
                endDate.getDate() + 1
            );


            where.date.lt =
                endDate;
        }
    }


    return await prisma.attendance.findMany({

        where,

        include: {

            employee: {

                select: {

                    employeeId: true,

                    firstName: true,

                    lastName: true,

                    email: true
                }
            }
        },

        orderBy: [

            {
                date:
                    "desc"
            },

            {
                employeeId:
                    "asc"
            }
        ]
    });
};


// ======================================================
// GET ATTENDANCE BY ID
// ======================================================

const getAttendanceById = async (
    attendanceId
) => {

    const attendance =
        await prisma.attendance.findUnique({

            where: {

                attendanceId:
                    Number(attendanceId)
            },

            include: {

                employee: {

                    select: {

                        employeeId: true,

                        firstName: true,

                        lastName: true,

                        email: true
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


    return attendance;
};


// ======================================================
// GET EMPLOYEE ATTENDANCE
// ======================================================

const getEmployeeAttendance = async (
    employeeId,
    filters = {}
) => {

    const {
        from,
        to
    } = filters;


    const where = {

        employeeId:
            Number(employeeId)
    };


    // ==========================================
    // Date filtering
    // ==========================================

    if (
        from ||
        to
    ) {

        where.date = {};


        if (from) {

            where.date.gte =
                new Date(
                    `${from}T00:00:00`
                );
        }


        if (to) {

            const endDate =
                new Date(
                    `${to}T00:00:00`
                );

            endDate.setDate(
                endDate.getDate() + 1
            );


            where.date.lt =
                endDate;
        }
    }


    return await prisma.attendance.findMany({

        where,

        orderBy: {

            date:
                "desc"
        }
    });
};



// ======================================================
// GET DAILY ATTENDANCE SUMMARY
// ======================================================

const getAttendanceSummary = async (date) => {

    const targetDate =
        date
            ? new Date(`${date}T00:00:00`)
            : new Date();

    if (Number.isNaN(targetDate.getTime())) {
        const error = new Error("Invalid date. Use YYYY-MM-DD");
        error.statusCode = 400;
        throw error;
    }

    const startOfDay = getStartOfDay(targetDate);
    const endOfDay = getEndOfDay(targetDate);

    const totalEmployees =
        await prisma.employee.count({
            where: { status: "ACTIVE" }
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
            record => record.status === "PRESENT"
        ).length;

    const checkedIn =
        attendance.filter(
            record =>
                record.checkInTime &&
                !record.checkOutTime
        ).length;

    const checkedOut =
        attendance.filter(
            record => !!record.checkOutTime
        ).length;

    const absent =
        Math.max(totalEmployees - present, 0);

    const totalHours =
        attendance.reduce(
            (total, record) =>
                total +
                (record.totalHours
                    ? Number(record.totalHours)
                    : 0),
            0
        );

    return {
        date: getISTDateString(targetDate),
        totalEmployees,
        present,
        absent,
        checkedIn,
        checkedOut,
        totalHours: Number(totalHours.toFixed(2))
    };
};


// ======================================================
// GET EMPLOYEE ATTENDANCE SUMMARY
// ======================================================

const getEmployeeAttendanceSummary = async (
    employeeId,
    filters = {}
) => {

    const id = Number(employeeId);

    if (!Number.isInteger(id) || id < 1) {
        const error = new Error("Invalid employee ID");
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
        const error = new Error("Employee not found");
        error.statusCode = 404;
        throw error;
    }

    const { from, to } = filters;

    const where = {
        employeeId: id
    };

    if (from || to) {
        where.date = {};

        if (from) {
            const fromDate =
                new Date(`${from}T00:00:00`);

            if (Number.isNaN(fromDate.getTime())) {
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

            if (Number.isNaN(toDate.getTime())) {
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

    const attendance =
        await prisma.attendance.findMany({
            where,
            orderBy: {
                date: "asc"
            }
        });

    const totalDays = attendance.length;

    const presentDays =
        attendance.filter(
            record => record.status === "PRESENT"
        ).length;

    const absentDays =
        attendance.filter(
            record => record.status === "ABSENT"
        ).length;

    const totalHours =
        attendance.reduce(
            (total, record) =>
                total +
                (record.totalHours
                    ? Number(record.totalHours)
                    : 0),
            0
        );

    const averageHours =
        presentDays > 0
            ? totalHours / presentDays
            : 0;

    const totalHoursFormatted =
        formatDuration(totalHours);

    const averageHoursFormatted =
        formatDuration(averageHours);

    return {
        employee: {
            employeeId: employee.employeeId,
            firstName: employee.firstName,
            lastName: employee.lastName,
            email: employee.email,
            status: employee.status
        },
        from: from || null,
        to: to || null,
        totalDays,
        presentDays,
        absentDays,
        totalHours:Number(totalHours.toFixed(2)),
        totalHoursFormatted:totalHoursFormatted,
        averageHours:Number(averageHours.toFixed(2)),
        averageHoursFormatted:averageHoursFormatted
    };
};

// ======================================================
// GET ATTENDANCE WITH FILTERS + PAGINATION
// ======================================================

const getAttendancePaginated = async (filters = {}) => {

    const {
        date,
        from,
        to,
        employeeId,
        page = 1,
        limit = 20
    } = filters;


    const parsedPage = Number(page);
    const parsedLimit = Number(limit);


    // ==============================================
    // Validate page
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
    // Validate limit
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
    // Build WHERE condition
    // ==============================================

    const where = {};


    // ==============================================
    // Employee filter
    // ==============================================

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
    // Date filter
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
                getStartOfDay(
                    selectedDate
                ),

            lt:
                getEndOfDay(
                    selectedDate
                )
        };
    }


    // ==============================================
    // Date range filter
    // ==============================================

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
                getStartOfDay(
                    fromDate
                );
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
                getEndOfDay(
                    toDate
                );
        }
    }


    // ==============================================
    // Pagination
    // ==============================================

    const skip =
        (parsedPage - 1) *
        parsedLimit;


    // ==============================================
    // Fetch attendance + count
    // ==============================================

    const [
        attendance,
        total
    ] =
        await prisma.$transaction([

            prisma.attendance.findMany({

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
                ],


                skip,

                take:
                    parsedLimit
            }),


            prisma.attendance.count({

                where
            })
        ]);


    // ==============================================
    // Pagination information
    // ==============================================

    const totalPages =
        Math.ceil(
            total /
            parsedLimit
        );


    return {

        data:
            attendance,


        pagination: {

            page:
                parsedPage,

            limit:
                parsedLimit,

            total,

            totalPages,

            hasNextPage:
                parsedPage <
                totalPages,

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


    // ==============================================
    // Verify employee
    // ==============================================

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


    // ==============================================
    // Single date
    // ==============================================

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


    // ==============================================
    // Date range
    // ==============================================

    else if (from || to) {

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


    // ==============================================
    // Get punches
    // ==============================================

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

    const id = Number(attendanceId);

    // ==============================================
    // Validate attendance ID
    // ==============================================

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


    // ==============================================
    // Find attendance
    // ==============================================

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


    // ==============================================
    // At least one field must be supplied
    // ==============================================

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


    // ==============================================
    // Convert HH:mm / HH:mm:ss to Date
    //
    // MySQL TIME is represented by Prisma as
    // a Date object based on 1970-01-01.
    // ==============================================

    const parseTime = (value, fieldName) => {

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
        const seconds =
            parts[2] ?? 0;


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


    // ==============================================
    // Prepare times
    // ==============================================

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


    // ==============================================
    // Calculate total hours
    // ==============================================

    let totalHours = null;
    let totalHoursFormatted = "0 minutes";


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


        // ==========================================
        // Overnight shift
        // ==========================================

        if (durationMinutes < 0) {

            durationMinutes += 24 * 60;
        }


        if (durationMinutes > 0) {

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


    // ==============================================
    // Prepare update
    // ==============================================

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
            !allowedStatuses.includes(status)
        ) {

            const error = new Error(
                "Invalid attendance status"
            );

            error.statusCode = 400;

            throw error;
        }


        updateData.status = status;
    }


    // ==============================================
    // Update attendance
    // ==============================================

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


    // ==============================================
    // Return result
    // ==============================================

    return {

        attendance:
            updatedAttendance,

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