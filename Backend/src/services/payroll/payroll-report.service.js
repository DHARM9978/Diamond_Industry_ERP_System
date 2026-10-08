const prisma = require("../../config/database");


// ============================================================
// PAYROLL REPORT SERVICE
// ============================================================
//
// Responsibility:
//   - Payroll history
//   - Paid payroll history
//   - Pending payroll history
//   - Month/year payroll reports
//   - Payroll financial summaries
//   - Advance deduction totals used by reports
//
// Reporting rules:
//
//   1. Payroll month/year filtering is based on payPeriodStart.
//      It is the payroll period month, NOT the payment month.
//
//   2. totalPayroll = gross/base salary snapshot for the selected
//      payroll period.
//
//   3. totalNetPayroll = actual net payable amount after shortage
//      deductions and advance deductions.
//
//   4. totalAdvanceTaken = sum of advanceDeduction.
//
//   5. totalPaid = net amount of PAID payroll records.
//
//   6. totalPending = net amount of UNPAID payroll records.
//
//   7. If historical data contains both PAID and UNPAID payroll
//      rows for the same employee and same payroll period, the
//      PAID row is treated as authoritative for reporting.
//      No database rows are deleted or modified.
//
// This service is READ-ONLY.
// It does not create, update, pay, settle, or delete payroll.
// ============================================================


// ============================================================
// HELPER: Service Error
// ============================================================

const createServiceError = (
    message,
    statusCode = 400
) => {

    const error =
        new Error(message);

    error.statusCode =
        statusCode;

    return error;
};


// ============================================================
// HELPER: Decimal To Number
// ============================================================

const decimalToNumber = (
    value
) => {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return 0;
    }

    const numericValue =
        Number(value);

    return Number.isFinite(
        numericValue
    )
        ? numericValue
        : 0;
};


// ============================================================
// HELPER: Round Money
// ============================================================

const roundMoney = (
    value
) => {

    return Number(
        decimalToNumber(
            value
        ).toFixed(2)
    );
};


// ============================================================
// HELPER: Positive Integer
// ============================================================

const parsePositiveInteger = (
    value,
    fieldName
) => {

    const parsedValue =
        Number(value);

    if (
        !Number.isInteger(
            parsedValue
        ) ||
        parsedValue <= 0
    ) {

        throw createServiceError(
            `${fieldName} must be a valid positive integer`,
            400
        );
    }

    return parsedValue;
};


// ============================================================
// HELPER: Month
// ============================================================
//
// Accepts either:
//   1-12
// or:
//   0-11
//
// Internally this service uses calendar month numbers 1-12.
// ============================================================

const parseMonth = (
    value
) => {

    const month =
        Number(value);

    if (
        !Number.isInteger(
            month
        )
    ) {

        throw createServiceError(
            "month must be a valid integer",
            400
        );
    }

    if (
        month >= 1 &&
        month <= 12
    ) {

        return month;
    }

    // Backward compatibility with JavaScript month indexing.
    if (
        month >= 0 &&
        month <= 11
    ) {

        return month + 1;
    }

    throw createServiceError(
        "month must be between 1 and 12",
        400
    );
};


// ============================================================
// HELPER: Year
// ============================================================

const parseYear = (
    value
) => {

    const year =
        Number(value);

    if (
        !Number.isInteger(
            year
        ) ||
        year < 2000 ||
        year > 2200
    ) {

        throw createServiceError(
            "year must be a valid four-digit year",
            400
        );
    }

    return year;
};


// ============================================================
// HELPER: Start Of Calendar Month
// ============================================================
//
// Use UTC midnight for database @db.Date comparisons so that the
// calendar day does not shift due to server timezone.
// ============================================================

