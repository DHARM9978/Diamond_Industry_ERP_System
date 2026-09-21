const prisma = require("../config/database");


// ============================================================
// CONSTANTS
// ============================================================

const PAYROLL_CONFIG_KEY_PREFIX =
    "PAYROLL_CONFIG_BRANCH_";

const DEFAULT_PAYROLL_CONFIGURATION = {
    startDay: 1,
    endDay: 0, // 0 = last day of month
    paymentDay: 5,
    enabled: true
};


// ============================================================
// HELPER: Parse Date
// ============================================================

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


// ============================================================
// HELPER: Round Money
// ============================================================

const roundMoney = (
    value
) => {

    return Number(
        Number(value).toFixed(2)
    );
};


// ============================================================
// HELPER: Positive Number
// ============================================================

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
        !Number.isFinite(
            numberValue
        ) ||
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


// ============================================================
// HELPER: Non-Negative Number
// ============================================================

const validateNonNegativeNumber = (
    value,
    fieldName
) => {

    const numberValue =
        Number(value);

    if (
        value === undefined ||
        value === null ||
        value === "" ||
        !Number.isFinite(
            numberValue
        ) ||
        numberValue < 0
    ) {

        const error =
            new Error(
                `${fieldName} must be greater than or equal to 0`
            );

        error.statusCode = 400;

        throw error;
    }

    return numberValue;
};


// ============================================================
// HELPER: Integer
// ============================================================

const validateInteger = (
    value,
    fieldName
) => {

    const numberValue =
        Number(value);

    if (
        value === undefined ||
        value === null ||
        value === "" ||
        !Number.isInteger(
            numberValue
        )
    ) {

        const error =
            new Error(
                `${fieldName} must be an integer`
            );

        error.statusCode = 400;

        throw error;
    }

    return numberValue;
};


// ============================================================
// HELPER: Decimal To Number
// ============================================================

const decimalToNumber = (
    value
) => {

    if (
        value === null ||
        value === undefined
    ) {

        return 0;
    }

    return Number(value);
};


// ============================================================
// HELPER: Start Of Day
// ============================================================

const startOfDay = (
    date
) => {

    const result =
        new Date(date);

    result.setHours(
        0,
        0,
        0,
        0
    );

    return result;
};


// ============================================================
// HELPER: End Of Day
// ============================================================

const endOfDay = (
    date
) => {

    const result =
        new Date(date);

    result.setHours(
        23,
        59,
        59,
        999
    );

    return result;
};


// ============================================================
// HELPER: Add Days
// ============================================================

const addDays = (
    date,
    days
) => {

    const result =
        new Date(date);

    result.setDate(
        result.getDate() + days
    );

    return result;
};


// ============================================================
// HELPER: Days In Month
// ============================================================

const getDaysInMonth = (
    year,
    month
) => {

    return new Date(
        year,
        month + 1,
        0
    ).getDate();
};


// ============================================================
// HELPER: Normalize Payroll Configuration
// ============================================================

const normalizePayrollConfiguration = (
    configuration
) => {

    const source =
        configuration ||
        DEFAULT_PAYROLL_CONFIGURATION;

    const startDay =
        Number(
            source.startDay
        );

    const endDay =
        Number(
            source.endDay
        );

    const paymentDay =
        Number(
            source.paymentDay
        );

    return {

        startDay:
            Number.isInteger(startDay) &&
                startDay >= 1 &&
                startDay <= 31
                ? startDay
                : DEFAULT_PAYROLL_CONFIGURATION.startDay,

        endDay:
            Number.isInteger(endDay) &&
                endDay >= 0 &&
                endDay <= 31
                ? endDay
                : DEFAULT_PAYROLL_CONFIGURATION.endDay,

        paymentDay:
            Number.isInteger(paymentDay) &&
                paymentDay >= 1 &&
                paymentDay <= 31
                ? paymentDay
                : DEFAULT_PAYROLL_CONFIGURATION.paymentDay,

        enabled:
            source.enabled !== false
    };
};


// ============================================================
// HELPER: Build Config Key
// ============================================================

const buildPayrollConfigKey = (
    branchId
) => {

    return `${PAYROLL_CONFIG_KEY_PREFIX}${branchId}`;
};


// ============================================================
// HELPER: Safe Error
// ============================================================

const createServiceError = (
    message,
    statusCode = 400
) => {

    const error =
        new Error(
            message
        );

    error.statusCode =
        statusCode;

    return error;
};


// ============================================================
// EMPLOYEE INCLUDE
// ============================================================

const employeeInclude = {

    branch: {
        select: {
            branchId: true,
            branchName: true,
            companyId: true
        }
    },
};


// ============================================================
// PAYROLL INCLUDE
// ============================================================

const payrollInclude = {

    employee: {
        include: employeeInclude
    },

    advanceDeductionRecord: true,

};


// ============================================================
// HELPER: Get Employee
// ============================================================

const getEmployeeById = async (
    employeeId,
    companyId
) => {

    const employee =
        await prisma.employee.findFirst({

            where: {

                employeeId:
                    Number(employeeId),

                companyId:
                    Number(companyId)
            },

            include:
                employeeInclude
        });

    if (!employee) {

        throw createServiceError(
            "Employee not found",
            404
        );
    }

    return employee;
};


// ============================================================
// HELPER: Get Branch
// ============================================================

const getBranchById = async (
    branchId,
    companyId
) => {

    const branch =
        await prisma.branch.findFirst({

            where: {

                branchId:
                    Number(branchId),

                companyId:
                    Number(companyId)
            }
        });

    if (!branch) {

        throw createServiceError(
            "Branch not found",
            404
        );
    }

    return branch;
};


// ============================================================
// HELPER: Get Payroll Configuration
// ============================================================

const getPayrollConfiguration = async (
    branchId,
    companyId
) => {

    const branch =
        await getBranchById(
            branchId,
            companyId
        );

    const configKey =
        buildPayrollConfigKey(
            branch.branchId
        );

    let configuration =
        null;

    try {

        const setting =
            await prisma.setting.findFirst({

                where: {
                    companyId:
                        Number(companyId),

                    key:
                        configKey
                }
            });

        if (setting) {

            let parsedValue =
                setting.value;

            if (
                typeof parsedValue ===
                "string"
            ) {

                try {

                    parsedValue =
                        JSON.parse(
                            parsedValue
                        );

                } catch (
                parseError
                ) {

                    parsedValue =
                        null;
                }
            }

            configuration =
                normalizePayrollConfiguration(
                    parsedValue
                );
        }

    } catch (
    error
    ) {

        /*
         * Some project versions may not have
         * systemSetting available in the generated
         * Prisma client. In that case, fall back
         * to the default payroll configuration.
         */
    }

    if (!configuration) {

        configuration =
            normalizePayrollConfiguration(
                DEFAULT_PAYROLL_CONFIGURATION
            );
    }

    return configuration;
};


// ============================================================
// HELPER: Save Payroll Configuration
// ============================================================

