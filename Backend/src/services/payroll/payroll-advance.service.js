const prisma = require("../../config/database");


// ============================================================
// PAYROLL ADVANCE SERVICE
// ============================================================
//
// Responsibility:
//   - Find paid advances eligible for payroll deduction
//   - Calculate the live advance deduction for a payroll period
//   - Provide advance details for payroll views
//   - Link one eligible advance to a payroll record
//   - Release an advance when an unpaid payroll is deleted/rebuilt
//
// Important current-schema constraint:
//   AdvancePayment.deductedInPayrollId is UNIQUE.
//   Therefore one AdvancePayment can be linked to one Payroll,
//   and one Payroll can have only one linked AdvancePayment
//   through the current Prisma relation.
//
// The existing payroll behavior also uses the oldest PAID,
// unused advance when creating a payroll record. This service
// preserves that behavior instead of silently changing the DB
// relationship design.
//
// This service does NOT:
//   - create employee advance requests
//   - approve/reject employee advance requests
//   - mark an advance as PAID
//   - create Payroll records
//
// Those responsibilities remain in the main advance/payment
// services until the final payroll.service coordinator is wired.
// ============================================================


// ============================================================
// HELPER: Service Error
// ============================================================

const createServiceError = (
    message,
    statusCode = 400
) => {

    const error = new Error(message);

    error.statusCode = statusCode;

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
        decimalToNumber(value).toFixed(2)
    );
};


// ============================================================
// HELPER: Parse Date
// ============================================================

const parseDate = (
    value,
    fieldName
) => {

    const date =
        value instanceof Date
            ? new Date(value.getTime())
            : new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        throw createServiceError(
            `${fieldName} must be a valid date`,
            400
        );
    }

    return date;
};


// ============================================================
// HELPER: Start Of Day
// ============================================================

const startOfDay = (
    value
) => {

    const date =
        parseDate(
            value,
            "date"
        );

    date.setHours(
        0,
        0,
        0,
        0
    );

    return date;
};


// ============================================================
// HELPER: End Of Day
// ============================================================

const endOfDay = (
    value
) => {

    const date =
        parseDate(
            value,
            "date"
        );

    date.setHours(
        23,
        59,
        59,
        999
    );

    return date;
};


// ============================================================
// GET PAID ADVANCES FOR PAYROLL PERIOD
// ============================================================
//
// Only advances that are:
//   - PAID
//   - have a valid paidAmount
//   - have not already been deducted
//   - were paid inside the payroll period
//
// are eligible for this payroll period.
//
// This matches the current payroll business rule:
// actual paid advances are deducted, not merely approved requests.
// ============================================================

const getPaidAdvancesForPeriod = async (
    employeeId,
    payPeriodStart,
    payPeriodEnd,
    client = prisma
) => {

    const parsedEmployeeId =
        Number(employeeId);

    if (
        !Number.isInteger(
            parsedEmployeeId
        ) ||
        parsedEmployeeId < 1
    ) {

        throw createServiceError(
            "Invalid employee ID",
            400
        );
    }

    const startDate =
        startOfDay(
            payPeriodStart
        );

    const endDate =
        endOfDay(
            payPeriodEnd
        );

    if (
        startDate >
        endDate
    ) {

        throw createServiceError(
            "Payroll period start date cannot be after end date",
            400
        );
    }

    const advances =
        await client.advancePayment.findMany({

            where: {

                employeeId:
                    parsedEmployeeId,

                status:
                    "PAID",

                paidAmount: {
                    not: null
                },

                deductedInPayrollId:
                    null,

                deductedAt:
                    null,

                paymentDate: {

                    gte:
                        startDate,

                    lte:
                        endDate
                }
            },

            orderBy: [

                {
                    paymentDate:
                        "asc"
                },

                {
                    advanceId:
                        "asc"
                }
            ]
        });

    return advances;
};


// ============================================================
// GET OLDEST PAID UNUSED ADVANCE
// ============================================================
//
// The current DB relation permits one linked advance per payroll.
// The existing payroll creation logic therefore uses the oldest
// eligible paid advance.
//
// This function intentionally returns only one record.
// ============================================================

const getOldestPaidUnusedAdvance = async (
    employeeId,
    payPeriodStart,
    payPeriodEnd,
    client = prisma
) => {

    const advances =
        await getPaidAdvancesForPeriod(
            employeeId,
            payPeriodStart,
            payPeriodEnd,
            client
        );

    return advances.length > 0
        ? advances[0]
        : null;
};


// ============================================================
// GET LIVE ADVANCE SUMMARY
// ============================================================
//
// This summary intentionally includes ALL paid, undeducted
// advances inside the selected payroll period.
//
// It is useful for:
//   - live payroll displays
//   - reporting
//   - explaining how much advance is outstanding for the period
//
// The actual payroll relation still links only the oldest eligible
// advance because of the current unique deductedInPayrollId design.
// ============================================================

