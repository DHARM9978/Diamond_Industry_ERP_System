const prisma =
    require("../config/database");


const {
    OFFICE_CLOSE_SETTING_KEY
} = require("./attendanceSettings.service");


// ============================================================
// AUTOMATIC ATTENDANCE CLOSE SCHEDULER
// ============================================================
//
// Company-level office closing time is stored in Setting as:
//
//   ATTENDANCE_OFFICE_CLOSE_TIME = HH:mm
//
// At/after that time, every employee whose current-day raw punch
// sequence ends with an unmatched IN is automatically closed at
// the configured office closing time.
//
// Raw AttendancePunch records are never inserted, changed or deleted
// by this scheduler. The Attendance table remains the daily summary.
//
// ADMIN manual overrides always have priority and are never replaced.
//
// The scheduler also runs immediately at backend startup, so a restart
// after the configured closing time still settles today's open sessions.
// ============================================================


const SCHEDULER_INTERVAL =
    30 * 1000;


const IST_OFFSET_MS =
    5.5 * 60 * 60 * 1000;


let schedulerStarted =
    false;

let schedulerTimer =
    null;

let schedulerRunning =
    false;


// ============================================================
// INDIA STANDARD TIME HELPERS
// ============================================================

const getISTParts = (
    date = new Date()
) => {

    const value =
        new Date(
            new Date(date).getTime() +
            IST_OFFSET_MS
        );

    return {
        year:
            value.getUTCFullYear(),

        month:
            value.getUTCMonth(),

        day:
            value.getUTCDate()
    };
};


const getISTDateKey = (
    date = new Date()
) => {

    const parts =
        getISTParts(date);

    return `${parts.year}-${String(
        parts.month + 1
    ).padStart(2, "0")}-${String(
        parts.day
    ).padStart(2, "0")}`;
};


const getISTStartOfDay = (
    date = new Date()
) => {

    const parts =
        getISTParts(date);

    return new Date(
        Date.UTC(
            parts.year,
            parts.month,
            parts.day,
            0,
            0,
            0,
            0
        ) -
        IST_OFFSET_MS
    );
};


const getISTCalendarDate = (
    date = new Date()
) => {

    const parts =
        getISTParts(date);

    return new Date(
        Date.UTC(
            parts.year,
            parts.month,
            parts.day,
            0,
            0,
            0,
            0
        )
    );
};


// ============================================================
// OFFICE CLOSE TIME
// ============================================================

const parseOfficeCloseTime = (
    value
) => {

    if (
        typeof value !== "string" ||
        !/^\d{2}:\d{2}$/.test(value)
    ) {
        return null;
    }

    const [
        hours,
        minutes
    ] =
        value
            .split(":")
            .map(Number);

    if (
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        return null;
    }

    return {
        hours,
        minutes
    };
};


const buildTodayCloseInstant = (
    now,
    officeCloseTime
) => {

    const parsed =
        parseOfficeCloseTime(
            officeCloseTime
        );

    if (!parsed) {
        return null;
    }

    const parts =
        getISTParts(now);

    return new Date(
        Date.UTC(
            parts.year,
            parts.month,
            parts.day,
            parsed.hours,
            parsed.minutes,
            0,
            0
        ) -
        IST_OFFSET_MS
    );
};


// ============================================================
// MYSQL TIME HELPERS
// ============================================================

const createMySQLTime = (
    hours,
    minutes
) => {

    return new Date(
        Date.UTC(
            1970,
            0,
            1,
            hours,
            minutes,
            0,
            0
        )
    );
};


const createMySQLTimeFromISTInstant = (
    instant
) => {

    const ist =
        new Date(
            new Date(instant).getTime() +
            IST_OFFSET_MS
        );

    return createMySQLTime(
        ist.getUTCHours(),
        ist.getUTCMinutes()
    );
};


// ============================================================
// PUNCH SESSION CALCULATION
// ============================================================
//
// Rules:
//
// IN
//   -> opens a session
//
// OUT
//   -> closes the currently open session
//
// Multiple IN -> OUT sessions are supported.
//
// A final unmatched IN remains open and is the session that
// AUTO_CLOSE is allowed to close.
// ============================================================