const savePayrollConfiguration = async (
    branchId,
    companyId,
    configuration
) => {

    const branch =
        await getBranchById(
            branchId,
            companyId
        );

    const normalized =
        normalizePayrollConfiguration(
            configuration
        );

    const settingKey =
        buildPayrollConfigKey(
            branch.branchId
        );

    try {

        const result =
            await prisma.$transaction(
                async (
                    transaction
                ) => {

                    const settingValue =
                        JSON.stringify(
                            normalized
                        );

                    const existing =
                        await transaction.setting.findFirst({

                            where: {
                                companyId:
                                    Number(companyId),

                                key:
                                    settingKey
                            }
                        });

                    let setting;

                    if (existing) {

                        setting =
                            await transaction.setting.update({

                                where: {
                                    settingId:
                                        existing.settingId
                                },

                                data: {
                                    value:
                                        settingValue
                                }
                            });

                    } else {

                        setting =
                            await transaction.setting.create({

                                data: {

                                    companyId:
                                        Number(companyId),

                                    key:
                                        settingKey,

                                    value:
                                        settingValue
                                }
                            });
                    }

                    /*
                     * Recalculate the payroll dates for every
                     * existing UNPAID payroll in this branch.
                     *
                     * PAID payroll is intentionally excluded so
                     * historical payroll records remain unchanged.
                     *
                     * The existing payroll's period-start month is
                     * retained and the new configuration is applied
                     * to that month. This correctly recalculates:
                     *
                     *   payPeriodStart
                     *   payPeriodEnd
                     *   scheduledPaymentDate
                     *
                     * paymentDate remains NULL for unpaid payroll.
                     */
                    const unpaidPayrolls =
                        await transaction.payroll.findMany({

                            where: {

                                status:
                                    "UNPAID",

                                paymentDate:
                                    null,

                                employee: {

                                    companyId:
                                        Number(companyId),

                                    branchId:
                                        Number(branchId)
                                }
                            },

                            select: {

                                payrollId:
                                    true,

                                payPeriodStart:
                                    true
                            }
                        });

                    let updatedUnpaidPayrolls =
                        0;

                    for (
                        const payroll
                        of unpaidPayrolls
                    ) {

                        const existingPeriodStart =
                            new Date(
                                payroll.payPeriodStart
                            );

                        const recalculatedPeriod =
                            buildPeriodFromStartMonth(
                                existingPeriodStart.getFullYear(),
                                existingPeriodStart.getMonth(),
                                normalized
                            );

                        const scheduledPaymentDate =
                            getScheduledPaymentDateForPeriod(
                                recalculatedPeriod.periodEnd,
                                normalized
                            );

                        await transaction.payroll.update({

                            where: {

                                payrollId:
                                    payroll.payrollId
                            },

                            data: {

                                payPeriodStart:
                                    recalculatedPeriod.periodStart,

                                payPeriodEnd:
                                    recalculatedPeriod.periodEnd,

                                scheduledPaymentDate:
                                    scheduledPaymentDate,

                                paymentDate:
                                    null,

                                status:
                                    "UNPAID"
                            }
                        });

                        updatedUnpaidPayrolls += 1;
                    }

                    return {

                        setting,

                        updatedUnpaidPayrolls
                    };
                }
            );

        /*
         * Return the saved configuration together with the
         * recalculated current and next periods. This gives the
         * controller/UI the same source of truth that is now stored
         * in the database.
         */
        const currentPeriod =
            await getCurrentPayrollPeriod(
                normalized
            );

        const nextPeriod =
            await getNextPayrollPeriod(
                normalized
            );

        return {

            ...result.setting,

            configuration:
                normalized,

            currentPeriod,

            nextPeriod,

            updatedUnpaidPayrolls:
                result.updatedUnpaidPayrolls
        };

    } catch (
        error
    ) {

        console.error(
            "[Payroll Configuration Save Error]",
            error
        );

        throw createServiceError(
            "Unable to save payroll configuration"
        );
    }
};


// ============================================================
// HELPER: Resolve Day Of Month
// ============================================================

const resolveDayOfMonth = (
    year,
    month,
    configuredDay
) => {

    const lastDay =
        getDaysInMonth(
            year,
            month
        );

    if (
        configuredDay === 0
    ) {

        return lastDay;
    }

    return Math.min(
        configuredDay,
        lastDay
    );
};


// ============================================================
// HELPER: Build Period
// ============================================================

const buildPeriodFromStartMonth = (
    year,
    month,
    configuration
) => {

    const config =
        normalizePayrollConfiguration(
            configuration
        );

    const startDay =
        resolveDayOfMonth(
            year,
            month,
            config.startDay
        );

    let endYear =
        year;

    let endMonth =
        month;

    let endDay =
        config.endDay;

    /*
     * endDay = 0 means the last day
     * of the same month.
     *
     * When endDay is less than startDay,
     * the period ends in the following month.
     *
     * Example:
     * start = 26
     * end = 25
     *
     * Period:
     * 26 Aug -> 25 Sep
     */

    if (
        endDay !== 0 &&
        endDay < startDay
    ) {

        endMonth += 1;

        if (
            endMonth > 11
        ) {

            endMonth = 0;
            endYear += 1;
        }
    }

    const resolvedEndDay =
        resolveDayOfMonth(
            endYear,
            endMonth,
            endDay
        );

    const periodStart =
        new Date(
            year,
            month,
            startDay
        );

    const periodEnd =
        new Date(
            endYear,
            endMonth,
            resolvedEndDay
        );

    return {

        periodStart:
            startOfDay(
                periodStart
            ),

        periodEnd:
            endOfDay(
                periodEnd
            )
    };
};


// ============================================================
// HELPER: Get Scheduled Payment Date
// ============================================================

const getScheduledPaymentDateForPeriod = (
    periodEnd,
    configuration
) => {

    const config =
        normalizePayrollConfiguration(
            configuration
        );

    const paymentDay =
        config.paymentDay;

    let paymentYear =
        periodEnd.getFullYear();

    let paymentMonth =
        periodEnd.getMonth();

    /*
     * Payment is normally after the
     * payroll period.
     *
     * Example:
     * Period: 01 Sep -> 30 Sep
     * Payment Day: 5
     *
     * Payment: 05 Oct
     */

    paymentMonth += 1;

    if (
        paymentMonth > 11
    ) {

        paymentMonth = 0;
        paymentYear += 1;
    }

    const resolvedPaymentDay =
        resolveDayOfMonth(
            paymentYear,
            paymentMonth,
            paymentDay
        );

    return startOfDay(
        new Date(
            paymentYear,
            paymentMonth,
            resolvedPaymentDay
        )
    );
};


// ============================================================
// HELPER: Check Period Ended
// ============================================================

const hasPeriodEnded = (
    periodEnd,
    referenceDate = new Date()
) => {

    return (
        new Date(
            referenceDate
        ).getTime() >
        new Date(
            periodEnd
        ).getTime()
    );
};


// ============================================================
// HELPER: Period Overlap
// ============================================================

const periodsOverlap = (
    existingStart,
    existingEnd,
    newStart,
    newEnd
) => {

    return (
        new Date(existingStart)
            .getTime() <=
        new Date(newEnd)
            .getTime()
    ) &&
        (
            new Date(existingEnd)
                .getTime() >=
            new Date(newStart)
                .getTime()
        );
};


// ============================================================
// HELPER: Find Overlapping Payroll
// ============================================================

const findOverlappingPayroll = async (
    employeeId,
    payPeriodStart,
    payPeriodEnd,
    excludePayrollId = null
) => {

    const where = {

        employeeId:
            Number(employeeId),

        AND: [

            {
                payPeriodStart: {
                    lte:
                        new Date(
                            payPeriodEnd
                        )
                }
            },

            {
                payPeriodEnd: {
                    gte:
                        new Date(
                            payPeriodStart
                        )
                }
            }
        ]
    };

    if (
        excludePayrollId !== null &&
        excludePayrollId !== undefined
    ) {

        where.NOT = {

            payrollId:
                Number(
                    excludePayrollId
                )
        };
    }

    return await prisma.payroll.findFirst({
        where
    });
};


// ============================================================
// HELPER: Calculate Hourly Rate
// ============================================================

const calculateHourlyRate = (
    baseSalary,
    expectedHours
) => {

    const salary =
        decimalToNumber(
            baseSalary
        );

    const hours =
        decimalToNumber(
            expectedHours
        );

    if (
        hours <= 0
    ) {

        return 0;
    }

    return roundMoney(
        salary / hours
    );
};


// ============================================================
// HELPER: Calculate Basic Salary
// ============================================================

const calculateBasicSalary = (
    totalWorkingHours,
    salaryRatePerHour
) => {

    return roundMoney(

        decimalToNumber(
            totalWorkingHours
        ) *

        decimalToNumber(
            salaryRatePerHour
        )
    );
};

// ============================================================
// HELPER: Get Attendance Working Hours For Period
// ============================================================
//
// Attendance is authoritative for payroll working hours.
// The actual Attendance model uses:
//   date, totalHours, checkInTime, checkOutTime
//
// This helper is intentionally shared by payroll generation and
// unpaid-payroll display so an old unpaid payroll cannot continue
// showing stale zero working hours after attendance is recorded.
// ============================================================