const getLiveAdvanceSummary = async (
    employeeId,
    payPeriodStart,
    payPeriodEnd,
    client = prisma
) => {

    const advances =
        await getPaidAdvancesForPeriod(
            employeeId,
            payPeriodStart,
            payPeriodEnd,
            client
        );

    let totalAdvance =
        0;

    const details =
        advances.map(
            (advance) => {

                const deductionAmount =
                    roundMoney(
                        advance.paidAmount
                    );

                totalAdvance =
                    roundMoney(
                        totalAdvance +
                        deductionAmount
                    );

                return {

                    advanceId:
                        advance.advanceId,

                    employeeId:
                        advance.employeeId,

                    amount:
                        decimalToNumber(
                            advance.amount
                        ),

                    approvedAmount:
                        decimalToNumber(
                            advance.approvedAmount
                        ),

                    paidAmount:
                        decimalToNumber(
                            advance.paidAmount
                        ),

                    deductionAmount,

                    paymentDate:
                        advance.paymentDate,

                    status:
                        advance.status,

                    deductedAt:
                        advance.deductedAt,

                    deductedInPayrollId:
                        advance.deductedInPayrollId
                };
            }
        );

    return {

        totalAdvance:
            roundMoney(
                totalAdvance
            ),

        advanceCount:
            details.length,

        advances:
            details
    };
};


// ============================================================
// CALCULATE ADVANCE DEDUCTION
// ============================================================
//
// The deduction cannot exceed the salary amount that is available
// for the payroll. This prevents a negative payroll amount.
//
// Example:
// salary = 25,000
// advance = 7,500
// deduction = 7,500
//
// salary = 5,000
// advance = 7,500
// deduction = 5,000
// ============================================================

const calculateAdvanceDeduction = (
    salaryAmount,
    advanceAmount
) => {

    const salary =
        Math.max(
            0,
            decimalToNumber(
                salaryAmount
            )
        );

    const advance =
        Math.max(
            0,
            decimalToNumber(
                advanceAmount
            )
        );

    return roundMoney(
        Math.min(
            salary,
            advance
        )
    );
};


// ============================================================
// CALCULATE ADVANCE ALLOCATION
// ============================================================
//
// Central payroll rule:
//
//   deduction = MIN(available salary, advance balance)
//
// This prevents an advance from forcing a negative payroll.
//
// Example:
//   salary  = 3,229
//   advance = 20,000
//
//   deduction       = 3,229
//   remainingAdvance = 16,771
//
// The payment service should use this result instead of throwing
// when the advance is larger than the available salary.
// ============================================================

const calculateAdvanceAllocation = (
    salaryAmount,
    advanceAmount
) => {

    const salaryAvailable =
        Math.max(
            0,
            roundMoney(
                salaryAmount
            )
        );

    const advanceBalance =
        Math.max(
            0,
            roundMoney(
                advanceAmount
            )
        );

    const deduction =
        calculateAdvanceDeduction(
            salaryAvailable,
            advanceBalance
        );

    const remainingAdvance =
        roundMoney(
            Math.max(
                0,
                advanceBalance -
                deduction
            )
        );

    return {

        salaryAvailable,

        advanceAmount:
            advanceBalance,

        advanceDeduction:
            deduction,

        remainingAdvance,

        fullyDeducted:
            remainingAdvance <= 0
    };
};


// ============================================================
// GET PAYROLL ADVANCE DEDUCTION
// ============================================================
//
// Returns both the amount and the source advance.
//
// The source advance is the oldest eligible paid advance.
// ============================================================

const getPayrollAdvanceDeduction = async (
    employeeId,
    payPeriodStart,
    payPeriodEnd,
    salaryAmount,
    client = prisma
) => {

    const advance =
        await getOldestPaidUnusedAdvance(
            employeeId,
            payPeriodStart,
            payPeriodEnd,
            client
        );

    if (
        !advance
    ) {

        return {

            advanceDeduction:
                0,

            remainingAdvance:
                0,

            fullyDeducted:
                true,

            advance:
                null
        };
    }

    const paidAmount =
        decimalToNumber(
            advance.paidAmount
        );

    if (
        !Number.isFinite(
            paidAmount
        ) ||
        paidAmount <= 0
    ) {

        throw createServiceError(
            `Paid advance ${advance.advanceId} has an invalid paid amount`,
            400
        );
    }

    const allocation =
        calculateAdvanceAllocation(
            salaryAmount,
            paidAmount
        );

    return {

        advanceDeduction:
            allocation.advanceDeduction,

        remainingAdvance:
            allocation.remainingAdvance,

        fullyDeducted:
            allocation.fullyDeducted,

        advance: {

            advanceId:
                advance.advanceId,

            employeeId:
                advance.employeeId,

            amount:
                decimalToNumber(
                    advance.amount
                ),

            approvedAmount:
                decimalToNumber(
                    advance.approvedAmount
                ),

            paidAmount,

            paymentDate:
                advance.paymentDate,

            status:
                advance.status
        }
    };
};