const getMonthDateRange = (
    month,
    year
) => {

    const calendarMonth =
        parseMonth(
            month
        );

    const calendarYear =
        parseYear(
            year
        );

    const startDate =
        new Date(
            Date.UTC(
                calendarYear,
                calendarMonth - 1,
                1,
                0,
                0,
                0,
                0
            )
        );

    const nextMonthDate =
        new Date(
            Date.UTC(
                calendarYear,
                calendarMonth,
                1,
                0,
                0,
                0,
                0
            )
        );

    const endDate =
        new Date(
            nextMonthDate.getTime() - 1
        );

    return {

        month:
            calendarMonth,

        year:
            calendarYear,

        startDate,

        endDate,

        nextMonthDate
    };
};


// ============================================================
// HELPER: Payroll Include
// ============================================================

const payrollInclude = {

    employee: {

        select: {

            employeeId:
                true,

            firstName:
                true,

            lastName:
                true,

            email:
                true,

            status:
                true,

            companyId:
                true,

            branchId:
                true,

            branch: {

                select: {

                    branchId:
                        true,

                    branchName:
                        true
                }
            }
        }
    },

    advanceDeductionRecord:
        true
};


// ============================================================
// HELPER: Payroll Paid State
// ============================================================

const isPayrollPaid =
    (
        payroll
    ) => {

        return String(
            payroll?.status ||
            (
                payroll?.paymentDate
                    ? "PAID"
                    : "UNPAID"
            )
        ).toUpperCase() ===
            "PAID";
    };


// ============================================================
// HELPER: Payroll Period Key
// ============================================================

const getPayrollPeriodKey =
    (
        payroll
    ) => {

        return [
            payroll.employeeId,
            new Date(
                payroll.payPeriodStart
            ).toISOString().slice(
                0,
                10
            ),
            new Date(
                payroll.payPeriodEnd
            ).toISOString().slice(
                0,
                10
            )
        ].join("|");
    };


// ============================================================
// HELPER: Resolve Historical Duplicate Payrolls
// ============================================================
//
// Historical data can contain:
//   employee + same period + PAID
//   employee + same period + UNPAID
//
// PAID is authoritative.
//
// No rows are deleted or updated here.
// ============================================================

const resolveHistoricalDuplicates =
    (
        payrolls
    ) => {

        const payrollByPeriod =
            new Map();

        for (
            const payroll
            of payrolls
        ) {

            const key =
                getPayrollPeriodKey(
                    payroll
                );

            const existing =
                payrollByPeriod.get(
                    key
                );

            if (
                !existing
            ) {

                payrollByPeriod.set(
                    key,
                    payroll
                );

                continue;
            }

            const existingPaid =
                isPayrollPaid(
                    existing
                );

            const candidatePaid =
                isPayrollPaid(
                    payroll
                );

            if (
                candidatePaid &&
                !existingPaid
            ) {

                payrollByPeriod.set(
                    key,
                    payroll
                );

                continue;
            }

            /*
             * If both are paid or both are unpaid, keep the
             * newest payrollId deterministically.
             */
            if (
                candidatePaid ===
                existingPaid &&
                Number(
                    payroll.payrollId
                ) >
                Number(
                    existing.payrollId
                )
            ) {

                payrollByPeriod.set(
                    key,
                    payroll
                );
            }
        }

        return Array.from(
            payrollByPeriod.values()
        );
    };


// ============================================================
// HELPER: Format Payroll For Report
// ============================================================

