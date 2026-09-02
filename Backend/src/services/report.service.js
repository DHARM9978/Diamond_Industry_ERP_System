const prisma = require("../config/database");

// ======================================================
// HELPERS
// ======================================================

const parseDate = (value, fieldName) => {
    if (!value) {
        return null;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
        const error = new Error(
            `${fieldName} must be a valid date in YYYY-MM-DD format`
        );

        error.statusCode = 400;
        throw error;
    }

    return date;
};

const getDateRange = (from, to) => {
    const startDate = from ? parseDate(from, "from") : null;

    let endDate = to ? parseDate(to, "to") : null;

    if (endDate) {
        endDate = new Date(
            endDate.getTime() +
            24 * 60 * 60 * 1000 -
            1
        );
    }

    if (startDate && endDate && startDate > endDate) {
        const error = new Error(
            "from cannot be after to"
        );

        error.statusCode = 400;
        throw error;
    }

    return {
        startDate,
        endDate
    };
};

const toNumber = (value) => {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    return Number(value);
};

const safeBigInt = (value) => {
    if (typeof value === "bigint") {
        return value.toString();
    }

    return value;
};

const sanitizePunches = (records) => {
    return records.map((record) => ({
        ...record,
        punchId: safeBigInt(record.punchId)
    }));
};


// ======================================================
// DASHBOARD SUMMARY
// GET /api/reports/dashboard
// ======================================================

const getDashboardSummary = async (companyId) => {

    const numericCompanyId = Number(companyId);

    const today = new Date();

    const todayDateString =
        today.toISOString().slice(0, 10);

    const todayStart =
        new Date(`${todayDateString}T00:00:00.000Z`);

    const todayEnd =
        new Date(
            `${todayDateString}T23:59:59.999Z`
        );


    // --------------------------------------------------
    // EMPLOYEES
    // --------------------------------------------------

    const totalEmployees =
        await prisma.employee.count({
            where: {
                companyId: numericCompanyId
            }
        });

    const activeEmployees =
        await prisma.employee.count({
            where: {
                companyId: numericCompanyId,
                status: "ACTIVE"
            }
        });

    const inactiveEmployees =
        await prisma.employee.count({
            where: {
                companyId: numericCompanyId,
                status: {
                    not: "ACTIVE"
                }
            }
        });


    // --------------------------------------------------
    // TODAY'S ATTENDANCE
    // --------------------------------------------------

    const todayAttendance =
        await prisma.attendance.findMany({

            where: {
                employee: {
                    companyId: numericCompanyId
                },

                date: todayStart
            },

            select: {
                attendanceId: true,
                employeeId: true,
                checkInTime: true,
                checkOutTime: true,
                totalHours: true,
                status: true
            }
        });


    const presentToday =
        todayAttendance.filter(
            (record) =>
                record.checkInTime !== null
        ).length;


    const checkedOutToday =
        todayAttendance.filter(
            (record) =>
                record.checkOutTime !== null
        ).length;


    const incompleteToday =
        todayAttendance.filter(
            (record) =>
                record.checkInTime !== null &&
                record.checkOutTime === null
        ).length;


    // --------------------------------------------------
    // TODAY'S LEAVE
    // --------------------------------------------------

    let onLeaveToday = 0;

    if (prisma.leaveRequest) {

        onLeaveToday =
            await prisma.leaveRequest.count({

                where: {

                    employee: {
                        companyId:
                            numericCompanyId
                    },

                    status: "APPROVED",

                    startDate: {
                        lte: todayStart
                    },

                    endDate: {
                        gte: todayStart
                    }
                }
            });
    }


    // --------------------------------------------------
    // PENDING LEAVE REQUESTS
    // --------------------------------------------------

    let pendingLeaveRequests = 0;

    if (prisma.leaveRequest) {

        pendingLeaveRequests =
            await prisma.leaveRequest.count({

                where: {

                    employee: {
                        companyId:
                            numericCompanyId
                    },

                    status: "PENDING"
                }
            });
    }


    // --------------------------------------------------
    // PENDING ADVANCES
    // --------------------------------------------------

    const pendingAdvanceRequests =
        await prisma.advancePayment.count({

            where: {

                employee: {
                    companyId:
                        numericCompanyId
                },

                status: "PENDING"
            }
        });


    // --------------------------------------------------
    // PAYROLL
    // --------------------------------------------------

    const payrollRecords =
        await prisma.payroll.findMany({

            where: {

                employee: {
                    companyId:
                        numericCompanyId
                }
            },

            select: {
                basicSalary: true,
                advanceDeduction: true,
                netSalary: true
            }
        });


    let totalBasicSalary = 0;
    let totalAdvanceDeduction = 0;
    let totalNetSalary = 0;


    for (const payroll of payrollRecords) {

        totalBasicSalary +=
            Number(payroll.basicSalary);

        totalAdvanceDeduction +=
            Number(payroll.advanceDeduction);

        totalNetSalary +=
            Number(payroll.netSalary);
    }


    return {

        employees: {

            total: totalEmployees,

            active:
                activeEmployees,

            inactive:
                inactiveEmployees
        },

        attendance: {

            today: {

                totalRecords:
                    todayAttendance.length,

                present:
                    presentToday,

                checkedOut:
                    checkedOutToday,

                currentlyWorking:
                    incompleteToday,

                onLeave:
                    onLeaveToday
            }
        },

        leave: {

            pendingRequests:
                pendingLeaveRequests
        },

        advances: {

            pendingRequests:
                pendingAdvanceRequests
        },

        payroll: {

            totalBasicSalary:
                Number(
                    totalBasicSalary.toFixed(2)
                ),

            totalAdvanceDeduction:
                Number(
                    totalAdvanceDeduction.toFixed(2)
                ),

            totalNetSalary:
                Number(
                    totalNetSalary.toFixed(2)
                )
        }
    };
};


