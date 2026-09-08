const prisma = require("../config/database");
const attendanceService =
    require("../services/attendance.service");

// Get all raw attendance punches.
const getPunches = async (req, res) => {
    const punches =
        await prisma.attendancePunch.findMany({
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
            },
            orderBy: {
                punchedAt: "desc"
            }
        });

    const safePunches =
        punches.map((punch) => ({
            ...punch,
            punchId:
                punch.punchId.toString()
        }));

    return res.status(200).json({
        success: true,
        message:
            "Attendance punches fetched successfully",
        data: safePunches
    });
};

// Get today's attendance data for the Live Attendance page.
const getLiveAttendance = async (req, res) => {
    try {
        const companyId =
            Number(req.user?.companyId);

        if (
            !Number.isInteger(companyId) ||
            companyId < 1
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Admin company information is missing"
            });
        }

        const now = new Date();

        // Convert current time to IST for determining today's date.
        const IST_OFFSET_MS =
            5.5 * 60 * 60 * 1000;

        const istNow =
            new Date(
                now.getTime() +
                IST_OFFSET_MS
            );

        const year =
            istNow.getUTCFullYear();

        const month =
            istNow.getUTCMonth();

        const day =
            istNow.getUTCDate();

        // Start of the current day in IST.
        const startOfDay =
            new Date(
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

        // Start of the next day in IST.
        const endOfDay =
            new Date(
                Date.UTC(
                    year,
                    month,
                    day + 1,
                    0,
                    0,
                    0,
                    0
                ) - IST_OFFSET_MS
            );

        // Fetch today's punches for the administrator's company.
        const punches =
            await prisma.attendancePunch.findMany({
                where: {
                    punchedAt: {
                        gte: startOfDay,
                        lt: endOfDay
                    },
                    employee: {
                        companyId: companyId
                    }
                },
                include: {
                    employee: {
                        select: {
                            employeeId: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            companyId: true,
                            branchId: true,
                            departmentId: true,
                            status: true
                        }
                    },
                    device: {
                        select: {
                            deviceId: true,
                            deviceCode: true,
                            deviceName: true,
                            branchId: true,
                            location: true,
                            status: true,
                            lastSeenAt: true
                        }
                    }
                },
                orderBy: {
                    punchedAt: "desc"
                },
                take: 200
            });

        // Convert BigInt IDs to numbers/strings that can safely
        // be returned through JSON.
        const safePunches =
            punches.map((punch) => ({
                ...punch,

                punchId:
                    punch.punchId.toString(),

                employee: punch.employee
                    ? {
                        ...punch.employee,

                        employeeId:
                            Number(
                                punch.employee.employeeId
                            )
                    }
                    : null,

                device: punch.device
                    ? {
                        ...punch.device,

                        deviceId:
                            Number(
                                punch.device.deviceId
                            )
                    }
                    : null
            }));

        /*
         * Determine each employee's current state.
         *
         * Because punches are sorted newest first:
         *
         * IN  = currently working
         * OUT = currently not working
         *
         * Only the latest punch for each employee is used.
         */
        const employeeStates =
            new Map();

        for (
            const punch of safePunches
        ) {
            const employeeId =
                punch.employee?.employeeId;

            if (!employeeId) {
                continue;
            }

            if (
                !employeeStates.has(employeeId)
            ) {
                employeeStates.set(
                    employeeId,
                    {
                        employee:
                            punch.employee,

                        latestPunch:
                            punch,

                        isWorking:
                            punch.punchType === "IN"
                    }
                );
            }
        }

        // Employees who currently have an IN state.
        const currentlyWorking =
            Array.from(
                employeeStates.values()
            )
                .filter(
                    (employee) =>
                        employee.isWorking
                )
                .map(
                    (employee) => ({
                        employee:
                            employee.employee,

                        lastPunch:
                            employee.latestPunch
                    })
                );

        // Number of unique employees who punched today.
        const employeesToday =
            employeeStates.size;

        // Total number of punches today.
        const totalPunches =
            safePunches.length;

        // Total IN punches today.
        const totalIn =
            safePunches.filter(
                (punch) =>
                    punch.punchType === "IN"
            ).length;

        // Total OUT punches today.
        const totalOut =
            safePunches.filter(
                (punch) =>
                    punch.punchType === "OUT"
            ).length;

        // Most recent punch.
        const lastPunch =
            safePunches.length > 0
                ? safePunches[0]
                : null;

        // Format the date as YYYY-MM-DD.
        const formattedDate =
            `${year}-${String(
                month + 1
            ).padStart(2, "0")}-${String(
                day
            ).padStart(2, "0")}`;

        return res.status(200).json({
            success: true,

            message:
                "Live attendance fetched successfully",

            data: {
                date:
                    formattedDate,

                serverTime:
                    now.toISOString(),

                statistics: {
                    totalPunches,

                    totalIn,

                    totalOut,

                    employeesToday,

                    currentlyWorking:
                        currentlyWorking.length
                },

                lastPunch,

                currentlyWorking,

                punches:
                    safePunches
            }
        });
    } catch (error) {
        console.error(
            "Live attendance error:",
            error
        );

        return res.status(500).json({
            success: false,

            message:
                "Failed to fetch live attendance",

            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined
        });
    }
};

