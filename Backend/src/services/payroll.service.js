const prisma =
    require("../config/database");


// ==========================================
// Helper: Validate Date
// ==========================================

const parseDate = (
    value,
    fieldName
) => {

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
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

const roundMoney = (
    value
) => {

    return Number(
        Number(value).toFixed(2)
    );
};


// ==========================================
// Helper: Positive Number
// ==========================================

const validatePositiveNumber = (
    value,
    fieldName
) => {

    const numberValue =
        Number(value);

    if (
        value === undefined ||
        value === null ||
        value === "" ||
        !Number.isFinite(numberValue) ||
        numberValue <= 0
    ) {

        const error =
            new Error(
                `${fieldName} must be greater than 0`
            );

        error.statusCode = 400;

        throw error;
    }

    return numberValue;
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
//
// Salary calculation:
//
// baseSalary / monthlyExpectedHours
// = salaryRatePerHour
//
// totalWorkingHours × salaryRatePerHour
// = basicSalary
//
// basicSalary - paid advance
// = netSalary
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
    } = data || {};


    // ==========================================
    // Validate Employee ID
    // ==========================================

    const parsedEmployeeId =
        Number(employeeId);

    if (
        !Number.isInteger(
            parsedEmployeeId
        ) ||
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


    if (
        startDate > endDate
    ) {

        const error =
            new Error(
                "payPeriodStart cannot be after payPeriodEnd"
            );

        error.statusCode = 400;

        throw error;
    }


    // ==========================================
    // Payment Date
    // ==========================================

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

                baseSalary: true,

                monthlyExpectedHours: true,

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

    if (
        employee.status !==
        "ACTIVE"
    ) {

        const error =
            new Error(
                "Cannot create payroll for inactive employee"
            );

        error.statusCode = 400;

        throw error;
    }


    // ==========================================
    // Validate Salary Configuration
    //
    // Salary is based on:
    //
    // baseSalary / monthlyExpectedHours
    // ==========================================

    if (
        employee.baseSalary === null ||
        employee.baseSalary === undefined
    ) {

        const error =
            new Error(
                "Employee base salary is not configured"
            );

        error.statusCode = 400;

        throw error;
    }


    if (
        employee.monthlyExpectedHours === null ||
        employee.monthlyExpectedHours === undefined
    ) {

        const error =
            new Error(
                "Employee monthly expected hours are not configured"
            );

        error.statusCode = 400;

        throw error;
    }


    const baseSalary =
        validatePositiveNumber(
            employee.baseSalary,
            "Employee base salary"
        );


    const monthlyExpectedHours =
        validatePositiveNumber(
            employee.monthlyExpectedHours,
            "Employee monthly expected hours"
        );


    // ==========================================
    // Calculate Hourly Rate
    // ==========================================

    const calculatedSalaryRatePerHour =
        roundMoney(
            baseSalary /
            monthlyExpectedHours
        );


    if (
        !Number.isFinite(
            calculatedSalaryRatePerHour
        ) ||
        calculatedSalaryRatePerHour <= 0
    ) {

        const error =
            new Error(
                "Calculated employee hourly salary is invalid"
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
    // Only PRESENT records inside the
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
            (
                total,
                record
            ) => {

                return (
                    total +
                    (
                        record.totalHours
                            ? Number(
                                record.totalHours
                            )
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
    // Calculate Basic / Earned Salary
    //
    // Actual Working Hours × Hourly Rate
    // ==========================================

    const basicSalary =
        roundMoney(
            roundedWorkingHours *
            calculatedSalaryRatePerHour
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
                // Find Oldest PAID Unused Advance
                //
                // Payroll deduction uses the actual
                // amount paid to the employee.
                // ==================================

                const advance =
                    await tx.advancePayment.findFirst({

                        where: {

                            employeeId:
                                parsedEmployeeId,

                            status:
                                "PAID",

                            paidAmount: {

                                not:
                                    null
                            },

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

                    const paidAmount =
                        Number(
                            advance.paidAmount
                        );


                    if (
                        !Number.isFinite(
                            paidAmount
                        ) ||
                        paidAmount <= 0
                    ) {

                        const error =
                            new Error(
                                "Paid advance amount is invalid"
                            );

                        error.statusCode = 400;

                        throw error;
                    }


                    advanceDeduction =
                        roundMoney(
                            paidAmount
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


                            // Historical salary snapshot

                            baseSalary:
                                baseSalary,

                            monthlyExpectedHours:
                                monthlyExpectedHours,

                            salaryRatePerHour:
                                calculatedSalaryRatePerHour,


                            // Attendance calculation

                            totalWorkingHours:
                                roundedWorkingHours,


                            // Earned salary

                            basicSalary:
                                basicSalary,


                            // Advance deduction

                            advanceDeduction:
                                advanceDeduction,


                            // Final salary

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
                                    "PAID",

                                paidAmount: {

                                    not:
                                        null
                                },

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
                        updatedAdvance.count !==
                        1
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
//
// Manual correction is still supported.
//
// Automatic calculation happens during
// payroll creation.
//
// Salary snapshot values are also supported.
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
        baseSalary,
        monthlyExpectedHours,
        salaryRatePerHour,
        totalWorkingHours,
        basicSalary,
        advanceDeduction,
        netSalary,
        paymentDate
    } = data || {};


    // ==========================================
    // Build Update Data
    // ==========================================

    const updateData = {};


    // ==========================================
    // Pay Period Start
    // ==========================================

    if (
        payPeriodStart !==
        undefined
    ) {

        updateData.payPeriodStart =
            parseDate(
                payPeriodStart,
                "payPeriodStart"
            );
    }


    // ==========================================
    // Pay Period End
    // ==========================================

    if (
        payPeriodEnd !==
        undefined
    ) {

        updateData.payPeriodEnd =
            parseDate(
                payPeriodEnd,
                "payPeriodEnd"
            );
    }


    // ==========================================
    // Salary Snapshot: Base Salary
    // ==========================================

    if (
        baseSalary !==
        undefined
    ) {

        const salary =
            validatePositiveNumber(
                baseSalary,
                "baseSalary"
            );

        updateData.baseSalary =
            roundMoney(
                salary
            );
    }


    // ==========================================
    // Salary Snapshot:
    // Monthly Expected Hours
    // ==========================================

    if (
        monthlyExpectedHours !==
        undefined
    ) {

        const expectedHours =
            validatePositiveNumber(
                monthlyExpectedHours,
                "monthlyExpectedHours"
            );

        updateData.monthlyExpectedHours =
            roundMoney(
                expectedHours
            );
    }


    // ==========================================
    // Salary Snapshot:
    // Hourly Rate
    // ==========================================

    if (
        salaryRatePerHour !==
        undefined
    ) {

        const hourlyRate =
            validatePositiveNumber(
                salaryRatePerHour,
                "salaryRatePerHour"
            );

        updateData.salaryRatePerHour =
            roundMoney(
                hourlyRate
            );
    }


    // ==========================================
    // Total Working Hours
    // ==========================================

    if (
        totalWorkingHours !==
        undefined
    ) {

        const hours =
            Number(
                totalWorkingHours
            );


        if (
            !Number.isFinite(hours) ||
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
            roundMoney(
                hours
            );
    }


    // ==========================================
    // Basic Salary
    // ==========================================

    if (
        basicSalary !==
        undefined
    ) {

        const salary =
            Number(
                basicSalary
            );


        if (
            !Number.isFinite(salary) ||
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
            roundMoney(
                salary
            );
    }


    // ==========================================
    // Advance Deduction
    // ==========================================

    if (
        advanceDeduction !==
        undefined
    ) {

        const deduction =
            Number(
                advanceDeduction
            );


        if (
            !Number.isFinite(deduction) ||
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
            roundMoney(
                deduction
            );
    }


    // ==========================================
    // Net Salary
    // ==========================================

    if (
        netSalary !==
        undefined
    ) {

        const salary =
            Number(
                netSalary
            );


        if (
            !Number.isFinite(salary)
        ) {

            const error =
                new Error(
                    "netSalary must be a valid number"
                );

            error.statusCode = 400;

            throw error;
        }


        updateData.netSalary =
            roundMoney(
                salary
            );
    }


    // ==========================================
    // Payment Date
    // ==========================================

    if (
        paymentDate !==
        undefined
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
    // Validate Final Pay Period
    // ==========================================

    const finalStartDate =
        updateData.payPeriodStart ||
        existingPayroll.payPeriodStart;


    const finalEndDate =
        updateData.payPeriodEnd ||
        existingPayroll.payPeriodEnd;


    if (
        finalStartDate >
        finalEndDate
    ) {

        const error =
            new Error(
                "payPeriodStart cannot be after payPeriodEnd"
            );

        error.statusCode = 400;

        throw error;
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

            // ----------------------------------
            // Release linked advance first
            // ----------------------------------

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


            // ----------------------------------
            // Delete payroll
            // ----------------------------------

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