// ======================================================
// ATTENDANCE REPORT
// GET /api/reports/attendance
// ======================================================

const getAttendanceReport = async (
    companyId,
    filters = {}
) => {

    const {
        from,
        to,
        employeeId,
        status,
        branchId,
        departmentId
    } = filters;


    const {
        startDate,
        endDate
    } =
        getDateRange(from, to);


    const where = {

        employee: {

            companyId:
                Number(companyId)
        }
    };


    if (startDate || endDate) {

        where.date = {};

        if (startDate) {
            where.date.gte = startDate;
        }

        if (endDate) {
            where.date.lte = endDate;
        }
    }


    if (employeeId) {

        where.employeeId =
            Number(employeeId);
    }


    if (status) {

        where.status =
            String(status).toUpperCase();
    }


    if (branchId) {

        where.employee.branchId =
            Number(branchId);
    }


    if (departmentId) {

        where.employee.departmentId =
            Number(departmentId);
    }


    const records =
        await prisma.attendance.findMany({

            where,

            orderBy: [
                {
                    date: "desc"
                },
                {
                    employeeId: "asc"
                }
            ],

            include: {

                employee: {

                    select: {

                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        status: true,

                        branch: {

                            select: {
                                branchId: true,
                                branchName: true
                            }
                        },

                        department: {

                            select: {
                                departmentId: true,
                                departmentName: true
                            }
                        }
                    }
                }
            }
        });


    let totalHours = 0;

    for (const record of records) {

        totalHours +=
            Number(record.totalHours || 0);
    }


    const statusSummary = {};

    for (const record of records) {

        const currentStatus =
            record.status || "UNKNOWN";

        if (!statusSummary[currentStatus]) {
            statusSummary[currentStatus] = 0;
        }

        statusSummary[currentStatus]++;
    }


    return {

        summary: {

            totalRecords:
                records.length,

            totalWorkingHours:
                Number(
                    totalHours.toFixed(2)
                ),

            status:
                statusSummary
        },

        records
    };
};


// ======================================================
// EMPLOYEE REPORT
// GET /api/reports/employees
// ======================================================

const getEmployeeReport = async (
    companyId,
    filters = {}
) => {

    const {
        branchId,
        departmentId,
        status
    } = filters;


    const where = {

        companyId:
            Number(companyId)
    };


    if (branchId) {

        where.branchId =
            Number(branchId);
    }


    if (departmentId) {

        where.departmentId =
            Number(departmentId);
    }


    if (status) {

        where.status =
            String(status).toUpperCase();
    }


    const employees =
        await prisma.employee.findMany({

            where,

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
                status: true,

                branch: {

                    select: {

                        branchId: true,
                        branchName: true
                    }
                },

                department: {

                    select: {

                        departmentId: true,
                        departmentName: true
                    }
                }
            },

            orderBy: {
                employeeId: "asc"
            }
        });


    const statusSummary = {};

    for (const employee of employees) {

        const employeeStatus =
            employee.status || "UNKNOWN";

        if (!statusSummary[employeeStatus]) {
            statusSummary[employeeStatus] = 0;
        }

        statusSummary[employeeStatus]++;
    }


    return {

        summary: {

            totalEmployees:
                employees.length,

            status:
                statusSummary
        },

        employees
    };
};


// ======================================================
// PAYROLL REPORT
// GET /api/reports/payroll
// ======================================================

