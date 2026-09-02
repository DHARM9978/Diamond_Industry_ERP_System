const reportService =
    require("../services/report.service");


// ======================================================
// DASHBOARD
// GET /api/reports/dashboard
// ======================================================

const getDashboardSummary = async (req, res) => {

    const summary =
        await reportService.getDashboardSummary(
            req.user.companyId
        );

    return res.status(200).json({

        success: true,

        message:
            "Dashboard summary fetched successfully",

        data:
            summary
    });
};


// ======================================================
// ATTENDANCE REPORT
// GET /api/reports/attendance
// ======================================================

const getAttendanceReport = async (req, res) => {

    const report =
        await reportService.getAttendanceReport(

            req.user.companyId,

            {
                from:
                    req.query.from,

                to:
                    req.query.to,

                employeeId:
                    req.query.employeeId,

                status:
                    req.query.status,

                branchId:
                    req.query.branchId,

                departmentId:
                    req.query.departmentId
            }
        );


    return res.status(200).json({

        success: true,

        message:
            "Attendance report fetched successfully",

        filters: {

            from:
                req.query.from || null,

            to:
                req.query.to || null,

            employeeId:
                req.query.employeeId
                    ? Number(req.query.employeeId)
                    : null,

            status:
                req.query.status || null,

            branchId:
                req.query.branchId
                    ? Number(req.query.branchId)
                    : null,

            departmentId:
                req.query.departmentId
                    ? Number(req.query.departmentId)
                    : null
        },

        data:
            report
    });
};


// ======================================================
// EMPLOYEE REPORT
// GET /api/reports/employees
// ======================================================

const getEmployeeReport = async (req, res) => {

    const report =
        await reportService.getEmployeeReport(

            req.user.companyId,

            {
                branchId:
                    req.query.branchId,

                departmentId:
                    req.query.departmentId,

                status:
                    req.query.status
            }
        );


    return res.status(200).json({

        success: true,

        message:
            "Employee report fetched successfully",

        filters: {

            branchId:
                req.query.branchId
                    ? Number(req.query.branchId)
                    : null,

            departmentId:
                req.query.departmentId
                    ? Number(req.query.departmentId)
                    : null,

            status:
                req.query.status || null
        },

        data:
            report
    });
};


// ======================================================
// PAYROLL REPORT
// GET /api/reports/payroll
// ======================================================

const getPayrollReport = async (req, res) => {

    const report =
        await reportService.getPayrollReport(

            req.user.companyId,

            {
                from:
                    req.query.from,

                to:
                    req.query.to,

                employeeId:
                    req.query.employeeId
            }
        );


    return res.status(200).json({

        success: true,

        message:
            "Payroll report fetched successfully",

        filters: {

            from:
                req.query.from || null,

            to:
                req.query.to || null,

            employeeId:
                req.query.employeeId
                    ? Number(req.query.employeeId)
                    : null
        },

        data:
            report
    });
};


// ======================================================
// ADVANCE REPORT
// GET /api/reports/advances
// ======================================================

const getAdvanceReport = async (req, res) => {

    const report =
        await reportService.getAdvanceReport(

            req.user.companyId,

            {
                from:
                    req.query.from,

                to:
                    req.query.to,

                employeeId:
                    req.query.employeeId,

                status:
                    req.query.status
            }
        );


    return res.status(200).json({

        success: true,

        message:
            "Advance report fetched successfully",

        filters: {

            from:
                req.query.from || null,

            to:
                req.query.to || null,

            employeeId:
                req.query.employeeId
                    ? Number(req.query.employeeId)
                    : null,

            status:
                req.query.status || null
        },

        data:
            report
    });
};


// ======================================================
// LEAVE REPORT
// GET /api/reports/leaves
// ======================================================

const getLeaveReport = async (req, res) => {

    const report =
        await reportService.getLeaveReport(

            req.user.companyId,

            {
                from:
                    req.query.from,

                to:
                    req.query.to,

                employeeId:
                    req.query.employeeId,

                status:
                    req.query.status,

                leaveTypeId:
                    req.query.leaveTypeId
            }
        );


    return res.status(200).json({

        success: true,

        message:
            "Leave report fetched successfully",

        filters: {

            from:
                req.query.from || null,

            to:
                req.query.to || null,

            employeeId:
                req.query.employeeId
                    ? Number(req.query.employeeId)
                    : null,

            status:
                req.query.status || null,

            leaveTypeId:
                req.query.leaveTypeId
                    ? Number(req.query.leaveTypeId)
                    : null
        },

        data:
            report
    });
};


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    getDashboardSummary,
    getAttendanceReport,
    getEmployeeReport,
    getPayrollReport,
    getAdvanceReport,
    getLeaveReport
};