const prisma = require("../config/database");


// ==========================================
// Helper: Validate Date
// ==========================================

const parseDate = (value, fieldName) => {

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {

        const error =
            new Error(
                `${fieldName} must be a valid date`
            );

        error.statusCode = 400;

        throw error;
    }

    return date;
};


// ==========================================
// Helper: Round Money
// ==========================================

const roundMoney = (value) => {

    return Number(
        Number(value).toFixed(2)
    );
};


// ==========================================
// Create Payroll Automatically
//
// POST /api/payroll
//
// Required:
// employeeId
// payPeriodStart
// payPeriodEnd
// paymentDate (optional)
//
// Automatically calculates:
// totalWorkingHours
// basicSalary
// advanceDeduction
// netSalary
// ==========================================

const createPayroll = async (
    data,
    companyId
) => {

    const {
        employeeId,
        payPeriodStart,
        payPeriodEnd,
        paymentDate
    } = data;


    // ==========================================
    // Validate Employee ID
    // ==========================================

    const parsedEmployeeId =
        Number(employeeId);

    if (
        !Number.isInteger(parsedEmployeeId) ||
        parsedEmployeeId < 1
    ) {

        const error =
            new Error(
                "Invalid employee ID"
            );

        error.statusCode = 400;

        throw error;
    }


    // ==========================================
    // Validate Dates
    // ==========================================

    if (!payPeriodStart) {

        const error =
            new Error(
                "payPeriodStart is required"
            );

        error.statusCode = 400;

        throw error;
    }


    if (!payPeriodEnd) {

        const error =
            new Error(
                "payPeriodEnd is required"
            );

        error.statusCode = 400;

        throw error;
    }


    const startDate =
        parseDate(
            payPeriodStart,
            "payPeriodStart"
        );


    const endDate =
        parseDate(
            payPeriodEnd,
            "payPeriodEnd"
        );


    if (startDate > endDate) {

        const error =
            new Error(
                "payPeriodStart cannot be after payPeriodEnd"
            );

        error.statusCode = 400;

        throw error;
    }


    let parsedPaymentDate = null;

    if (paymentDate) {

        parsedPaymentDate =
            parseDate(
                paymentDate,
                "paymentDate"
            );
    }


    // ==========================================
    // Verify Employee
    // ==========================================

    const employee =
        await prisma.employee.findFirst({

            where: {

                employeeId:
                    parsedEmployeeId,

                companyId:
                    Number(companyId)
            },

            select: {

                employeeId: true,

                firstName: true,

                lastName: true,

                email: true,

                status: true,

                salaryRatePerHour: true
            }
        });


    if (!employee) {

        const error =
            new Error(
                "Employee not found"
            );

        error.statusCode = 404;

        throw error;
    }


    // ==========================================
    // Only Active Employees
    // ==========================================

    if (employee.status !== "ACTIVE") {

        const error =
            new Error(
                "Cannot create payroll for inactive employee"
            );

        error.statusCode = 400;

        throw error;
    }


    // ==========================================
    // Verify Salary Rate
    // ==========================================

    if (
        employee.salaryRatePerHour === null ||
        employee.salaryRatePerHour === undefined
    ) {

        const error =
            new Error(
                "Employee salary rate per hour is not configured"
            );

        error.statusCode = 400;

        throw error;
    }


    const salaryRatePerHour =
        Number(
            employee.salaryRatePerHour
        );


    if (
        Number.isNaN(salaryRatePerHour) ||
        salaryRatePerHour < 0
    ) {

        const error =
            new Error(
                "Employee salary rate per hour is invalid"
            );

        error.statusCode = 400;

        throw error;
    }


    // ==========================================
    // Prevent Duplicate Payroll
    // ==========================================

    const existingPayroll =
        await prisma.payroll.findFirst({

            where: {

                employeeId:
                    parsedEmployeeId,

                payPeriodStart:
                    startDate,

                payPeriodEnd:
                    endDate
            }
        });


    if (existingPayroll) {

        const error =
            new Error(
                "Payroll already exists for this employee and pay period"
            );

        error.statusCode = 409;

        throw error;
    }


    // ==========================================
    // Get Attendance
    //
    // Only attendance records inside the
    // requested payroll period are considered.
    // ==========================================

    const attendance =
        await prisma.attendance.findMany({

            where: {

                employeeId:
                    parsedEmployeeId,

                date: {

                    gte:
                        startDate,

                    lte:
                        endDate
                },

                status:
                    "PRESENT"
            },

            select: {

                attendanceId: true,

                date: true,

                totalHours: true,

                status: true
            },

            orderBy: {

                date:
                    "asc"
            }
        });


    // ==========================================
    // Calculate Total Working Hours
    // ==========================================

    const totalWorkingHours =
        attendance.reduce(

            (total, record) => {

                return (
                    total +
                    (
                        record.totalHours
                            ? Number(record.totalHours)
                            : 0
                    )
                );
            },

            0
        );


    const roundedWorkingHours =
        roundMoney(
            totalWorkingHours
        );


    // ==========================================
    // Calculate Basic Salary
    //
    // Basic Salary =
    // Total Working Hours × Hourly Rate
    // ==========================================

    const basicSalary =
        roundMoney(
            roundedWorkingHours *
            salaryRatePerHour
        );


    // ==========================================
    // Transaction
    //
    // Payroll creation and advance deduction
    // happen together.
    // ==========================================

    const payroll =
        await prisma.$transaction(

            async (tx) => {


                // ==================================
                // Find Oldest Approved Unused Advance
                // ==================================

                const advance =
                    await tx.advancePayment.findFirst({

                        where: {

                            employeeId:
                                parsedEmployeeId,

                            status:
                                "APPROVED",

                            deductedInPayrollId:
                                null
                        },

                        orderBy: {

                            paymentDate:
                                "asc"
                        }
                    });


                // ==================================
                // Determine Advance Deduction
                // ==================================

                let advanceDeduction = 0;


                if (advance) {

                    advanceDeduction =
                        roundMoney(
                            Number(
                                advance.amount
                            )
                        );
                }


                // ==================================
                // Calculate Net Salary
                // ==================================

                const netSalary =
                    roundMoney(
                        basicSalary -
                        advanceDeduction
                    );


                // ==================================
                // Create Payroll
                // ==================================

                const createdPayroll =
                    await tx.payroll.create({

                        data: {

                            employeeId:
                                parsedEmployeeId,

                            payPeriodStart:
                                startDate,

                            payPeriodEnd:
                                endDate,

                            totalWorkingHours:
                                roundedWorkingHours,

                            basicSalary:
                                basicSalary,

                            advanceDeduction:
                                advanceDeduction,

                            netSalary:
                                netSalary,

                            paymentDate:
                                parsedPaymentDate
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


                // ==================================
                // Mark Advance As Deducted
                // ==================================

                if (advance) {

                    const updatedAdvance =
                        await tx.advancePayment.updateMany({

                            where: {

                                advanceId:
                                    advance.advanceId,

                                status:
                                    "APPROVED",

                                deductedInPayrollId:
                                    null
                            },

                            data: {

                                deductedInPayrollId:
                                    createdPayroll.payrollId,

                                deductedAt:
                                    new Date()
                            }
                        });


                    // ==================================
                    // Safety Check
                    // ==================================

                    if (
                        updatedAdvance.count !== 1
                    ) {

                        const error =
                            new Error(
                                "Advance could not be marked as deducted"
                            );

                        error.statusCode = 409;

                        throw error;
                    }
                }


                // ==================================
                // Fetch Payroll With Advance
                // ==================================

                const finalPayroll =
                    await tx.payroll.findUnique({

                        where: {

                            payrollId:
                                createdPayroll.payrollId
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

                            advanceDeductionRecord:
                                true
                        }
                    });


                return finalPayroll;
            }
        );


    // ==========================================
    // Return Result
    // ==========================================

    return payroll;
};


// ==========================================
// Get All Payroll
// GET /api/payroll
// ==========================================

const getAllPayroll = async (
    companyId
) => {

    const payrolls =
        await prisma.payroll.findMany({

            where: {

                employee: {

                    companyId:
                        Number(companyId)
                }
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

                advanceDeductionRecord:
                    true
            },

            orderBy: {

                payPeriodEnd:
                    "desc"
            }
        });


    return payrolls;
};


// ==========================================
// Get Payroll By ID
// GET /api/payroll/:id
// ==========================================

const getPayrollById = async (
    payrollId,
    companyId
) => {

    const id =
        Number(payrollId);


    if (
        !Number.isInteger(id) ||
        id < 1
    ) {

        const error =
            new Error(
                "Invalid payroll ID"
            );

        error.statusCode = 400;

        throw error;
    }


    const payroll =
        await prisma.payroll.findFirst({

            where: {

                payrollId:
                    id,

                employee: {

                    companyId:
                        Number(companyId)
                }
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

                advanceDeductionRecord:
                    true
            }
        });


    if (!payroll) {

        const error =
            new Error(
                "Payroll record not found"
            );

        error.statusCode = 404;

        throw error;
    }


    return payroll;
};


// ==========================================
// Get Employee Payroll
// GET /api/payroll/employee/:employeeId
// ==========================================

const getEmployeePayroll = async (
    employeeId,
    companyId
) => {

    const id =
        Number(employeeId);


    if (
        !Number.isInteger(id) ||
        id < 1
    ) {

        const error =
            new Error(
                "Invalid employee ID"
            );

        error.statusCode = 400;

        throw error;
    }


    // ==========================================
    // Verify Employee Belongs To Company
    // ==========================================

    const employee =
        await prisma.employee.findFirst({

            where: {

                employeeId:
                    id,

                companyId:
                    Number(companyId)
            },

            select: {

                employeeId: true
            }
        });


    if (!employee) {

        const error =
            new Error(
                "Employee not found"
            );

        error.statusCode = 404;

        throw error;
    }


    const payrolls =
        await prisma.payroll.findMany({

            where: {

                employeeId:
                    id,

                employee: {

                    companyId:
                        Number(companyId)
                }
            },

            include: {

                advanceDeductionRecord:
                    true
            },

            orderBy: {

                payPeriodEnd:
                    "desc"
            }
        });


    return payrolls;
};


// ==========================================
// Update Payroll
// PUT /api/payroll/:id
// ==========================================
//
// Manual changes are allowed for corrections.
// Automatic calculation happens during creation.
// ==========================================

const updatePayroll = async (
    payrollId,
    data,
    companyId
) => {

    const id =
        Number(payrollId);


    if (
        !Number.isInteger(id) ||
        id < 1
    ) {

        const error =
            new Error(
                "Invalid payroll ID"
            );

        error.statusCode = 400;

        throw error;
    }


    // ==========================================
    // Verify Payroll
    // ==========================================

    const existingPayroll =
        await prisma.payroll.findFirst({

            where: {

                payrollId:
                    id,

                employee: {

                    companyId:
                        Number(companyId)
                }
            }
        });


    if (!existingPayroll) {

        const error =
            new Error(
                "Payroll record not found"
            );

        error.statusCode = 404;

        throw error;
    }


    const {
        payPeriodStart,
        payPeriodEnd,
        totalWorkingHours,
        basicSalary,
        advanceDeduction,
        netSalary,
        paymentDate
    } = data;


    // ==========================================
    // Build Update Data
    // ==========================================

    const updateData = {};


    if (
        payPeriodStart !== undefined
    ) {

        updateData.payPeriodStart =
            parseDate(
                payPeriodStart,
                "payPeriodStart"
            );
    }


    if (
        payPeriodEnd !== undefined
    ) {

        updateData.payPeriodEnd =
            parseDate(
                payPeriodEnd,
                "payPeriodEnd"
            );
    }


    if (
        totalWorkingHours !== undefined
    ) {

        const hours =
            Number(
                totalWorkingHours
            );


        if (
            Number.isNaN(hours) ||
            hours < 0
        ) {

            const error =
                new Error(
                    "totalWorkingHours must be a valid non-negative number"
                );

            error.statusCode = 400;

            throw error;
        }


        updateData.totalWorkingHours =
            roundMoney(hours);
    }


    if (
        basicSalary !== undefined
    ) {

        const salary =
            Number(
                basicSalary
            );


        if (
            Number.isNaN(salary) ||
            salary < 0
        ) {

            const error =
                new Error(
                    "basicSalary must be a valid non-negative number"
                );

            error.statusCode = 400;

            throw error;
        }


        updateData.basicSalary =
            roundMoney(salary);
    }


    if (
        advanceDeduction !== undefined
    ) {

        const deduction =
            Number(
                advanceDeduction
            );


        if (
            Number.isNaN(deduction) ||
            deduction < 0
        ) {

            const error =
                new Error(
                    "advanceDeduction must be a valid non-negative number"
                );

            error.statusCode = 400;

            throw error;
        }


        updateData.advanceDeduction =
            roundMoney(deduction);
    }


    if (
        netSalary !== undefined
    ) {

        const salary =
            Number(
                netSalary
            );


        if (
            Number.isNaN(salary)
        ) {

            const error =
                new Error(
                    "netSalary must be a valid number"
                );

            error.statusCode = 400;

            throw error;
        }


        updateData.netSalary =
            roundMoney(salary);
    }


    if (
        paymentDate !== undefined
    ) {

        updateData.paymentDate =
            paymentDate
                ? parseDate(
                    paymentDate,
                    "paymentDate"
                )
                : null;
    }


    // ==========================================
    // Update Payroll
    // ==========================================

    const payroll =
        await prisma.payroll.update({

            where: {

                payrollId:
                    id
            },

            data:
                updateData,

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

                advanceDeductionRecord:
                    true
            }
        });


    return payroll;
};


// ==========================================
// Delete Payroll
// DELETE /api/payroll/:id
// ==========================================

const deletePayroll = async (
    payrollId,
    companyId
) => {

    const id =
        Number(payrollId);


    if (
        !Number.isInteger(id) ||
        id < 1
    ) {

        const error =
            new Error(
                "Invalid payroll ID"
            );

        error.statusCode = 400;

        throw error;
    }


    // ==========================================
    // Verify Payroll
    // ==========================================

    const existingPayroll =
        await prisma.payroll.findFirst({

            where: {

                payrollId:
                    id,

                employee: {

                    companyId:
                        Number(companyId)
                }
            }
        });


    if (!existingPayroll) {

        const error =
            new Error(
                "Payroll record not found"
            );

        error.statusCode = 404;

        throw error;
    }


    // ==========================================
    // Delete Payroll + Release Advance
    // ==========================================

    await prisma.$transaction(

        async (tx) => {

            // Release advance deduction first

            await tx.advancePayment.updateMany({

                where: {

                    deductedInPayrollId:
                        id
                },

                data: {

                    deductedInPayrollId:
                        null,

                    deductedAt:
                        null
                }
            });


            // Delete payroll

            await tx.payroll.delete({

                where: {

                    payrollId:
                        id
                }
            });
        }
    );
};


// ==========================================
// Get My Payroll
// GET /api/me/payroll
// ==========================================

const getMyPayroll = async (
    employeeId,
    companyId
) => {

    const id =
        Number(employeeId);


    if (
        !Number.isInteger(id) ||
        id < 1
    ) {

        const error =
            new Error(
                "Invalid employee ID"
            );

        error.statusCode = 400;

        throw error;
    }


    const payrolls =
        await prisma.payroll.findMany({

            where: {

                employeeId:
                    id,

                employee: {

                    companyId:
                        Number(companyId)
                }
            },

            include: {

                advanceDeductionRecord:
                    true
            },

            orderBy: {

                payPeriodEnd:
                    "desc"
            }
        });


    return payrolls;
};


// ==========================================
// EXPORT
// ==========================================

module.exports = {

    createPayroll,

    getAllPayroll,

    getPayrollById,

    getEmployeePayroll,

    updatePayroll,

    deletePayroll,

    getMyPayroll
};