const formatPayroll =
    (
        payroll
    ) => {

        const status =
            isPayrollPaid(
                payroll
            )
                ? "PAID"
                : "UNPAID";

        const grossSalary =
            roundMoney(
                payroll.baseSalary
            );

        const netSalary =
            roundMoney(
                payroll.netSalary
            );

        const advanceDeduction =
            roundMoney(
                payroll.advanceDeduction
            );

        return {

            payrollId:
                payroll.payrollId,

            employeeId:
                payroll.employeeId,

            employee:
                payroll.employee,

            branchId:
                payroll.employee
                    ? payroll.employee.branchId
                    : null,

            branchName:
                payroll.employee &&
                payroll.employee.branch
                    ? payroll.employee
                        .branch.branchName
                    : null,

            payPeriodStart:
                payroll.payPeriodStart,

            payPeriodEnd:
                payroll.payPeriodEnd,

            baseSalary:
                grossSalary,

            monthlyExpectedHours:
                decimalToNumber(
                    payroll.monthlyExpectedHours
                ),

            salaryRatePerHour:
                decimalToNumber(
                    payroll.salaryRatePerHour
                ),

            totalWorkingHours:
                decimalToNumber(
                    payroll.totalWorkingHours
                ),

            regularWorkingHours:
                decimalToNumber(
                    payroll.regularWorkingHours
                ),

            shortageHours:
                decimalToNumber(
                    payroll.shortageHours
                ),

            shortageDeduction:
                roundMoney(
                    payroll.shortageDeduction
                ),

            paidHolidayHours:
                decimalToNumber(
                    payroll.paidHolidayHours
                ),

            extraHours:
                decimalToNumber(
                    payroll.extraHours
                ),

            basicSalary:
                roundMoney(
                    payroll.basicSalary
                ),

            incentiveAmount:
                roundMoney(
                    payroll.incentiveAmount
                ),

            advanceDeduction,

            netSalary,

            scheduledPaymentDate:
                payroll.scheduledPaymentDate,

            paymentDate:
                payroll.paymentDate,

            status,

            advancePayment:
                payroll.advanceDeductionRecord
                    ? {

                        advanceId:
                            payroll.advanceDeductionRecord
                                .advanceId,

                        amount:
                            decimalToNumber(
                                payroll.advanceDeductionRecord
                                    .amount
                            ),

                        approvedAmount:
                            decimalToNumber(
                                payroll.advanceDeductionRecord
                                    .approvedAmount
                            ),

                        paidAmount:
                            decimalToNumber(
                                payroll.advanceDeductionRecord
                                    .paidAmount
                            ),

                        paymentDate:
                            payroll.advanceDeductionRecord
                                .paymentDate,

                        status:
                            payroll.advanceDeductionRecord
                                .status,

                        deductedAt:
                            payroll.advanceDeductionRecord
                                .deductedAt
                    }
                    : null,

            createdAt:
                payroll.createdAt,

            updatedAt:
                payroll.updatedAt
        };
    };


// ============================================================
// GET PAYROLL RECORDS
// ============================================================
//
// Main read operation used by all report functions.
//
// Supported filters:
//   employeeId
//   branchId
//   status
//   month
//   year
//   startDate
//   endDate
// ============================================================

const getPayrollRecords =
    async (
        companyId,
        filters = {},
        client = prisma
    ) => {

        const company =
            parsePositiveInteger(
                companyId,
                "companyId"
            );

        const where = {

            employee: {

                companyId:
                    company,

                ...(filters.employeeId
                    ? {
                        employeeId:
                            parsePositiveInteger(
                                filters.employeeId,
                                "employeeId"
                            )
                    }
                    : {}),

                ...(filters.branchId
                    ? {
                        branchId:
                            parsePositiveInteger(
                                filters.branchId,
                                "branchId"
                            )
                    }
                    : {})
            }
        };

        if (
            filters.status
        ) {

            const status =
                String(
                    filters.status
                ).toUpperCase();

            if (
                ![
                    "PAID",
                    "UNPAID"
                ].includes(
                    status
                )
            ) {

                throw createServiceError(
                    "status must be PAID or UNPAID",
                    400
                );
            }

            where.status =
                status;
        }

        if (
            filters.month !==
                undefined ||
            filters.year !==
                undefined
        ) {

            if (
                filters.month ===
                    undefined ||
                filters.year ===
                    undefined
            ) {

                throw createServiceError(
                    "Both month and year are required for payroll month filtering",
                    400
                );
            }

            const range =
                getMonthDateRange(
                    filters.month,
                    filters.year
                );

            where.payPeriodStart = {

                gte:
                    range.startDate,

                lt:
                    range.nextMonthDate
            };
        }

        if (
            filters.startDate
        ) {

            const start =
                new Date(
                    filters.startDate
                );

            if (
                Number.isNaN(
                    start.getTime()
                )
            ) {

                throw createServiceError(
                    "startDate must be a valid date",
                    400
                );
            }

            where.payPeriodStart = {

                ...(where.payPeriodStart || {}),

                gte:
                    start
            };
        }

        if (
            filters.endDate
        ) {

            const end =
                new Date(
                    filters.endDate
                );

            if (
                Number.isNaN(
                    end.getTime()
                )
            ) {

                throw createServiceError(
                    "endDate must be a valid date",
                    400
                );
            }

            where.payPeriodEnd = {

                ...(where.payPeriodEnd || {}),

                lte:
                    end
            };
        }

        const payrolls =
            await client.payroll.findMany({

                where,

                include:
                    payrollInclude,

                orderBy: [

                    {
                        payPeriodStart:
                            "desc"
                    },

                    {
                        payrollId:
                            "desc"
                    }
                ]
            });

        const resolved =
            resolveHistoricalDuplicates(
                payrolls
            );

        return resolved.map(
            formatPayroll
        );
    };