// Get a single attendance punch by ID.
const getPunchById = async (req, res) => {
    const punch =
        await prisma.attendancePunch.findUnique({
            where: {
                punchId:
                    BigInt(req.params.id)
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

    if (!punch) {
        return res.status(404).json({
            success: false,
            message:
                "Attendance punch not found"
        });
    }

    return res.status(200).json({
        success: true,

        message:
            "Attendance punch fetched successfully",

        data: {
            ...punch,

            punchId:
                punch.punchId.toString()
        }
    });
};

// Get paginated attendance records.
const getAttendance = async (req, res) => {

    console.log("======================================");
    console.log("ATTENDANCE CONTROLLER GET ATTENDANCE HIT");
    console.log("URL:", req.originalUrl);
    console.log("METHOD:", req.method);
    console.log("======================================");
    const {
        date,
        from,
        to,
        employeeId,
        page,
        limit
    } = req.query;

    const result =
        await attendanceService.getAttendancePaginated({
            date,
            from,
            to,
            employeeId,
            page,
            limit
        });

    return res.status(200).json({
        success: true,

        message:
            "Attendance records fetched successfully",

        filters: {
            date:
                date || null,

            from:
                from || null,

            to:
                to || null,

            employeeId:
                employeeId
                    ? Number(employeeId)
                    : null
        },

        data:
            result.data,

        pagination:
            result.pagination
    });
};

// Get raw punch history for one employee.
const getEmployeePunchHistory =
    async (req, res) => {
        const {
            date,
            from,
            to
        } = req.query;

        const result =
            await attendanceService.getAttendancePunchHistory(
                req.params.employeeId,
                {
                    date,
                    from,
                    to
                }
            );

        return res.status(200).json({
            success: true,

            message:
                "Employee attendance punch history fetched successfully",

            data:
                result
        });
    };

// Get one attendance record.
const getAttendanceById =
    async (req, res) => {
        const attendance =
            await attendanceService.getAttendanceById(
                req.params.id
            );

        return res.status(200).json({
            success: true,

            message:
                "Attendance record fetched successfully",

            data:
                attendance
        });
    };

// Update/correct an attendance record.
const updateAttendance =
    async (req, res) => {
        const result =
            await attendanceService.updateAttendance(
                req.params.id,
                req.body,
                req.user
            );

        return res.status(200).json({
            success: true,

            message:
                "Attendance record updated successfully",

            data: {
                attendance:
                    result.attendance,

                totalHours:
                    result.totalHours,

                totalHoursFormatted:
                    result.totalHoursFormatted,

                correctedBy:
                    result.correctedBy
            }
        });
    };

// Get attendance for one employee.
const getEmployeeAttendance =
    async (req, res) => {
        const {
            from,
            to
        } = req.query;

        const attendance =
            await attendanceService.getEmployeeAttendance(
                req.params.employeeId,
                {
                    from,
                    to
                }
            );

        return res.status(200).json({
            success: true,

            message:
                "Employee attendance fetched successfully",

            filters: {
                from:
                    from || null,

                to:
                    to || null
            },

            data:
                attendance
        });
    };

// Get attendance summary.
const getAttendanceSummary =
    async (req, res) => {
        const summary =
            await attendanceService.getAttendanceSummary(
                req.query.date
            );

        return res.status(200).json({
            success: true,

            message:
                "Attendance summary fetched successfully",

            data:
                summary
        });
    };

// Get attendance summary for one employee.
const getEmployeeAttendanceSummary =
    async (req, res) => {
        const {
            from,
            to
        } = req.query;

        const summary =
            await attendanceService.getEmployeeAttendanceSummary(
                req.params.employeeId,
                {
                    from,
                    to
                }
            );

        return res.status(200).json({
            success: true,

            message:
                "Employee attendance summary fetched successfully",

            filters: {
                from:
                    from || null,

                to:
                    to || null
            },

            data:
                summary
        });
    };

module.exports = {
    getPunches,
    getLiveAttendance,
    getPunchById,
    getAttendance,
    getAttendanceById,
    updateAttendance,
    getEmployeeAttendance,
    getAttendanceSummary,
    getEmployeeAttendanceSummary,
    getEmployeePunchHistory
};