const calculateSessions = (
    punches
) => {

    const sorted =
        [...punches].sort(
            (a, b) =>
                new Date(
                    a.punchedAt
                ).getTime() -
                new Date(
                    b.punchedAt
                ).getTime()
        );

    let firstIn =
        null;

    let openIn =
        null;

    let completedMilliseconds =
        0;


    for (
        const punch of sorted
    ) {

        if (
            punch.punchType === "IN"
        ) {

            if (!firstIn) {

                firstIn =
                    new Date(
                        punch.punchedAt
                    );
            }

            if (!openIn) {

                openIn =
                    new Date(
                        punch.punchedAt
                    );
            }

            continue;
        }


        if (
            punch.punchType === "OUT" &&
            openIn
        ) {

            const outTime =
                new Date(
                    punch.punchedAt
                );

            const duration =
                outTime.getTime() -
                openIn.getTime();

            if (
                duration > 0
            ) {

                completedMilliseconds +=
                    duration;
            }

            openIn =
                null;
        }
    }


    return {

        sorted,

        firstIn,

        openIn,

        completedHours:
            Number(
                (
                    completedMilliseconds /
                    (
                        1000 *
                        60 *
                        60
                    )
                ).toFixed(2)
            )
    };
};


// ============================================================
// PROCESS ONE COMPANY
// ============================================================

const processCompany = async (
    setting,
    now
) => {

    const companyId =
        Number(
            setting.companyId
        );

    const officeCloseTime =
        setting.value;


    const closeInstant =
        buildTodayCloseInstant(
            now,
            officeCloseTime
        );

    if (!closeInstant) {

        console.error(
            `[Attendance Auto Close] Invalid setting for company ${companyId}: ${officeCloseTime}`
        );

        return 0;
    }


    // --------------------------------------------------------
    // OFFICE CLOSE NOT REACHED
    // --------------------------------------------------------

    if (
        now.getTime() <
        closeInstant.getTime()
    ) {

        return 0;
    }


    // --------------------------------------------------------
    // CURRENT IST DAY ONLY
    // --------------------------------------------------------

    const dayStart =
        getISTStartOfDay(
            now
        );

    const dayEnd =
        new Date(
            dayStart.getTime() +
            (
                24 *
                60 *
                60 *
                1000
            )
        );


    // --------------------------------------------------------
    // FETCH RAW PUNCHES
    // --------------------------------------------------------
    //
    // This reads AttendancePunch only.
    // No raw punch is created or changed here.
    // --------------------------------------------------------

    const punches =
        await prisma.attendancePunch.findMany({

            where: {

                punchedAt: {
                    gte: dayStart,
                    lt: dayEnd
                },

                employee: {
                    companyId
                }
            },

            orderBy: {
                punchedAt: "asc"
            }
        });


    // --------------------------------------------------------
    // GROUP PUNCHES BY EMPLOYEE
    // --------------------------------------------------------

    const grouped =
        new Map();


    for (
        const punch of punches
    ) {

        const employeeId =
            Number(
                punch.employeeId
            );

        if (
            !grouped.has(
                employeeId
            )
        ) {

            grouped.set(
                employeeId,
                []
            );
        }

        grouped
            .get(employeeId)
            .push(punch);
    }


    let closedCount =
        0;


    const attendanceDate =
        getISTCalendarDate(
            now
        );


    const autoCloseTime =
        createMySQLTimeFromISTInstant(
            closeInstant
        );


    // ========================================================
    // PROCESS EACH EMPLOYEE
    // ========================================================

    for (
        const [
            employeeId,
            employeePunches
        ]
        of grouped.entries()
    ) {

        const state =
            calculateSessions(
                employeePunches
            );


        // ----------------------------------------------------
        // No open session
        // ----------------------------------------------------

        if (
            !state.openIn ||
            !state.firstIn
        ) {

            continue;
        }


        // ----------------------------------------------------
        // Do not close an IN that happened at/after office
        // closing time.
        // ----------------------------------------------------

        if (
            state.openIn.getTime() >=
            closeInstant.getTime()
        ) {

            continue;
        }


        // ----------------------------------------------------
        // Calculate final open session duration
        // ----------------------------------------------------

        const finalSessionMilliseconds =
            closeInstant.getTime() -
            state.openIn.getTime();


        if (
            finalSessionMilliseconds <= 0
        ) {

            continue;
        }


        const finalSessionHours =
            finalSessionMilliseconds /
            (
                1000 *
                60 *
                60
            );


        const totalHours =
            Number(
                (
                    state.completedHours +
                    finalSessionHours
                ).toFixed(2)
            );


        // ----------------------------------------------------
        // READ EXISTING RESOLVED ATTENDANCE
        // ----------------------------------------------------

        const existing =
            await prisma.attendance.findUnique({

                where: {

                    employeeId_date: {

                        employeeId,

                        date:
                            attendanceDate
                    }
                }
            });


        // ----------------------------------------------------
        // ADMIN MANUAL OVERRIDE PROTECTION
        // ----------------------------------------------------
        //
        // Once an admin explicitly corrects attendance,
        // AUTO_CLOSE must never replace it.
        // ----------------------------------------------------

        if (
            existing?.manualOverride ===
            true
        ) {

            continue;
        }


        // ----------------------------------------------------
        // IDEMPOTENCY CHECK
        // ----------------------------------------------------
        //
        // If the same AUTO_CLOSE result is already stored,
        // do not write it again.
        // ----------------------------------------------------

        if (
            existing?.checkOutTime
        ) {

            const storedHour =
                existing
                    .checkOutTime
                    .getUTCHours();

            const storedMinute =
                existing
                    .checkOutTime
                    .getUTCMinutes();


            const closeHour =
                autoCloseTime
                    .getUTCHours();

            const closeMinute =
                autoCloseTime
                    .getUTCMinutes();


            if (
                storedHour ===
                    closeHour &&

                storedMinute ===
                    closeMinute &&

                Number(
                    existing.totalHours
                ) ===
                    totalHours &&

                existing
                    .resolutionSource ===
                    "AUTO_CLOSE"
            ) {

                continue;
            }
        }


        // ----------------------------------------------------
        // WRITE RESOLVED ATTENDANCE
        // ----------------------------------------------------
        //
        // AUTO_CLOSE affects Attendance only.
        // It never creates a synthetic OUT punch.
        // ----------------------------------------------------

        await prisma.attendance.upsert({

            where: {

                employeeId_date: {

                    employeeId,

                    date:
                        attendanceDate
                }
            },


            update: {

                checkInTime:
                    createMySQLTimeFromISTInstant(
                        state.firstIn
                    ),

                checkOutTime:
                    autoCloseTime,

                totalHours,

                status:
                    "PRESENT",

                resolutionSource:
                    "AUTO_CLOSE"
            },


            create: {

                employeeId,

                date:
                    attendanceDate,

                checkInTime:
                    createMySQLTimeFromISTInstant(
                        state.firstIn
                    ),

                checkOutTime:
                    autoCloseTime,

                totalHours,

                status:
                    "PRESENT",

                resolutionSource:
                    "AUTO_CLOSE",

                manualOverride:
                    false,

                manualOverrideAt:
                    null,

                manualOverrideBy:
                    null
            }
        });


        closedCount +=
            1;


        console.log(

            `[Attendance Auto Close] Company ${companyId} | Employee ${employeeId} | ${getISTDateKey(now)} | closed at ${officeCloseTime} | total ${totalHours.toFixed(2)}h`

        );
    }


    return closedCount;
};