// ============================================================
// GET ADVANCE ALLOCATION FOR SALARY
// ============================================================
//
// Pure calculation helper for callers that already have the
// AdvancePayment row.
//
// This is exported so payroll-payment.service.js can stop
// duplicating the "advance cannot exceed salary" rule.
// ============================================================

const getAdvanceAllocationForSalary = (
    salaryAmount,
    advance
) => {

    if (
        !advance
    ) {

        return {

            salaryAvailable:
                Math.max(
                    0,
                    roundMoney(
                        salaryAmount
                    )
                ),

            advanceAmount:
                0,

            advanceDeduction:
                0,

            remainingAdvance:
                0,

            fullyDeducted:
                true
        };
    }

    const paidAmount =
        decimalToNumber(
            advance.paidAmount
        );

    if (
        !Number.isFinite(
            paidAmount
        ) ||
        paidAmount <= 0
    ) {

        throw createServiceError(
            `Paid advance ${advance.advanceId} has an invalid paid amount`,
            400
        );
    }

    return calculateAdvanceAllocation(
        salaryAmount,
        paidAmount
    );
};



// ============================================================
// MARK ADVANCE AS DEDUCTED
// ============================================================
//
// This function should be called inside the same Prisma
// transaction that creates the Payroll record.
//
// The WHERE clause repeats the eligibility checks so an advance
// cannot accidentally be linked twice after a concurrent request.
// ============================================================

const markAdvanceDeducted = async (
    advanceId,
    payrollId,
    client = prisma,
    deductedAt = new Date()
) => {

    const parsedAdvanceId =
        Number(advanceId);

    const parsedPayrollId =
        Number(payrollId);

    if (
        !Number.isInteger(
            parsedAdvanceId
        ) ||
        parsedAdvanceId < 1
    ) {

        throw createServiceError(
            "Invalid advance ID",
            400
        );
    }

    if (
        !Number.isInteger(
            parsedPayrollId
        ) ||
        parsedPayrollId < 1
    ) {

        throw createServiceError(
            "Invalid payroll ID",
            400
        );
    }

    const updatedAdvance =
        await client.advancePayment.updateMany({

            where: {

                advanceId:
                    parsedAdvanceId,

                status:
                    "PAID",

                paidAmount: {
                    not: null
                },

                deductedInPayrollId:
                    null,

                deductedAt:
                    null
            },

            data: {

                deductedInPayrollId:
                    parsedPayrollId,

                deductedAt:
                    deductedAt
            }
        });

    if (
        updatedAdvance.count !== 1
    ) {

        throw createServiceError(
            "Advance could not be marked as deducted. It may already be linked to another payroll.",
            409
        );
    }

    return client.advancePayment.findUnique({

        where: {

            advanceId:
                parsedAdvanceId
        }
    });
};


// ============================================================
// RELEASE ADVANCE FROM PAYROLL
// ============================================================
//
// Used when an unpaid payroll is safely deleted/rebuilt.
//
// Paid payrolls should not be released by the payment service.
// ============================================================

const releaseAdvanceFromPayroll = async (
    payrollId,
    client = prisma
) => {

    const parsedPayrollId =
        Number(payrollId);

    if (
        !Number.isInteger(
            parsedPayrollId
        ) ||
        parsedPayrollId < 1
    ) {

        throw createServiceError(
            "Invalid payroll ID",
            400
        );
    }

    const result =
        await client.advancePayment.updateMany({

            where: {

                deductedInPayrollId:
                    parsedPayrollId
            },

            data: {

                deductedInPayrollId:
                    null,

                deductedAt:
                    null
            }
        });

    return {

        releasedCount:
            result.count
    };
};


// ============================================================
// GET ADVANCE DEDUCTION RECORD
// ============================================================
//
// Convenience helper for reading the single advance currently
// linked to a payroll through AdvancePayroll.
// ============================================================

const getPayrollAdvanceRecord = async (
    payrollId,
    client = prisma
) => {

    const parsedPayrollId =
        Number(payrollId);

    if (
        !Number.isInteger(
            parsedPayrollId
        ) ||
        parsedPayrollId < 1
    ) {

        throw createServiceError(
            "Invalid payroll ID",
            400
        );
    }

    return client.advancePayment.findFirst({

        where: {

            deductedInPayrollId:
                parsedPayrollId
        },

        orderBy: {

            advanceId:
                "asc"
        }
    });
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    roundMoney,

    decimalToNumber,

    getPaidAdvancesForPeriod,

    getOldestPaidUnusedAdvance,

    getLiveAdvanceSummary,

    calculateAdvanceDeduction,

    calculateAdvanceAllocation,

    getAdvanceAllocationForSalary,

    getPayrollAdvanceDeduction,

    markAdvanceDeducted,

    releaseAdvanceFromPayroll,

    getPayrollAdvanceRecord
};