const getAttendanceWorkingHoursForPeriod = async (
    employeeId,
    payPeriodStart,
    payPeriodEnd
) => {

    const attendanceRecords =
        await prisma.attendance.findMany({

            where: {

                employeeId:
                    Number(employeeId),

                date: {

                    gte:
                        startOfDay(
                            payPeriodStart
                        ),

                    lte:
                        endOfDay(
                            payPeriodEnd
                        )
                }
            },

            orderBy: {

                date:
                    "asc"
            }
        });

    let totalWorkingHours =
        0;

    for (
        const attendance
        of attendanceRecords
    ) {

        let hours =
            0;

        if (
            attendance.totalHours !==
                undefined &&
            attendance.totalHours !==
                null
        ) {

            hours =
                decimalToNumber(
                    attendance.totalHours
                );

        } else if (
            attendance.checkInTime &&
            attendance.checkOutTime
        ) {

            const attendanceDate =
                new Date(
                    attendance.date
                );

            const checkInParts =
                String(
                    attendance.checkInTime
                )
                    .slice(-8)
                    .split(":")
                    .map(Number);

            const checkOutParts =
                String(
                    attendance.checkOutTime
                )
                    .slice(-8)
                    .split(":")
                    .map(Number);

            const entry =
                new Date(
                    attendanceDate
                );

            entry.setHours(
                checkInParts[0] || 0,
                checkInParts[1] || 0,
                checkInParts[2] || 0,
                0
            );

            const exit =
                new Date(
                    attendanceDate
                );

            exit.setHours(
                checkOutParts[0] || 0,
                checkOutParts[1] || 0,
                checkOutParts[2] || 0,
                0
            );

            const difference =
                exit.getTime() -
                entry.getTime();

            if (
                difference > 0
            ) {

                hours =
                    difference /
                    (
                        1000 *
                        60 *
                        60
                    );
            }
        }

        if (
            Number.isFinite(
                hours
            ) &&
            hours > 0
        ) {

            totalWorkingHours +=
                hours;
        }
    }

    return roundMoney(
        totalWorkingHours
    );
};


// ============================================================
// [NEW] HELPER: Calculate Attendance Breakdown
// ============================================================
//
// Regular salary is capped at expected monthly hours.
// Hours above expected are stored as extra work.
// Hours below expected become shortage hours.
//
const calculateAttendanceBreakdown = (
    totalWorkingHours,
    expectedHours,
    salaryRatePerHour
) => {

    const actualHours =
        Math.max(
            0,
            decimalToNumber(
                totalWorkingHours
            )
        );

    const expected =
        Math.max(
            0,
            decimalToNumber(
                expectedHours
            )
        );

    const hourlyRate =
        Math.max(
            0,
            decimalToNumber(
                salaryRatePerHour
            )
        );

    const regularWorkingHours =
        Math.min(
            actualHours,
            expected
        );

    const extraHours =
        Math.max(
            actualHours - expected,
            0
        );

    const shortageHours =
        Math.max(
            expected - actualHours,
            0
        );

    const regularSalary =
        roundMoney(
            regularWorkingHours *
            hourlyRate
        );

    const shortageDeduction =
        roundMoney(
            shortageHours *
            hourlyRate
        );

    return {

        regularWorkingHours:
            roundMoney(
                regularWorkingHours
            ),

        extraHours:
            roundMoney(
                extraHours
            ),

        shortageHours:
            roundMoney(
                shortageHours
            ),

        shortageDeduction,

        regularSalary
    };
};


// ============================================================
// [NEW] HELPER: Get Accumulated Extra Work
// ============================================================
//
// Only ACCUMULATED records with no settlement are included.
// SETTLED records remain permanently as historical records.
//
const getAccumulatedExtraWork = async (
    employeeId
) => {

    const records =
        await prisma.extraWork.findMany({

            where: {

                employeeId:
                    Number(employeeId),

                status:
                    "ACCUMULATED",

                settlementId:
                    null
            },

            orderBy: {

                createdAt:
                    "asc"
            }
        });

    const totalHours =
        roundMoney(
            records.reduce(
                (
                    total,
                    record
                ) =>
                    total +
                    decimalToNumber(
                        record.extraHours
                    ),
                0
            )
        );

    return {

        records,

        totalHours
    };
};




// ============================================================
// HELPER: Get Closed Extra Work For Payroll
// ============================================================
//
// SETTLED records have already been paid and must not contribute
// to the current overtime balance.
//
// REJECTED records have been closed as well and must not return
// to the current overtime balance.
//
// This helper is intentionally scoped to one payroll so that
// settlements covering multiple payroll periods do not cause
// hours from one payroll to be subtracted from another.
// ============================================================

const getClosedExtraWorkForPayroll = async (
    employeeId,
    payrollId
) => {

    const records =
        await prisma.extraWork.findMany({

            where: {

                employeeId:
                    Number(employeeId),

                payrollId:
                    Number(payrollId),

                status: {
                    in: [
                        "SETTLED",
                        "REJECTED"
                    ]
                }
            },

            orderBy: {

                createdAt:
                    "asc"
            }
        });

    const closedHours =
        roundMoney(
            records.reduce(
                (
                    total,
                    record
                ) =>
                    total +
                    decimalToNumber(
                        record.extraHours
                    ),
                0
            )
        );

    return {

        records,

        closedHours
    };
};



// ============================================================
// HELPER: Get Paid Advances For Payroll Period
// ============================================================

const getPaidAdvancesForPeriod = async (
    employeeId,
    payPeriodStart,
    payPeriodEnd
) => {

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

    const advances =
        await prisma.advancePayment.findMany({

            where: {

                employeeId:
                    Number(employeeId),

                // Payroll deduction is based on ACTUALLY PAID
                // advances, not merely approved requests.
                status:
                    "PAID",

                paidAmount: {
                    not: null
                },

                // Do not deduct the same advance again.
                deductedInPayrollId:
                    null,

                deductedAt:
                    null,

                // Use the requested payroll period. The old code
                // accepted these arguments but did not apply them,
                // which could cause old advances to appear again
                // in a later payroll period.
                paymentDate: {
                    gte:
                        startDate,
                    lte:
                        endDate
                }
            },

            orderBy: {

                paymentDate:
                    "asc"
            }
        });

    return advances;
};


// ============================================================
// HELPER: Get Live Advance Summary
// ============================================================

const getLiveAdvanceSummary = async (
    employeeId,
    payPeriodStart,
    payPeriodEnd
) => {

    const advances =
        await getPaidAdvancesForPeriod(
            employeeId,
            payPeriodStart,
            payPeriodEnd
        );

    let total =
        0;

    const details =
        advances.map(
            (
                advance
            ) => {

                const amount =
                    roundMoney(
                        decimalToNumber(
                            advance.status === "APPROVED"
                                ? advance.approvedAmount
                                : advance.paidAmount
                        )
                    );

                total =
                    roundMoney(
                        total + amount
                    );

                return {

                    advancePaymentId:
                        advance.advanceId,

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

                    // Actual amount being deducted from payroll.
                    deductionAmount:
                        amount,

                    paymentDate:
                        advance.paymentDate,

                    status:
                        advance.status
                };
            }
        );

    return {

        totalAdvance:
            roundMoney(
                total
            ),

        advances:
            details
    };
};


// ============================================================
// HELPER: Get Payroll Scheduled Payment Date
// ============================================================

const getScheduledPaymentDate = async (
    payroll
) => {

    if (
        payroll.scheduledPaymentDate
    ) {

        return startOfDay(
            payroll.scheduledPaymentDate
        );
    }

    if (
        payroll.employee &&
        payroll.employee.branchId
    ) {

        const configuration =
            await getPayrollConfiguration(
                payroll.employee.branchId,
                payroll.employee.companyId
            );

        return getScheduledPaymentDateForPeriod(
            payroll.payPeriodEnd,
            configuration
        );
    }

    return null;
};


// ============================================================
// HELPER: Decorate Payroll
// ============================================================