// ============================================================
// RUN SCHEDULER ONCE
// ============================================================

const runAttendanceAutoCloseScheduler =
    async () => {

        if (
            schedulerRunning
        ) {

            return;
        }


        schedulerRunning =
            true;


        try {

            const now =
                new Date();


            const settings =
                await prisma.setting.findMany({

                    where: {

                        key:
                            OFFICE_CLOSE_SETTING_KEY,

                        value: {
                            not: null
                        }
                    },

                    orderBy: {

                        companyId:
                            "asc"
                    }
                });


            for (
                const setting
                of settings
            ) {

                try {

                    await processCompany(
                        setting,
                        now
                    );

                } catch (
                    error
                ) {

                    console.error(

                        `[Attendance Auto Close] Company ${setting.companyId} failed:`,

                        error

                    );
                }
            }


        } catch (
            error
        ) {

            console.error(

                "[Attendance Auto Close] Scheduler error:",

                error

            );

        } finally {

            schedulerRunning =
                false;
        }
    };


// ============================================================
// START SCHEDULER
// ============================================================

const startAttendanceAutoCloseScheduler =
    () => {

        if (
            schedulerStarted
        ) {

            return schedulerTimer;
        }


        schedulerStarted =
            true;


        console.log(
            "[Attendance Auto Close] Scheduler started. Check interval: 30 seconds."
        );


        // ----------------------------------------------------
        // Immediate startup check
        // ----------------------------------------------------

        runAttendanceAutoCloseScheduler()
            .catch(
                (error) => {

                    console.error(

                        "[Attendance Auto Close] Initial run failed:",

                        error

                    );
                }
            );


        // ----------------------------------------------------
        // Periodic check
        // ----------------------------------------------------

        schedulerTimer =
            setInterval(

                () => {

                    runAttendanceAutoCloseScheduler()
                        .catch(
                            (error) => {

                                console.error(

                                    "[Attendance Auto Close] Scheduled run failed:",

                                    error

                                );
                            }
                        );

                },

                SCHEDULER_INTERVAL

            );


        return schedulerTimer;
    };


// ============================================================
// STOP SCHEDULER
// ============================================================

const stopAttendanceAutoCloseScheduler =
    () => {

        if (
            schedulerTimer
        ) {

            clearInterval(
                schedulerTimer
            );

            schedulerTimer =
                null;
        }


        schedulerStarted =
            false;
    };


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    startAttendanceAutoCloseScheduler,

    stopAttendanceAutoCloseScheduler,

    runAttendanceAutoCloseScheduler
};