const getPayrollReport = async (
    companyId,
    filters = {}
) => {

    const {
        from,
        to,
        employeeId
    } = filters;


    const {
        startDate,
        endDate
    } =
        getDateRange(from, to);


    const where = {

        employee: {

            companyId:
                Number(companyId)
        }
    };


    if (employeeId) {

        where.employeeId =
            Number(employeeId);
    }


    if (startDate || endDate) {

        where.payPeriodStart = {};

        if (startDate) {
            where.payPeriodStart.gte =
                startDate;
        }

        if (endDate) {
            where.payPeriodStart.lte =
                endDate;
        }
    }


    const payrolls =
        await prisma.payroll.findMany({

            where,

            orderBy: {
                payPeriodStart: "desc"
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
                },

                advanceDeductionRecord: {

                    select: {

                        advanceId: true,
                        amount: true,
                        status: true,
                        deductedAt: true
                    }
                }
            }
        });


    let totalWorkingHours = 0;
    let totalBasicSalary = 0;
    let totalAdvanceDeduction = 0;
    let totalNetSalary = 0;


    for (const payroll of payrolls) {

        totalWorkingHours +=
            Number(
                payroll.totalWorkingHours || 0
            );

        totalBasicSalary +=
            Number(
                payroll.basicSalary || 0
            );

        totalAdvanceDeduction +=
            Number(
                payroll.advanceDeduction || 0
            );

        totalNetSalary +=
            Number(
                payroll.netSalary || 0
            );
    }


    return {

        summary: {

            totalRecords:
                payrolls.length,

            totalWorkingHours:
                Number(
                    totalWorkingHours.toFixed(2)
                ),

            totalBasicSalary:
                Number(
                    totalBasicSalary.toFixed(2)
                ),

            totalAdvanceDeduction:
                Number(
                    totalAdvanceDeduction.toFixed(2)
                ),

            totalNetSalary:
                Number(
                    totalNetSalary.toFixed(2)
                )
        },

        payrolls
    };
};


// ======================================================
// ADVANCE REPORT
// GET /api/reports/advances
// ======================================================

const getAdvanceReport = async (
    companyId,
    filters = {}
) => {

    const {
        from,
        to,
        employeeId,
        status
    } = filters;


    const {
        startDate,
        endDate
    } =
        getDateRange(from, to);


    const where = {

        employee: {

            companyId:
                Number(companyId)
        }
    };


    if (employeeId) {

        where.employeeId =
            Number(employeeId);
    }


    if (status) {

        where.status =
            String(status).toUpperCase();
    }


    if (startDate || endDate) {

        where.paymentDate = {};

        if (startDate) {
            where.paymentDate.gte = startDate;
        }

        if (endDate) {
            where.paymentDate.lte = endDate;
        }
    }


    const advances =
        await prisma.advancePayment.findMany({

            where,

            orderBy: {
                paymentDate: "desc"
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
                },

                approver: {

                    select: {

                        adminId: true,
                        adminName: true,
                        email: true
                    }
                },

                deductedInPayroll: {

                    select: {

                        payrollId: true,
                        payPeriodStart: true,
                        payPeriodEnd: true
                    }
                }
            }
        });


    let totalAmount = 0;
    let approvedAmount = 0;
    let pendingAmount = 0;
    let rejectedAmount = 0;


    for (const advance of advances) {

        const amount =
            Number(advance.amount || 0);

        totalAmount += amount;


        if (advance.status === "APPROVED") {
            approvedAmount += amount;
        }

        if (advance.status === "PENDING") {
            pendingAmount += amount;
        }

        if (advance.status === "REJECTED") {
            rejectedAmount += amount;
        }
    }


    return {

        summary: {

            totalRecords:
                advances.length,

            totalAmount:
                Number(
                    totalAmount.toFixed(2)
                ),

            approvedAmount:
                Number(
                    approvedAmount.toFixed(2)
                ),

            pendingAmount:
                Number(
                    pendingAmount.toFixed(2)
                ),

            rejectedAmount:
                Number(
                    rejectedAmount.toFixed(2)
                )
        },

        advances
    };
};


// ======================================================
// LEAVE REPORT
// GET /api/reports/leaves
// ======================================================

const getLeaveReport = async (
    companyId,
    filters = {}
) => {

    if (!prisma.leaveRequest) {

        const error =
            new Error(
                "Leave Management models are not available in the current Prisma client"
            );

        error.statusCode = 500;

        throw error;
    }


    const {
        from,
        to,
        employeeId,
        status,
        leaveTypeId
    } = filters;


    const {
        startDate,
        endDate
    } =
        getDateRange(from, to);


    const where = {

        employee: {

            companyId:
                Number(companyId)
        }
    };


    if (employeeId) {

        where.employeeId =
            Number(employeeId);
    }


    if (leaveTypeId) {

        where.leaveTypeId =
            Number(leaveTypeId);
    }


    if (status) {

        where.status =
            String(status).toUpperCase();
    }


    if (startDate || endDate) {

        where.startDate = {};

        if (startDate) {
            where.startDate.gte =
                startDate;
        }

        if (endDate) {
            where.startDate.lte =
                endDate;
        }
    }


    const requests =
        await prisma.leaveRequest.findMany({

            where,

            orderBy: {
                startDate: "desc"
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
                },

                leaveType: {

                    select: {

                        leaveTypeId: true,
                        name: true,
                        code: true,
                        isPaid: true
                    }
                }
            }
        });


    let totalDays = 0;

    const statusSummary = {};

    for (const request of requests) {

        totalDays +=
            Number(request.totalDays || 0);

        const requestStatus =
            request.status || "UNKNOWN";

        if (!statusSummary[requestStatus]) {
            statusSummary[requestStatus] = 0;
        }

        statusSummary[requestStatus]++;
    }


    return {

        summary: {

            totalRequests:
                requests.length,

            totalDays:
                Number(
                    totalDays.toFixed(2)
                ),

            status:
                statusSummary
        },

        requests
    };
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