const decoratePayroll = async (
    payroll
) => {

    if (!payroll) {

        return null;
    }

    const status =
        payroll.status ||
        (
            payroll.paymentDate
                ? "PAID"
                : "UNPAID"
        );

    // [CHANGED] basicSalary is the actual regular payable salary.
    // baseSalary remains the monthly salary snapshot.
    const salaryAmount =
        decimalToNumber(
            payroll.basicSalary
        );

    const scheduledPaymentDate =
        await getScheduledPaymentDate(
            payroll
        );

    /*
     * PAID payroll is historical.
     * Do not recalculate it from current
     * advances or current employee salary.
     */
    if (
        status === "PAID"
    ) {

        const linkedAdvances =
            Array.isArray(
                payroll.advanceDeductionRecord
            )
                ? payroll.advanceDeductionRecord.map(
                    (advance) => ({

                        advancePaymentId:
                            advance.advanceId,

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

                        paymentDate:
                            advance.paymentDate,

                        status:
                            advance.status,

                        deductedAt:
                            advance.deductedAt,

                        deductedInPayrollId:
                            advance.deductedInPayrollId
                    })
                )
                : [];

        return {

            ...payroll,

            status:
                "PAID",

            advanceDeduction:
                decimalToNumber(
                    payroll.advanceDeduction
                ),

            netSalary:
                decimalToNumber(
                    payroll.netSalary
                ),

            pendingAmount:
                decimalToNumber(
                    payroll.netSalary
                ),

            scheduledPaymentDate,

            advancePayments:
                linkedAdvances
        };
    }

    /*
     * UNPAID payroll is live.
     *
     * Re-read attendance for the payroll period so that
     * payroll does not display stale totalWorkingHours,
     * regularWorkingHours, shortageHours, extraHours, or
     * basicSalary values from the moment the payroll row
     * was originally created.
     */
    let liveWorkingHours =
        decimalToNumber(
            payroll.totalWorkingHours
        );

    try {

        liveWorkingHours =
            await getAttendanceWorkingHoursForPeriod(
                payroll.employeeId,
                payroll.payPeriodStart,
                payroll.payPeriodEnd
            );

    } catch (
        attendanceError
    ) {

        console.error(
            "[Payroll Attendance Refresh Error]",
            attendanceError
        );
    }

    // UNPAID payroll uses the employee's CURRENT salary configuration.
    // PAID payrolls remain historical snapshots and are handled above.
    const currentEmployee =
        await prisma.employee.findUnique({

            where: {

                employeeId:
                    Number(payroll.employeeId)
            },

            select: {

                baseSalary: true,

                monthlyExpectedHours: true,

                salaryRatePerHour: true
            }
        });

    const liveBaseSalary =
        currentEmployee
            ? decimalToNumber(
                currentEmployee.baseSalary
            )
            : decimalToNumber(
                payroll.baseSalary
            );

    const liveExpectedHours =
        currentEmployee
            ? decimalToNumber(
                currentEmployee.monthlyExpectedHours
            )
            : decimalToNumber(
                payroll.monthlyExpectedHours
            );

    const liveHourlyRate =
        currentEmployee
            ? (
                decimalToNumber(
                    currentEmployee.salaryRatePerHour
                ) ||
                calculateHourlyRate(
                    liveBaseSalary,
                    liveExpectedHours
                )
            )
            : (
                decimalToNumber(
                    payroll.salaryRatePerHour
                ) ||
                calculateHourlyRate(
                    liveBaseSalary,
                    liveExpectedHours
                )
            );

    const liveAttendanceBreakdown =
        calculateAttendanceBreakdown(
            liveWorkingHours,
            liveExpectedHours,
            liveHourlyRate
        );

    /*
     * Pending amount is based on the employee's monthly base salary,
     * then shortage deduction and advance deduction are applied.
     *
     * regularSalary/basicSalary is the attendance-earned salary and
     * is kept separately for payroll reporting. It must not be used
     * as the pending base here because shortage deduction is stored
     * as a separate deduction.
     */
    const pendingBaseSalary =
        Math.max(
            0,
            roundMoney(
                liveBaseSalary
            )
        );

    const liveShortageDeduction =
        Math.min(
            pendingBaseSalary,
            Math.max(
                0,
                roundMoney(
                    liveAttendanceBreakdown.shortageDeduction
                )
            )
        );

    const liveAdvanceSummary =
        await getLiveAdvanceSummary(
            payroll.employeeId,
            payroll.payPeriodStart,
            payroll.payPeriodEnd
        );

    const amountAfterShortage =
        Math.max(
            0,
            roundMoney(
                pendingBaseSalary -
                liveShortageDeduction
            )
        );

    const advanceDeduction =
        Math.min(
            amountAfterShortage,
            Math.max(
                0,
                liveAdvanceSummary.totalAdvance
            )
        );

    const pendingAmount =
        Math.max(
            0,
            roundMoney(
                amountAfterShortage -
                advanceDeduction
            )
        );

    /*
     * Extra-work accumulation is cycle based.
     *
     * liveAttendanceBreakdown.extraHours is the total overtime
     * generated inside the payroll period. It is NOT the current
     * unpaid overtime balance after previous settlements.
     *
     * Subtract only overtime records for this payroll that have
     * already been closed as SETTLED or REJECTED. The remaining
     * value is the employee's current accumulation cycle.
     */
    const closedExtraWork =
        await getClosedExtraWorkForPayroll(
            payroll.employeeId,
            payroll.payrollId
        );

    const currentExtraHours =
        Math.max(
            0,
            roundMoney(
                liveAttendanceBreakdown.extraHours -
                closedExtraWork.closedHours
            )
        );

    /*
     * Find only the currently active accumulation record.
     *
     * A SETTLED/REJECTED record is historical and is never reused.
     * When the current balance becomes positive after a settlement,
     * a new ACCUMULATED record is created for the new cycle.
     */
    const currentAccumulatedExtraWork =
        await prisma.extraWork.findFirst({

            where: {

                employeeId:
                    Number(payroll.employeeId),

                payrollId:
                    Number(payroll.payrollId),

                status:
                    "ACCUMULATED",

                settlementId:
                    null
            },

            orderBy: {

                extraWorkId:
                    "desc"
            }
        });

    if (
        currentExtraHours > 0
    ) {

        if (
            currentAccumulatedExtraWork
        ) {

            /*
             * Update only the active cycle.
             * Historical SETTLED/REJECTED rows remain unchanged.
             */
            await prisma.extraWork.update({

                where: {

                    extraWorkId:
                        currentAccumulatedExtraWork.extraWorkId
                },

                data: {

                    extraHours:
                        currentExtraHours
                }
            });

        } else {

            /*
             * A previous cycle has already been settled/rejected,
             * so this is a new accumulation cycle.
             */
            await prisma.extraWork.create({

                data: {

                    employeeId:
                        payroll.employeeId,

                    payrollId:
                        payroll.payrollId,

                    extraHours:
                        currentExtraHours,

                    status:
                        "ACCUMULATED"
                }
            });
        }

    } else if (
        currentAccumulatedExtraWork &&
        decimalToNumber(
            currentAccumulatedExtraWork.extraHours
        ) !== 0
    ) {

        /*
         * No current overtime remains after closed historical
         * overtime is deducted. Keep the active record at zero
         * rather than carrying an old balance forward.
         */
        await prisma.extraWork.update({

            where: {

                extraWorkId:
                    currentAccumulatedExtraWork.extraWorkId
            },

            data: {

                extraHours:
                    0
            }
        });
    }

    /*
     * Current unsettled extra-work balance across the employee.
     * Only ACCUMULATED records with no settlement are included.
     */
    const accumulatedExtraWork =
        await getAccumulatedExtraWork(
            payroll.employeeId
        );

    return {

        ...payroll,

        status:
            "UNPAID",

        // Live attendance values for the payroll UI.
        totalWorkingHours:
            liveWorkingHours,

        regularWorkingHours:
            liveAttendanceBreakdown.regularWorkingHours,

        shortageHours:
            liveAttendanceBreakdown.shortageHours,

        shortageDeduction:
            liveAttendanceBreakdown.shortageDeduction,

        /*
         * Show only the current unpaid overtime cycle.
         * Previously this returned the full live payroll-period
         * overtime, which caused already-settled hours to appear again.
         */
        extraHours:
            currentExtraHours,

        // Regular salary is capped at expected hours.
        basicSalary:
            liveAttendanceBreakdown.regularSalary,

        shortageDeduction:
            liveShortageDeduction,

        advanceDeduction:
            roundMoney(
                advanceDeduction
            ),

        pendingAmount,

        /*
         * For the current payroll view,
         * netSalary represents the live amount
         * currently payable after advances.
         */
        netSalary:
            pendingAmount,

        // Extra hours remain separate from regular salary.
        accumulatedExtraHours:
            accumulatedExtraWork.totalHours,

        scheduledPaymentDate,

        advancePayments:
            liveAdvanceSummary.advances
    };
};

// ============================================================
// CREATE PAYROLL
// ============================================================

