const prisma = require("../config/database");
const attendanceService = require("../services/attendance.service");
const payrollService = require("../services/payroll.service");
const advanceService = require("../services/advance.service");


// ==========================================
// Get My Profile
// GET /api/me/profile
// ==========================================

const getMyProfile = async (req, res) => {

    const employee =
        await prisma.employee.findFirst({

            where: {
                employeeId: req.user.employeeId,
                companyId: req.user.companyId
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

        data: employee
    });
};


// ==========================================
// Get My Attendance
// GET /api/me/attendance
// ==========================================

const getMyAttendance = async (req, res) => {

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

const getMyAttendanceSummary = async (req, res) => {

    const {
        from,
        to
    } = req.query;

    const summary =
        await attendanceService.getEmployeeAttendanceSummary(

            req.user.employeeId,

            {
                from,
                to
            }
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

        data:
            summary
    });
};


// ==========================================
// Get My Payroll
// GET /api/me/payroll
// ==========================================

const getMyPayroll = async (req, res) => {

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

const getMyAdvances = async (req, res) => {

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

const createMyAdvance = async (req, res) => {

    const advance =
        await advanceService.createMyAdvance(

            req.body,

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