// ============================================================
// GET PAYROLL HISTORY
// ============================================================

const getPayrollHistory =
    async (
        companyId,
        filters = {},
        client = prisma
    ) => {

        return await getPayrollRecords(
            companyId,
            filters,
            client
        );
    };


// ============================================================
// GET PAID PAYROLL HISTORY
// ============================================================

const getPaidPayrollHistory =
    async (
        companyId,
        filters = {},
        client = prisma
    ) => {

        return await getPayrollRecords(
            companyId,
            {
                ...filters,
                status:
                    "PAID"
            },
            client
        );
    };


// ============================================================
// GET PENDING PAYROLL HISTORY
// ============================================================
//
// Pending = UNPAID records after historical duplicate resolution.
//
// A PAID record for the same employee + period makes any historical
// unpaid duplicate disappear from the report automatically.
// ============================================================

const getPendingPayrollHistory =
    async (
        companyId,
        filters = {},
        client = prisma
    ) => {

        const records =
            await getPayrollRecords(
                companyId,
                filters,
                client
            );

        return records.filter(
            (
                payroll
            ) =>
                payroll.status ===
                "UNPAID"
        );
    };


// ============================================================
// GET PAYROLL REPORT BY MONTH/YEAR
// ============================================================
//
// Financial report for a selected payroll period month/year.
//
// Important:
//
//   totalPayroll
//       = sum(baseSalary)
//
//   totalNetPayroll
//       = sum(netSalary)
//
//   totalAdvanceTaken
//       = sum(advanceDeduction)
//
//   totalPaid
//       = sum(netSalary for PAID)
//
//   totalPending
//       = sum(netSalary for UNPAID)
//
//   totalPayrollGenerated
//       = gross payroll generated for the selected period
//
// The current frontend distinguishes gross payroll from the amount
// actually payable after attendance/advance deductions, so both
// gross and net totals are returned.
// ============================================================

const getPayrollSummaryByMonthYear =
    async (
        companyId,
        month,
        year,
        filters = {},
        client = prisma
    ) => {

        const range =
            getMonthDateRange(
                month,
                year
            );

        const payrolls =
            await getPayrollRecords(
                companyId,
                {
                    ...filters,

                    month:
                        range.month,

                    year:
                        range.year
                },
                client
            );

        let totalPayroll =
            0;

        let totalNetPayroll =
            0;

        let totalAdvanceTaken =
            0;

        let totalPaid =
            0;

        let totalPending =
            0;

        let paidCount =
            0;

        let pendingCount =
            0;

        const employeeIds =
            new Set();

        for (
            const payroll
            of payrolls
        ) {

            const grossAmount =
                roundMoney(
                    payroll.baseSalary
                );

            const netAmount =
                roundMoney(
                    payroll.netSalary
                );

            const advanceAmount =
                roundMoney(
                    payroll.advanceDeduction
                );

            totalPayroll =
                roundMoney(
                    totalPayroll +
                    grossAmount
                );

            totalNetPayroll =
                roundMoney(
                    totalNetPayroll +
                    netAmount
                );

            totalAdvanceTaken =
                roundMoney(
                    totalAdvanceTaken +
                    advanceAmount
                );

            employeeIds.add(
                payroll.employeeId
            );

            if (
                payroll.status ===
                "PAID"
            ) {

                totalPaid =
                    roundMoney(
                        totalPaid +
                        netAmount
                    );

                paidCount +=
                    1;

            } else {

                totalPending =
                    roundMoney(
                        totalPending +
                        netAmount
                    );

                pendingCount +=
                    1;
            }
        }

        return {

            month:
                range.month,

            year:
                range.year,

            periodStart:
                range.startDate,

            periodEnd:
                range.endDate,

            employeeCount:
                employeeIds.size,

            payrollCount:
                payrolls.length,

            paidCount,

            pendingCount,

            totalPayroll:
                roundMoney(
                    totalPayroll
                ),

            totalPayrollGenerated:
                roundMoney(
                    totalPayroll
                ),

            totalNetPayroll:
                roundMoney(
                    totalNetPayroll
                ),

            totalAdvanceTaken:
                roundMoney(
                    totalAdvanceTaken
                ),

            totalPaid:
                roundMoney(
                    totalPaid
                ),

            totalPending:
                roundMoney(
                    totalPending
                ),

            payrolls
        };
    };


