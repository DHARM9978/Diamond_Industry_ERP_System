const prisma =
    require("../config/database");

const attendanceService =
    require("../services/attendance.service");

const payrollService =
    require("../services/payroll.service");

const advanceService =
    require("../services/advance.service");


// ==========================================
// Helpers
// ==========================================

const padNumber = (value) =>
    String(value).padStart(2, "0");


const getISTDateString = (date = new Date()) => {

    const parts =
        new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(date);


    const values = {};


    for (const part of parts) {

        if (
            part.type === "year" ||
            part.type === "month" ||
            part.type === "day"
        ) {
            values[part.type] =
                part.value;
        }
    }


    return `${values.year}-${values.month}-${values.day}`;
};


const getCurrentMonthStart = () => {

    const today =
        getISTDateString();

    const [year, month] =
        today.split("-");


    return `${year}-${padNumber(month)}-01`;
};


const getDateValueOrNull = (value) => {

    if (!value) {
        return null;
    }


    const parsed = new Date(value);


    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return null;
    }


    return parsed;
};


// ==========================================
// Get My Profile
// GET /api/me/profile
// ==========================================

const getMyProfile = async (
    req,
    res
) => {

    const employee =
        await prisma.employee.findFirst({

            where: {

                employeeId:
                    req.user.employeeId,

                companyId:
                    req.user.companyId
            },

            select: {

                employeeId: true,

                firstName: true,

                lastName: true,

                gender: true,

                email: true,

                phone: true,

                hireDate: true,

                role: true,


                // ==================================
                // Salary Information
                // ==================================

                baseSalary: true,

                monthlyExpectedHours: true,

                salaryRatePerHour: true,


                companyId: true,

                branchId: true,

                departmentId: true,

                managerId: true,

                status: true,

                createdAt: true,

                updatedAt: true,


                branch: {

                    select: {

                        branchId: true,

                        branchName: true,

                        location: true
                    }
                },


                department: {

                    select: {

                        departmentId: true,

                        departmentName: true
                    }
                }
            }
        });


    if (!employee) {

        return res.status(404).json({

            success: false,

            message:
                "Employee profile not found"
        });
    }


    return res.status(200).json({

        success: true,

        message:
            "Employee profile fetched successfully",

        data:
            employee
    });
};


// ==========================================
// Get My Attendance
// GET /api/me/attendance
// ==========================================

const getMyAttendance = async (
    req,
    res
) => {

    const {
        from,
        to
    } = req.query;


    const attendance =
        await attendanceService.getEmployeeAttendance(

            req.user.employeeId,

            {
                from,
                to
            }
        );


    return res.status(200).json({

        success: true,

        message:
            "My attendance fetched successfully",

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
// Get My Attendance Summary
// GET /api/me/attendance/summary
// ==========================================
//
// Default behavior for the employee dashboard:
// - Current calendar month only.
// - From the later of:
//     1. first day of the current month
//     2. employee hire date
// - Through today.
//
// The response also includes monthlyHours so the
// frontend can display:
//
//     completed / expected hours
//
// Example:
//     100 / 150 hours
//
// Explicit from/to query parameters are still
// respected for attendance pages and reports.
// ==========================================

const getMyAttendanceSummary = async (
    req,
    res
) => {

    let {
        from,
        to
    } = req.query;


    const employee =
        await prisma.employee.findFirst({

            where: {

                employeeId:
                    req.user.employeeId,

                companyId:
                    req.user.companyId
            },

            select: {

                employeeId: true,

                hireDate: true,

                monthlyExpectedHours: true
            }
        });


    if (!employee) {

        return res.status(404).json({

            success: false,

            message:
                "Employee profile not found"
        });
    }


    // ------------------------------------------
    // Default date range = current month to today
    // ------------------------------------------

    if (!from) {

        from =
            getCurrentMonthStart();


        const hireDate =
            getDateValueOrNull(
                employee.hireDate
            );


        if (hireDate) {

            const hireDateKey =
                getISTDateString(
                    hireDate
                );


            if (
                hireDateKey > from
            ) {
                from = hireDateKey;
            }
        }
    }


    if (!to) {

        to =
            getISTDateString();
    }


    const summary =
        await attendanceService.getEmployeeAttendanceSummary(

            req.user.employeeId,

            {
                from,
                to
            }
        );


    const completedHours =
        Number(
            Number(
                summary?.totalHours ?? 0
            ).toFixed(2)
        );


    const expectedHours =
        Number(
            Number(
                employee.monthlyExpectedHours ?? 0
            ).toFixed(2)
        );


    return res.status(200).json({

        success: true,

        message:
            "My attendance summary fetched successfully",

        filters: {

            from:
                from || null,

            to:
                to || null
        },

        data: {

            ...summary,

            monthlyHours: {

                completedHours,

                expectedHours,

                display:
                    `${completedHours} / ${expectedHours} hours`
            }
        }
    });
};


// ==========================================
// Get My Payroll
// GET /api/me/payroll
// ==========================================
//
// The payroll service is responsible for
// returning the employee's own payroll data,
// including overtime / extra-work information
// when supported by the service layer.
//
// This controller does not calculate or settle
// overtime. It only returns the employee's
// authenticated payroll information.
//
// ==========================================

const getMyPayroll = async (
    req,
    res
) => {

    const payrolls =
        await payrollService.getMyPayroll(

            req.user.employeeId,

            req.user.companyId
        );


    return res.status(200).json({

        success: true,

        message:
            "My payroll records fetched successfully",

        data:
            payrolls
    });
};


// ==========================================
// Get My Advances
// GET /api/me/advances
// ==========================================

const getMyAdvances = async (
    req,
    res
) => {

    const advances =
        await advanceService.getMyAdvances(

            req.user.employeeId,

            req.user.companyId
        );


    return res.status(200).json({

        success: true,

        message:
            "My advance payments fetched successfully",

        data:
            advances
    });
};


// ==========================================
// Request My Advance
// POST /api/me/advances
// ==========================================

const createMyAdvance = async (
    req,
    res
) => {

    const advance =
        await advanceService.createMyAdvance(

            req.body || {},

            req.user.employeeId,

            req.user.companyId
        );


    return res.status(201).json({

        success: true,

        message:
            "Advance payment requested successfully",

        data:
            advance
    });
};


// ==========================================
// Export Controllers
// ==========================================

module.exports = {

    getMyProfile,

    getMyAttendance,

    getMyAttendanceSummary,

    getMyPayroll,

    getMyAdvances,

    createMyAdvance
};