const createPayroll = async (
    data,
    companyId
) => {

    const {

        employeeId,

        payPeriodStart,

        payPeriodEnd,

        paymentDate,

        scheduledPaymentDate,

        totalWorkingHours,

        monthlyExpectedHours,

        baseSalary,

        salaryRatePerHour,

        advanceDeduction

    } = data;

    const employee =
        await getEmployeeById(
            employeeId,
            companyId
        );

    const periodStart =
        parseDate(
            payPeriodStart,
            "payPeriodStart"
        );

    const periodEnd =
        parseDate(
            payPeriodEnd,
            "payPeriodEnd"
        );

    if (
        periodStart >
        periodEnd
    ) {

        throw createServiceError(
            "Payroll period start date cannot be after end date"
        );
    }

    const existingOverlap =
        await findOverlappingPayroll(
            employee.employeeId,
            periodStart,
            periodEnd
        );

    if (
        existingOverlap
    ) {

        throw createServiceError(
            "A payroll already exists for this employee with an overlapping payroll period",
            409
        );
    }

    const employeeBaseSalary =
        decimalToNumber(
            baseSalary !== undefined &&
                baseSalary !== null
                ? baseSalary
                : employee.baseSalary
        );

    const employeeExpectedHours =
        decimalToNumber(
            monthlyExpectedHours !== undefined &&
                monthlyExpectedHours !== null
                ? monthlyExpectedHours
                : employee.monthlyExpectedHours
        );

    const employeeHourlyRate =
        decimalToNumber(
            salaryRatePerHour !== undefined &&
                salaryRatePerHour !== null
                ? salaryRatePerHour
                : calculateHourlyRate(
                    employeeBaseSalary,
                    employeeExpectedHours
                )
        );

    const workingHours =
        decimalToNumber(
            totalWorkingHours
        );

    // [NEW] Authoritative attendance breakdown.
    const attendanceBreakdown =
        calculateAttendanceBreakdown(
            workingHours,
            employeeExpectedHours,
            employeeHourlyRate
        );

    const earnedBasicSalary =
        attendanceBreakdown.regularSalary;

    /*
     * Current payroll deduction is calculated
     * from ALL paid advances in the payroll
     * period.
     */
    const liveAdvanceSummary =
        await getLiveAdvanceSummary(
            employee.employeeId,
            periodStart,
            periodEnd
        );

    const requestedAdvanceDeduction =
        advanceDeduction !== undefined &&
            advanceDeduction !== null
            ? decimalToNumber(
                advanceDeduction
            )
            : liveAdvanceSummary.totalAdvance;

    // Shortage deduction is applied before advance deduction.
    const finalShortageDeduction =
        Math.min(
            employeeBaseSalary,
            Math.max(
                0,
                roundMoney(
                    attendanceBreakdown.shortageDeduction
                )
            )
        );

    const amountAfterShortage =
        Math.max(
            0,
            roundMoney(
                employeeBaseSalary -
                finalShortageDeduction
            )
        );

    // Advance cannot exceed the amount remaining after shortage deduction.
    const finalAdvanceDeduction =
        Math.min(
            amountAfterShortage,
            Math.max(
                0,
                requestedAdvanceDeduction
            )
        );

    const netSalary =
        Math.max(
            0,
            roundMoney(
                amountAfterShortage -
                finalAdvanceDeduction
            )
        );

    let finalScheduledPaymentDate =
        null;

    if (
        scheduledPaymentDate
    ) {

        finalScheduledPaymentDate =
            parseDate(
                scheduledPaymentDate,
                "scheduledPaymentDate"
            );

    } else if (
        paymentDate
    ) {

        /*
         * Backward compatibility:
         * older callers may still send paymentDate
         * as the scheduled payment date during
         * payroll generation.
         */
        finalScheduledPaymentDate =
            parseDate(
                paymentDate,
                "paymentDate"
            );

    } else {

        const configuration =
            await getPayrollConfiguration(
                employee.branchId,
                companyId
            );

        finalScheduledPaymentDate =
            getScheduledPaymentDateForPeriod(
                periodEnd,
                configuration
            );
    }

    // [CHANGED] Payroll and extra-work creation are atomic.
    const payroll =
        await prisma.$transaction(
            async (
                transaction
            ) => {

                const createdPayroll =
                    await transaction.payroll.create({

                        data: {

                            employeeId:
                                employee.employeeId,

                            payPeriodStart:
                                periodStart,

                            payPeriodEnd:
                                periodEnd,

                            baseSalary:
                                employeeBaseSalary,

                            monthlyExpectedHours:
                                employeeExpectedHours,

                            salaryRatePerHour:
                                employeeHourlyRate,

                            totalWorkingHours:
                                workingHours,

                            basicSalary:
                                earnedBasicSalary,

                            // [NEW] Regular payable hours.
                            regularWorkingHours:
                                attendanceBreakdown.regularWorkingHours,

                            // [NEW] Shortage and deduction.
                            shortageHours:
                                attendanceBreakdown.shortageHours,

                            shortageDeduction:
                                attendanceBreakdown.shortageDeduction,

                            // [NEW] Extra work is tracked separately.
                            extraHours:
                                attendanceBreakdown.extraHours,

                            incentiveAmount:
                                0,

                            advanceDeduction:
                                finalAdvanceDeduction,

                            netSalary,

                            scheduledPaymentDate:
                                finalScheduledPaymentDate,

                            paymentDate:
                                null,

                            status:
                                "UNPAID"
                        },

                        include:
                            payrollInclude
                    });

                // [NEW] Never add extra hours to basicSalary.
                // Store every generated extra-work period separately.
                if (
                    attendanceBreakdown.extraHours > 0
                ) {

                    await transaction.extraWork.create({

                        data: {

                            employeeId:
                                employee.employeeId,

                            payrollId:
                                createdPayroll.payrollId,

                            extraHours:
                                attendanceBreakdown.extraHours,

                            status:
                                "ACCUMULATED"
                        }
                    });
                }

                return createdPayroll;
            }
        );

    return await decoratePayroll(
        payroll
    );
};


// ============================================================
// GENERATE PAYROLL FOR EMPLOYEE
// ============================================================

const generatePayrollForEmployee = async (
    employeeId,
    payPeriodStart,
    payPeriodEnd,
    companyId
) => {

    const employee =
        await getEmployeeById(
            employeeId,
            companyId
        );

    const periodStart =
        parseDate(
            payPeriodStart,
            "payPeriodStart"
        );

    const periodEnd =
        parseDate(
            payPeriodEnd,
            "payPeriodEnd"
        );

    const existing =
        await findOverlappingPayroll(
            employee.employeeId,
            periodStart,
            periodEnd
        );

    if (
        existing
    ) {

        return await decoratePayroll(
            await prisma.payroll.findUnique({

                where: {
                    payrollId:
                        existing.payrollId
                },

                include:
                    payrollInclude
            })
        );
    }

    /*
     * Attendance calculation.
     *
     * Use the actual Attendance model:
     * date + totalHours, with check-in/check-out
     * as a fallback.
     */
    const totalWorkingHours =
        await getAttendanceWorkingHoursForPeriod(
            employee.employeeId,
            periodStart,
            periodEnd
        );

    const baseSalary =
        decimalToNumber(
            employee.baseSalary
        );

    const monthlyExpectedHours =
        decimalToNumber(
            employee.monthlyExpectedHours
        );

    const salaryRatePerHour =
        calculateHourlyRate(
            baseSalary,
            monthlyExpectedHours
        );

    // [CHANGED] createPayroll performs the authoritative breakdown.
    return await createPayroll({

        employeeId:
            employee.employeeId,

        payPeriodStart:
            periodStart,

        payPeriodEnd:
            periodEnd,

        totalWorkingHours,

        monthlyExpectedHours,

        baseSalary,

                salaryRatePerHour

    }, companyId);
};


// ============================================================
// GENERATE PAYROLL FOR BRANCH
// ============================================================