// ============================================================
// GET EMPLOYEE MONTHLY PAYROLL REPORT
// ============================================================

const getEmployeeMonthlyPayrollReport =
    async (
        employeeId,
        companyId,
        month,
        year,
        client = prisma
    ) => {

        const employee =
            parsePositiveInteger(
                employeeId,
                "employeeId"
            );

        const records =
            await getPayrollRecords(
                companyId,
                {
                    employeeId:
                        employee,

                    month,

                    year
                },
                client
            );

        let totalSalary =
            0;

        let totalAdvanceTaken =
            0;

        let totalPaid =
            0;

        let totalPending =
            0;

        let paidCount =
            0;

        let pendingCount =
            0;

        for (
            const payroll
            of records
        ) {

            totalSalary =
                roundMoney(
                    totalSalary +
                    payroll.baseSalary
                );

            totalAdvanceTaken =
                roundMoney(
                    totalAdvanceTaken +
                    payroll.advanceDeduction
                );

            if (
                payroll.status ===
                "PAID"
            ) {

                totalPaid =
                    roundMoney(
                        totalPaid +
                        payroll.netSalary
                    );

                paidCount +=
                    1;

            } else {

                totalPending =
                    roundMoney(
                        totalPending +
                        payroll.netSalary
                    );

                pendingCount +=
                    1;
            }
        }

        return {

            employeeId:
                employee,

            month:
                parseMonth(
                    month
                ),

            year:
                parseYear(
                    year
                ),

            totalSalary,

            totalAdvanceTaken,

            totalPaid,

            totalPending,

            paidCount,

            pendingCount,

            payrollCount:
                records.length,

            payrolls:
                records
        };
    };


// ============================================================
// GET PAYROLL REPORT BY DATE RANGE
// ============================================================

const getPayrollReportByDateRange =
    async (
        companyId,
        startDate,
        endDate,
        filters = {},
        client = prisma
    ) => {

        const start =
            new Date(
                startDate
            );

        const end =
            new Date(
                endDate
            );

        if (
            Number.isNaN(
                start.getTime()
            ) ||
            Number.isNaN(
                end.getTime()
            )
        ) {

            throw createServiceError(
                "startDate and endDate must be valid dates",
                400
            );
        }

        if (
            start >
            end
        ) {

            throw createServiceError(
                "startDate cannot be after endDate",
                400
            );
        }

        return await getPayrollRecords(
            companyId,
            {
                ...filters,

                startDate:
                    start,

                endDate:
                    end
            },
            client
        );
    };


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    decimalToNumber,

    roundMoney,

    getMonthDateRange,

    getPayrollRecords,

    getPayrollHistory,

    getPaidPayrollHistory,

    getPendingPayrollHistory,

    getPayrollSummaryByMonthYear,

    getEmployeeMonthlyPayrollReport,

    getPayrollReportByDateRange
};