const prisma = require("../config/database");

const attendanceService =
    require("../services/attendance.service");


// ==========================================
// Get All Attendance Punches
// ==========================================

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


// ==========================================
// Get Punch By ID
// ==========================================

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


// ==========================================
// Get All Attendance
// ==========================================

const getAttendance = async (req, res) => {
    const { date, from, to, employeeId, page, limit } = req.query;
    const result = await attendanceService.getAttendancePaginated({ date, from, to, employeeId, page, limit });
    return res.status(200).json({ success: true, message: "Attendance records fetched successfully", filters: { date: date || null, from: from || null, to: to || null, employeeId: employeeId ? Number(employeeId) : null }, data: result.data, pagination: result.pagination });
};

// ==========================================
// Get Employee Punch History
// ==========================================

const getEmployeePunchHistory = async (req, res) => {
    const { date, from, to } = req.query;
    const result = await attendanceService.getAttendancePunchHistory(req.params.employeeId, { date, from, to });
    return res.status(200).json({ success: true, message: "Employee attendance punch history fetched successfully", data: result });
};


// ==========================================
// Get Attendance By ID
// ==========================================

const getAttendanceById = async (req, res) => {

    const attendance =
        await attendanceService.getAttendanceById(
            req.params.id
        );


    return res.status(200).json({

        success: true,

        message:
            "Attendance record fetched successfully",

        data: attendance
    });
};

// ==========================================
// Update Attendance
// ==========================================

const updateAttendance = async (req, res) => {

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



// ==========================================
// Get Employee Attendance
// ==========================================

const getEmployeeAttendance = async (
    req,
    res
) => {

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


// ==========================================
// Get Attendance Summary
// ==========================================

const getAttendanceSummary = async (req, res) => {

    const summary =
        await attendanceService.getAttendanceSummary(
            req.query.date
        );

    return res.status(200).json({
        success: true,
        message:
            "Attendance summary fetched successfully",
        data: summary
    });
};


// ==========================================
// Get Employee Attendance Summary
// ==========================================

const getEmployeeAttendanceSummary = async (
    req,
    res
) => {

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
            from: from || null,
            to: to || null
        },
        data: summary
    });
};


module.exports = {
    getPunches,
    getPunchById,
    getAttendance,
    getAttendanceById,
    updateAttendance,
    getEmployeeAttendance,
    getAttendanceSummary,
    getEmployeeAttendanceSummary,
    getEmployeePunchHistory
};