const generatePayrollForBranch = async (
    branchId,
    payPeriodStart,
    payPeriodEnd,
    companyId
) => {

    const branch =
        await getBranchById(
            branchId,
            companyId
        );


    const employees =
        await prisma.employee.findMany({

            where: {

                branchId:
                    branch.branchId,

                companyId:
                    Number(companyId),

                /*
                 * Keep payroll generation limited
                 * to active employees.
                 */
                status:
                    "ACTIVE"
            },

            orderBy: {

                employeeId:
                    "asc"
            }
        });


    /*
     * ========================================================
     * CHECK PAYROLLS THAT ALREADY EXIST
     * ========================================================
     *
     * We check this BEFORE generating payroll.
     *
     * This allows us to distinguish:
     *
     * 1. Newly generated payroll
     * 2. Payroll that already existed
     *
     * The existing payroll itself is NOT deleted or recreated.
     */

    const existingPayrolls =
        await prisma.payroll.findMany({

            where: {

                employeeId: {
                    in:
                        employees.map(
                            (employee) =>
                                employee.employeeId
                        )
                },

                payPeriodStart:
                    parseDate(
                        payPeriodStart,
                        "payPeriodStart"
                    ),

                payPeriodEnd:
                    parseDate(
                        payPeriodEnd,
                        "payPeriodEnd"
                    )
            },

            select: {

                payrollId:
                    true
            }
        });


    /*
     * Store existing payroll IDs in a Set
     * so that we can quickly identify whether
     * a returned payroll was already present
     * before this generation request.
     */

    const existingPayrollIds =
        new Set(
            existingPayrolls.map(
                (payroll) =>
                    payroll.payrollId
            )
        );


    const results =
        [];


    /*
     * ========================================================
     * GENERATE PAYROLL FOR EACH ACTIVE EMPLOYEE
     * ========================================================
     */

    for (
        const employee
        of employees
    ) {

        try {

            const result =
                await generatePayrollForEmployee(
                    employee.employeeId,
                    payPeriodStart,
                    payPeriodEnd,
                    companyId
                );


            results.push(
                result
            );


        } catch (
            error
        ) {

            /*
             * Do not stop the complete branch
             * payroll because one employee fails.
             */

            results.push({

                employeeId:
                    employee.employeeId,

                employeeName:
                    employee.name,

                success:
                    false,

                error:
                    error.message
            });
        }
    }


    /*
     * ========================================================
     * COUNT NEWLY GENERATED PAYROLLS
     * ========================================================
     *
     * If the payroll ID was NOT present before this request,
     * it means this request generated a new payroll.
     */

    const generatedCount =
        results.filter(
            (result) =>
                result?.payrollId &&
                !existingPayrollIds.has(
                    result.payrollId
                )
        ).length;


    /*
     * ========================================================
     * COUNT ALREADY GENERATED PAYROLLS
     * ========================================================
     *
     * If the payroll ID was already present before this request,
     * it means payroll had already been generated for that
     * employee and period.
     */

    const alreadyGeneratedCount =
        results.filter(
            (result) =>
                result?.payrollId &&
                existingPayrollIds.has(
                    result.payrollId
                )
        ).length;


    /*
     * ========================================================
     * GENERATION MESSAGE
     * ========================================================
     */

    let message =
        "Branch payroll generation completed";


    /*
     * If nothing new was generated and at least one
     * payroll already existed, show the requested message.
     */

    if (
        generatedCount === 0 &&
        alreadyGeneratedCount > 0
    ) {

        message =
            "Payroll is already generated for this period.";
    }


    /*
     * If at least one payroll was newly generated,
     * show the successful generation message.
     */

    else if (
        generatedCount > 0
    ) {

        message =
            "Payroll generated successfully.";
    }


    /*
     * ========================================================
     * RETURN RESULT
     * ========================================================
     */

    return {

        branchId:
            branch.branchId,

        branchName:
            branch.branchName,

        count:
            results.length,

        generatedCount,

        alreadyGeneratedCount,

        message,

        results
    };
};


// ============================================================
// GET ALL PAYROLL
// ============================================================

const getAllPayroll = async (
    companyId,
    filters = {}
) => {

    const where = {

        employee: {

            companyId:
                Number(companyId)
        }
    };

    if (
        filters.employeeId
    ) {

        where.employeeId =
            Number(
                filters.employeeId
            );
    }

    if (
        filters.branchId
    ) {

        where.employee = {

            ...where.employee,

            branchId:
                Number(
                    filters.branchId
                )
        };
    }

    if (
        filters.status
    ) {

        where.status =
            String(
                filters.status
            ).toUpperCase();
    }

    if (
        filters.startDate
    ) {

        where.payPeriodStart = {

            gte:
                startOfDay(
                    parseDate(
                        filters.startDate,
                        "startDate"
                    )
                )
        };
    }

    if (
        filters.endDate
    ) {

        where.payPeriodEnd = {

            lte:
                endOfDay(
                    parseDate(
                        filters.endDate,
                        "endDate"
                    )
                )
        };
    }

    const payrolls =
        await prisma.payroll.findMany({

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

    const decorated =
        [];

    for (
        const payroll
        of payrolls
    ) {

        decorated.push(
            await decoratePayroll(
                payroll
            )
        );
    }

    return decorated;
};


// ============================================================
// GET PAYROLL BY ID
// ============================================================

const getPayrollById = async (
    payrollId,
    companyId
) => {

    const payroll =
        await prisma.payroll.findFirst({

            where: {

                payrollId:
                    Number(payrollId),

                employee: {

                    companyId:
                        Number(companyId)
                }
            },

            include:
                payrollInclude
        });

    if (!payroll) {

        throw createServiceError(
            "Payroll not found",
            404
        );
    }

    return await decoratePayroll(
        payroll
    );
};


// ============================================================
// GET EMPLOYEE PAYROLL
// ============================================================

const getEmployeePayroll = async (
    employeeId,
    companyId
) => {

    await getEmployeeById(
        employeeId,
        companyId
    );

    const payrolls =
        await prisma.payroll.findMany({

            where: {

                employeeId:
                    Number(employeeId),

                employee: {

                    companyId:
                        Number(companyId)
                }
            },

            include:
                payrollInclude,

            orderBy: {

                payPeriodStart:
                    "desc"
            }
        });

    const decorated =
        [];

    for (
        const payroll
        of payrolls
    ) {

        decorated.push(
            await decoratePayroll(
                payroll
            )
        );
    }

    return decorated;
};


// ============================================================
// GET MY PAYROLL
// ============================================================

const getMyPayroll = async (
    employeeId,
    companyId
) => {

    const id =
        Number(employeeId);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {

        throw createServiceError(
            "Invalid employee ID",
            400
        );
    }

    // Verify that the employee belongs to the authenticated company.
    await getEmployeeById(
        id,
        companyId
    );

    // Employee payroll contains salary/payroll information only.
    // Extra-work/bonus information is handled by the separate Bonus module.
    return await getEmployeePayroll(
        id,
        companyId
    );
};


// ============================================================
// UPDATE PAYROLL
// ============================================================

const updatePayroll = async (
    payrollId,
    data,
    companyId
) => {

    const existing =
        await prisma.payroll.findFirst({

            where: {

                payrollId:
                    Number(payrollId),

                employee: {

                    companyId:
                        Number(companyId)
                }
            },

            include:
                payrollInclude
        });

    if (!existing) {

        throw createServiceError(
            "Payroll not found",
            404
        );
    }

    const existingStatus =
        existing.status ||
        (
            existing.paymentDate
                ? "PAID"
                : "UNPAID"
        );

    if (
        existingStatus === "PAID"
    ) {

        throw createServiceError(
            "Paid payroll cannot be modified",
            409
        );
    }

    const updateData =
        {};

    if (
        data.payPeriodStart !==
        undefined
    ) {

        updateData.payPeriodStart =
            parseDate(
                data.payPeriodStart,
                "payPeriodStart"
            );
    }

    if (
        data.payPeriodEnd !==
        undefined
    ) {

        updateData.payPeriodEnd =
            parseDate(
                data.payPeriodEnd,
                "payPeriodEnd"
            );
    }

    if (
        updateData.payPeriodStart &&
        updateData.payPeriodEnd &&
        updateData.payPeriodStart >
        updateData.payPeriodEnd
    ) {

        throw createServiceError(
            "Payroll period start date cannot be after end date"
        );
    }

    const finalStart =
        updateData.payPeriodStart ||
        existing.payPeriodStart;

    const finalEnd =
        updateData.payPeriodEnd ||
        existing.payPeriodEnd;

    if (
        updateData.payPeriodStart ||
        updateData.payPeriodEnd
    ) {

        const overlapping =
            await findOverlappingPayroll(
                existing.employeeId,
                finalStart,
                finalEnd,
                existing.payrollId
            );

        if (
            overlapping
        ) {

            throw createServiceError(
                "The updated payroll period overlaps another payroll for this employee",
                409
            );
        }
    }

    if (
        data.baseSalary !==
        undefined
    ) {

        updateData.baseSalary =
            validateNonNegativeNumber(
                data.baseSalary,
                "baseSalary"
            );
    }

    if (
        data.monthlyExpectedHours !==
        undefined
    ) {

        updateData.monthlyExpectedHours =
            validatePositiveNumber(
                data.monthlyExpectedHours,
                "monthlyExpectedHours"
            );
    }

    if (
        data.salaryRatePerHour !==
        undefined
    ) {

        updateData.salaryRatePerHour =
            validateNonNegativeNumber(
                data.salaryRatePerHour,
                "salaryRatePerHour"
            );
    }

    if (
        data.totalWorkingHours !==
        undefined
    ) {

        updateData.totalWorkingHours =
            validateNonNegativeNumber(
                data.totalWorkingHours,
                "totalWorkingHours"
            );
    }

    if (
        data.basicSalary !==
        undefined
    ) {

        updateData.basicSalary =
            validateNonNegativeNumber(
                data.basicSalary,
                "basicSalary"
            );
    }

    /*
     * Do not allow normal update calls to
     * set paymentDate or PAID status.
     *
     * Payment must go through markPayrollPaid().
     */
    if (
        data.status !==
        undefined
    ) {

        const requestedStatus =
            String(
                data.status
            ).toUpperCase();

        if (
            requestedStatus ===
            "PAID"
        ) {

            throw createServiceError(
                "Use the payroll payment action to mark payroll as paid",
                400
            );
        }

        if (
            requestedStatus !==
            "UNPAID"
        ) {

            throw createServiceError(
                "Invalid payroll status",
                400
            );
        }

        updateData.status =
            "UNPAID";
    }

    if (
        data.scheduledPaymentDate !==
        undefined
    ) {

        updateData.scheduledPaymentDate =
            data.scheduledPaymentDate ===
                null
                ? null
                : parseDate(
                    data.scheduledPaymentDate,
                    "scheduledPaymentDate"
                );
    }

    // [NEW] Recalculate all attendance-derived fields when an unpaid
    // payroll's working hours/salary configuration is manually changed.
    if (
        data.totalWorkingHours !== undefined ||
        data.monthlyExpectedHours !== undefined ||
        data.salaryRatePerHour !== undefined ||
        data.baseSalary !== undefined
    ) {

        const finalWorkingHours =
            data.totalWorkingHours !== undefined
                ? validateNonNegativeNumber(
                    data.totalWorkingHours,
                    "totalWorkingHours"
                )
                : decimalToNumber(
                    existing.totalWorkingHours
                );

        const finalExpectedHours =
            data.monthlyExpectedHours !== undefined
                ? validatePositiveNumber(
                    data.monthlyExpectedHours,
                    "monthlyExpectedHours"
                )
                : decimalToNumber(
                    existing.monthlyExpectedHours
                );

        const finalBaseSalary =
            data.baseSalary !== undefined
                ? validateNonNegativeNumber(
                    data.baseSalary,
                    "baseSalary"
                )
                : decimalToNumber(
                    existing.baseSalary
                );

        const finalHourlyRate =
            data.salaryRatePerHour !== undefined
                ? validateNonNegativeNumber(
                    data.salaryRatePerHour,
                    "salaryRatePerHour"
                )
                : decimalToNumber(
                    existing.salaryRatePerHour
                ) || calculateHourlyRate(
                    finalBaseSalary,
                    finalExpectedHours
                );

        const breakdown =
            calculateAttendanceBreakdown(
                finalWorkingHours,
                finalExpectedHours,
                finalHourlyRate
            );

        updateData.basicSalary =
            breakdown.regularSalary;

        updateData.regularWorkingHours =
            breakdown.regularWorkingHours;

        updateData.shortageHours =
            breakdown.shortageHours;

        updateData.shortageDeduction =
            breakdown.shortageDeduction;

        updateData.extraHours =
            breakdown.extraHours;
    }

    const updated =
        await prisma.payroll.update({

            where: {

                payrollId:
                    Number(payrollId)
            },

            data:
                updateData,

            include:
                payrollInclude
        });

    return await decoratePayroll(
        updated
    );
};


// ============================================================
// DELETE PAYROLL
// ============================================================

const deletePayroll = async (
    payrollId,
    companyId
) => {

    const existing =
        await prisma.payroll.findFirst({

            where: {

                payrollId:
                    Number(payrollId),

                employee: {

                    companyId:
                        Number(companyId)
                }
            }
        });

    if (!existing) {

        throw createServiceError(
            "Payroll not found",
            404
        );
    }

    const status =
        existing.status ||
        (
            existing.paymentDate
                ? "PAID"
                : "UNPAID"
        );

    if (
        status === "PAID"
    ) {

        throw createServiceError(
            "Paid payroll cannot be deleted",
            409
        );
    }

    // [NEW] Preserve extra-work history. A payroll linked to an
    // extra-work record cannot be deleted.
    const linkedExtraWork =
        await prisma.extraWork.findFirst({

            where: {

                payrollId:
                    Number(payrollId)
            }
        });

    if (linkedExtraWork) {

        throw createServiceError(
            "Payroll with extra-work records cannot be deleted because extra-work history must be preserved",
            409
        );
    }

    return await prisma.payroll.delete({

        where: {

            payrollId:
                Number(payrollId)
        }
    });
};


// ============================================================
// MARK PAYROLL PAID
// ============================================================
//
// This operation handles NORMAL SALARY ONLY.
//
// Overtime / variable payment is handled by the separate Bonus module.
// ============================================================

const markPayrollPaid = async (
    payrollId,
    companyId
) => {

    const payroll =
        await prisma.payroll.findFirst({

            where: {

                payrollId:
                    Number(payrollId),

                employee: {

                    companyId:
                        Number(companyId)
                }
            },

            include:
                payrollInclude
        });

    if (!payroll) {

        throw createServiceError(
            "Payroll not found",
            404
        );
    }

    const currentStatus =
        payroll.status ||
        (
            payroll.paymentDate
                ? "PAID"
                : "UNPAID"
        );

    if (
        currentStatus ===
        "PAID"
    ) {

        throw createServiceError(
            "Payroll has already been paid",
            409
        );
    }

    const scheduledPaymentDate =
        await getScheduledPaymentDate(
            payroll
        );

    const today =
        startOfDay(
            new Date()
        );

    if (
        scheduledPaymentDate &&
        today <
        scheduledPaymentDate
    ) {

        throw createServiceError(

            `Payroll cannot be paid before the scheduled payment date (${scheduledPaymentDate.toISOString().slice(0, 10)})`,

            400
        );
    }

    const actualPaymentDate =
        startOfDay(
            new Date()
        );

    const updated =
        await prisma.$transaction(
            async (
                transaction
            ) => {

                // Re-read inside the transaction to prevent
                // duplicate normal salary payments.
                const current =
                    await transaction.payroll.findUnique({

                        where: {

                            payrollId:
                                Number(payrollId)
                        }
                    });

                if (!current) {

                    throw createServiceError(
                        "Payroll not found",
                        404
                    );
                }

                const status =
                    current.status ||
                    (
                        current.paymentDate
                            ? "PAID"
                            : "UNPAID"
                    );

                if (
                    status ===
                    "PAID"
                ) {

                    throw createServiceError(
                        "Payroll has already been paid",
                        409
                    );
                }

                // Regular salary comes only from basicSalary.
                const salaryAmount =
                    decimalToNumber(
                        current.basicSalary
                    );

                // Re-read the actual paid advances INSIDE the same
                // transaction used to finalize payroll.
                const advancesForPayment =
                    await transaction.advancePayment.findMany({

                        where: {

                            employeeId:
                                current.employeeId,

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
                                    current.payPeriodStart,
                                lte:
                                    current.payPeriodEnd
                            }
                        },

                        orderBy: {

                            paymentDate:
                                "asc"
                        }
                    });

                const totalAdvance =
                    roundMoney(
                        advancesForPayment.reduce(
                            (total, advance) =>
                                total +
                                decimalToNumber(
                                    advance.paidAmount
                                ),
                            0
                        )
                    );

                if (
                    totalAdvance >
                    salaryAmount
                ) {

                    throw createServiceError(

                        `Advance deduction (₹${totalAdvance.toFixed(2)}) cannot exceed salary (₹${salaryAmount.toFixed(2)})`,

                        400
                    );
                }

                const finalAdvanceDeduction =
                    totalAdvance;

                const finalNetSalary =
                    Math.max(
                        0,
                        roundMoney(
                            salaryAmount -
                            finalAdvanceDeduction
                        )
                    );

                const paidPayroll =
                    await transaction.payroll.update({

                        where: {

                            payrollId:
                                Number(payrollId)
                        },

                        data: {

                            status:
                                "PAID",

                            advanceDeduction:
                                finalAdvanceDeduction,

                            /*
                             * Normal payroll payment does not contain
                             * variable/overtime incentive anymore.
                             */
                            incentiveAmount:
                                0,

                            netSalary:
                                finalNetSalary,

                            paymentDate:
                                actualPaymentDate,

                            scheduledPaymentDate:
                                scheduledPaymentDate
                        },

                        include:
                            payrollInclude
                    });


                // Once the payroll is actually PAID, the advances
                // deducted by this payroll are considered recovered.
                // This is what releases the employee's future advance
                // eligibility.
                if (
                    advancesForPayment.length > 0
                ) {

                    await transaction.advancePayment.updateMany({

                        where: {

                            advanceId: {
                                in:
                                    advancesForPayment.map(
                                        (advance) =>
                                            advance.advanceId
                                    )
                            },

                            status:
                                "PAID",

                            deductedAt:
                                null
                        },

                        data: {

                            // Link every recovered advance to the payroll
                            // that actually recovered it. The relation is
                            // one payroll -> many advances.
                            deductedInPayrollId:
                                Number(
                                    current.payrollId
                                ),

                            deductedAt:
                                actualPaymentDate
                        }
                    });
                }


                return paidPayroll;
            }
        );

    return await decoratePayroll(
        updated
    );
};

// GET CURRENT PAYROLL PERIOD
// ============================================================

const getCurrentPayrollPeriod = async (
    configuration,
    referenceDate = new Date()
) => {

    const config =
        normalizePayrollConfiguration(
            configuration
        );

    const date =
        new Date(
            referenceDate
        );

    const currentYear =
        date.getFullYear();

    const currentMonth =
        date.getMonth();

    /*
     * First attempt:
     * current month as the period start month.
     */
    let period =
        buildPeriodFromStartMonth(
            currentYear,
            currentMonth,
            config
        );

    /*
     * If the current date is before the period
     * start, the applicable period started in
     * the previous month.
     */
    if (
        date <
        period.periodStart
    ) {

        let previousYear =
            currentYear;

        let previousMonth =
            currentMonth - 1;

        if (
            previousMonth < 0
        ) {

            previousMonth = 11;
            previousYear -= 1;
        }

        period =
            buildPeriodFromStartMonth(
                previousYear,
                previousMonth,
                config
            );
    }

    return {

        ...period,

        scheduledPaymentDate:
            getScheduledPaymentDateForPeriod(
                period.periodEnd,
                config
            ),

        configuration:
            config
    };
};

// ============================================================
// GET NEXT PAYROLL PERIOD
// ============================================================

const getNextPayrollPeriod = async (
    configuration,
    referenceDate = new Date()
) => {

    const config =
        normalizePayrollConfiguration(
            configuration
        );

    const currentPeriod =
        await getCurrentPayrollPeriod(
            config,
            referenceDate
        );

    if (
        !currentPeriod
    ) {
        return null;
    }

    /*
     * Determine the month in which the next
     * payroll period starts.
     *
     * currentPeriod.periodStart belongs to
     * the current payroll cycle's start month.
     */
    const currentStart =
        new Date(
            currentPeriod.periodStart
        );

    let nextYear =
        currentStart.getFullYear();

    let nextMonth =
        currentStart.getMonth() + 1;

    if (
        nextMonth > 11
    ) {

        nextMonth = 0;
        nextYear += 1;
    }

    const nextPeriod =
        buildPeriodFromStartMonth(
            nextYear,
            nextMonth,
            config
        );

    return {

        ...nextPeriod,

        scheduledPaymentDate:
            getScheduledPaymentDateForPeriod(
                nextPeriod.periodEnd,
                config
            ),

        configuration:
            config
    };
};


// ============================================================
// GET PAYROLL CONFIGURATION PUBLIC METHOD
// ============================================================

const getConfiguration = async (
    branchId,
    companyId
) => {

    return await getPayrollConfiguration(
        branchId,
        companyId
    );
};


// ============================================================
// UPDATE PAYROLL CONFIGURATION
// ============================================================

const updateConfiguration = async (
    branchId,
    companyId,
    data
) => {

    const current =
        await getPayrollConfiguration(
            branchId,
            companyId
        );

    const next = {

        startDay:
            data.startDay !== undefined
                ? validateInteger(
                    data.startDay,
                    "startDay"
                )
                : current.startDay,

        endDay:
            data.endDay !== undefined
                ? validateInteger(
                    data.endDay,
                    "endDay"
                )
                : current.endDay,

        paymentDay:
            data.paymentDay !== undefined
                ? validateInteger(
                    data.paymentDay,
                    "paymentDay"
                )
                : current.paymentDay,

        enabled:
            data.enabled !== undefined
                ? Boolean(
                    data.enabled
                )
                : current.enabled
    };

    if (
        next.startDay < 1 ||
        next.startDay > 31
    ) {

        throw createServiceError(
            "startDay must be between 1 and 31"
        );
    }

    if (
        next.endDay < 0 ||
        next.endDay > 31
    ) {

        throw createServiceError(
            "endDay must be between 0 and 31"
        );
    }

    if (
        next.paymentDay < 1 ||
        next.paymentDay > 31
    ) {

        throw createServiceError(
            "paymentDay must be between 1 and 31"
        );
    }

    return await savePayrollConfiguration(
        branchId,
        companyId,
        next
    );
};


// ============================================================
// GET CURRENT BRANCH PAYROLL
// ============================================================

const getCurrentBranchPayroll = async (
    branchId,
    companyId,
    referenceDate = new Date()
) => {

    const configuration =
        await getPayrollConfiguration(
            branchId,
            companyId
        );

    const period =
        await getCurrentPayrollPeriod(
            configuration,
            referenceDate
        );

    const payrolls =
        await prisma.payroll.findMany({

            where: {

                employee: {

                    companyId:
                        Number(companyId),

                    branchId:
                        Number(branchId)
                },

                payPeriodStart:
                    period.periodStart,

                payPeriodEnd:
                    period.periodEnd
            },

            include:
                payrollInclude,

            orderBy: {

                employeeId:
                    "asc"
            }
        });

    const result =
        [];

    for (
        const payroll
        of payrolls
    ) {

        result.push(
            await decoratePayroll(
                payroll
            )
        );
    }

    return {

        periodStart:
            period.periodStart,

        periodEnd:
            period.periodEnd,

        scheduledPaymentDate:
            period.scheduledPaymentDate,

        configuration,

        payrolls:
            result
    };
};


// ============================================================
// GENERATE CURRENT BRANCH PAYROLL
// ============================================================

const generateCurrentBranchPayroll = async (
    branchId,
    companyId,
    referenceDate = new Date()
) => {

    const configuration =
        await getPayrollConfiguration(
            branchId,
            companyId
        );

    if (
        !configuration.enabled
    ) {

        throw createServiceError(
            "Payroll is disabled for this branch",
            400
        );
    }

    const period =
        await getCurrentPayrollPeriod(
            configuration,
            referenceDate
        );

    return await generatePayrollForBranch(
        branchId,
        period.periodStart,
        period.periodEnd,
        companyId
    );
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    createPayroll,

    generatePayrollForEmployee,

    generatePayrollForBranch,

    generateCurrentBranchPayroll,

    getAllPayroll,

    getPayrollById,

    getEmployeePayroll,

    getMyPayroll,

    updatePayroll,

    deletePayroll,

    markPayrollPaid,

    getCurrentPayrollPeriod,

    getNextPayrollPeriod,

    getCurrentBranchPayroll,

    getConfiguration,

    updateConfiguration,

    getPayrollConfiguration
};