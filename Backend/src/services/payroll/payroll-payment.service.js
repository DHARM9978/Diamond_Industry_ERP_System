const prisma = require("../../config/database");

const {
    normalizePayrollConfiguration,
    DEFAULT_PAYROLL_CONFIGURATION
} = require("./payroll-period.service");

const {
    decimalToNumber,
    roundMoney,
    getAttendanceWorkingHoursForPeriod,
    getPaidPublicHolidayHoursForPeriod,
    calculateHourlyRate,
    calculateAttendanceBreakdown
} = require("./payroll-calculation.service");

const {
    getOldestPaidUnusedAdvance,
    markAdvanceDeducted
} = require("./payroll-advance.service");


// ============================================================
// PAYROLL PAYMENT SERVICE
// ============================================================
//
// Responsibility:
//   - Validate a payroll payment request
//   - Enforce scheduled payment date
//   - Refresh live attendance/salary information before payment
//   - Recalculate paid public-holiday hours
//   - Recalculate normal salary
//   - Calculate the eligible advance deduction
//   - Finalize the Payroll row as PAID
//   - Link the advance recovered by that payroll
//
// This service handles NORMAL SALARY PAYMENT ONLY.
//
// Extra-work / overtime / incentive settlement is deliberately
// NOT performed here. That remains in payroll-extra-work.service.js.
//
// The current Prisma schema has:
//   AdvancePayment.deductedInPayrollId @unique
//
// Therefore one advance can be linked to one payroll through the
// current relation. The payment service therefore uses the oldest
// eligible paid advance for the payroll period, matching the
// current database relationship instead of silently changing the
// schema.
//
// This file does NOT modify the database schema.
// ============================================================


// ============================================================
// PAYROLL INCLUDE
// ============================================================

const payrollInclude = {

    employee: {

        include: {

            branch: {

                select: {

                    branchId:
                        true,

                    branchName:
                        true,

                    companyId:
                        true
                }
            }
        }
    },

    advanceDeductionRecord:
        true
};


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
// HELPER: Start Of Day
// ============================================================

const startOfDay = (
    value
) => {

    const date =
        value instanceof Date
            ? new Date(
                value.getTime()
            )
            : new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        throw createServiceError(
            "Invalid date",
            400
        );
    }

    date.setHours(
        0,
        0,
        0,
        0
    );

    return date;
};


// ============================================================
// HELPER: Get IST Calendar Date Key
// ============================================================

const getTodayISTCalendarKey = (
    referenceDate = new Date()
) =>
    getISTCalendarKey(
        referenceDate
    );



// ============================================================
// PAYROLL PAYMENT SCHEDULE HELPERS
// ============================================================
//
// Payment eligibility must use the actual current IST calendar date.
// This implementation deliberately calculates IST directly here
// instead of depending on another service's date helper.
//
// It also derives the effective payment date from:
//   payroll.payPeriodEnd + branch paymentDay
//
// This prevents legacy rows with stale scheduledPaymentDate values
// from blocking a payroll that is already due.
// ============================================================

const PAYROLL_CONFIG_KEY_PREFIX =
    "PAYROLL_CONFIG_BRANCH_";

const buildPayrollConfigKey = (
    branchId
) => (
    `${PAYROLL_CONFIG_KEY_PREFIX}${Number(branchId)}`
);

const getBranchPayrollConfiguration = async (
    branchId,
    companyId
) => {

    const numericBranchId =
        Number(branchId);

    const numericCompanyId =
        Number(companyId);

    if (
        !Number.isInteger(
            numericBranchId
        ) ||
        numericBranchId < 1 ||
        !Number.isInteger(
            numericCompanyId
        ) ||
        numericCompanyId < 1
    ) {

        return normalizePayrollConfiguration(
            DEFAULT_PAYROLL_CONFIGURATION
        );
    }

    const setting =
        await prisma.setting.findFirst({
            where: {
                companyId:
                    numericCompanyId,

                key:
                    buildPayrollConfigKey(
                        numericBranchId
                    )
            }
        });

    let configuration = null;

    if (
        setting?.value !== undefined &&
        setting?.value !== null
    ) {

        let value =
            setting.value;

        if (
            typeof value ===
            "string"
        ) {

            try {
                value =
                    JSON.parse(
                        value
                    );
            } catch {
                value =
                    null;
            }
        }

        if (
            value &&
            typeof value ===
            "object"
        ) {

            configuration =
                normalizePayrollConfiguration(
                    value
                );
        }
    }

    return (
        configuration ||
        normalizePayrollConfiguration(
            DEFAULT_PAYROLL_CONFIGURATION
        )
    );
};

const resolveEffectiveScheduledPaymentDate = (
    periodEnd,
    configuration
) => {

    const config =
        normalizePayrollConfiguration(
            configuration
        );

    return require("./payroll-period.service")
        .getScheduledPaymentDateForPeriod(
            periodEnd,
            config
        );
};

const getEffectiveScheduledPaymentDate = async (
    payroll,
    companyId
) => {

    const branchId =
        payroll?.employee?.branchId;

    if (branchId) {

        const configuration =
            await getBranchPayrollConfiguration(
                branchId,
                companyId
            );

        return resolveEffectiveScheduledPaymentDate(
            payroll.payPeriodEnd,
            configuration
        );
    }

    if (
        payroll?.scheduledPaymentDate
    ) {

        return new Date(
            payroll.scheduledPaymentDate
        );
    }

    return null;
};

const getISTCalendarKey = (
    referenceDate = new Date()
) => {

    const date =
        referenceDate instanceof Date
            ? new Date(
                referenceDate.getTime()
            )
            : new Date(
                referenceDate
            );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return null;
    }

    const formatter =
        new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone:
                    "Asia/Kolkata",
                year:
                    "numeric",
                month:
                    "2-digit",
                day:
                    "2-digit"
            }
        );

    const parts =
        formatter.formatToParts(
            date
        );

    const values = {};

    for (
        const part
        of parts
    ) {

        if (
            part.type !==
            "literal"
        ) {

            values[part.type] =
                part.value;
        }
    }

    if (
        !values.year ||
        !values.month ||
        !values.day
    ) {

        return null;
    }

    return (
        `${values.year}-${values.month}-${values.day}`
    );
};

const getTodayISTCalendarDate = (
    referenceDate = new Date()
) => {

    const calendarKey =
        getISTCalendarKey(
            referenceDate
        );

    if (
        !calendarKey
    ) {

        return null;
    }

    return new Date(
        `${calendarKey}T00:00:00.000Z`
    );
};



// ============================================================
// HELPER: Calendar Key
// ============================================================

const getCalendarKey = (
    value
) => {

    const date =
        value instanceof Date
            ? value
            : new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return null;
    }

    return [
        date.getUTCFullYear(),
        String(
            date.getUTCMonth() + 1
        ).padStart(
            2,
            "0"
        ),
        String(
            date.getUTCDate()
        ).padStart(
            2,
            "0"
        )
    ].join("-");
};


// ============================================================
// HELPER: Check Scheduled Payment Date
// ============================================================
//
// Payroll can be paid on the scheduled date or later.
// It cannot be paid before the scheduled date.
//
// If an old payroll record has no scheduledPaymentDate, payment
// is allowed because the legacy record does not contain enough
// information to enforce a schedule safely. The final coordinator
// will use the period service for newly generated payroll.
// ============================================================

const assertScheduledPaymentDateReached = (
    scheduledPaymentDate,
    referenceDate = new Date()
) => {

    if (
        !scheduledPaymentDate
    ) {

        return {
            allowed:
                true,

            scheduledPaymentDate:
                null,

            currentDate:
                getTodayISTCalendarKey(
                    referenceDate
                )
        };
    }

    const scheduledKey =
        getCalendarKey(
            scheduledPaymentDate
        );

    const todayKey =
        getTodayISTCalendarKey(
            referenceDate
        );

    if (
        !scheduledKey ||
        !todayKey
    ) {

        throw createServiceError(
            "Unable to validate the payroll scheduled payment date",
            400
        );
    }

    if (
        todayKey <
        scheduledKey
    ) {

        throw createServiceError(

            `Payroll cannot be paid before the scheduled payment date (${scheduledKey}). Current IST date is ${todayKey}.`,

            400
        );
    }

    return {

        allowed:
            true,

        scheduledPaymentDate:
            scheduledKey,

        currentDate:
            todayKey
    };
};


// ============================================================
// GET PAYROLL
// ============================================================

const getPayrollForPayment = async (
    payrollId,
    companyId
) => {

    const parsedPayrollId =
        Number(payrollId);

    const parsedCompanyId =
        Number(companyId);

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

    if (
        !Number.isInteger(
            parsedCompanyId
        ) ||
        parsedCompanyId < 1
    ) {

        throw createServiceError(
            "Invalid company ID",
            400
        );
    }

    const payroll =
        await prisma.payroll.findFirst({

            where: {

                payrollId:
                    parsedPayrollId,

                employee: {

                    companyId:
                        parsedCompanyId
                }
            },

            include:
                payrollInclude
        });

    if (
        !payroll
    ) {

        throw createServiceError(
            "Payroll not found",
            404
        );
    }

    return payroll;
};


// ============================================================
// GET PAYMENT ELIGIBILITY
// ============================================================
//
// This helper does not mutate the database.
// It is useful for controllers/UI before attempting payment.
// ============================================================

const getPaymentEligibility = async (
    payrollId,
    companyId
) => {

    const payroll =
        await getPayrollForPayment(
            payrollId,
            companyId
        );

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

        return {

            payable:
                false,

            reason:
                "Payroll has already been paid",

            status:
                "PAID",

            payroll
        };
    }

    const effectiveScheduledPaymentDate =
        await getEffectiveScheduledPaymentDate(
            payroll,
            companyId
        );

    const schedule =
        assertScheduledPaymentDateReached(
            effectiveScheduledPaymentDate
        );

    return {

        payable:
            true,

        reason:
            null,

        status:
            currentStatus,

        scheduledPaymentDate:
            schedule.scheduledPaymentDate,

        payroll
    };
};


// ============================================================
// REFRESH LIVE PAYMENT CALCULATION
// ============================================================
//
// Unpaid payroll is not treated as a frozen calculation.
// Attendance and salary inputs can change before the actual
// payment date.
//
// We therefore recalculate immediately before final payment.
// ============================================================

const calculateLivePaymentValues = async (
    payroll
) => {

    const liveWorkingHours =
        await getAttendanceWorkingHoursForPeriod(
            payroll.employeeId,
            payroll.payPeriodStart,
            payroll.payPeriodEnd
        );

    const liveEmployee =
        await prisma.employee.findUnique({

            where: {

                employeeId:
                    Number(
                        payroll.employeeId
                    )
            },

            select: {

                companyId:
                    true,

                baseSalary:
                    true,

                monthlyExpectedHours:
                    true,

                salaryRatePerHour:
                    true
            }
        });

    if (
        !liveEmployee
    ) {

        throw createServiceError(
            "Employee linked to payroll no longer exists",
            404
        );
    }

    const liveBaseSalary =
        decimalToNumber(
            liveEmployee.baseSalary
        ) ||
        decimalToNumber(
            payroll.baseSalary
        );

    const liveExpectedHours =
        decimalToNumber(
            liveEmployee.monthlyExpectedHours
        ) ||
        decimalToNumber(
            payroll.monthlyExpectedHours
        );

    const liveHourlyRate =
        decimalToNumber(
            liveEmployee.salaryRatePerHour
        ) ||
        decimalToNumber(
            payroll.salaryRatePerHour
        ) ||
        calculateHourlyRate(
            liveBaseSalary,
            liveExpectedHours
        );

    const livePaidHolidayHours =
        await getPaidPublicHolidayHoursForPeriod(
            payroll.employeeId,
            liveEmployee.companyId,
            payroll.payPeriodStart,
            payroll.payPeriodEnd
        );

    const liveAttendanceBreakdown =
        calculateAttendanceBreakdown(
            liveWorkingHours,
            liveExpectedHours,
            liveHourlyRate,
            livePaidHolidayHours
        );

    return {

        liveWorkingHours:
            roundMoney(
                liveWorkingHours
            ),

        liveBaseSalary:
            roundMoney(
                liveBaseSalary
            ),

        liveExpectedHours:
            roundMoney(
                liveExpectedHours
            ),

        liveHourlyRate:
            roundMoney(
                liveHourlyRate
            ),

        livePaidHolidayHours:
            roundMoney(
                livePaidHolidayHours
            ),

        liveAttendanceBreakdown
    };
};


// ============================================================
// FINALIZE PAYROLL PAYMENT
// ============================================================
//
// This is the main payment operation.
//
// Flow:
//
//   Find payroll
//       ↓
//   Check UNPAID
//       ↓
//   Check scheduled date
//       ↓
//   Refresh attendance / holidays / salary
//       ↓
//   Start transaction
//       ↓
//   Re-read payroll
//       ↓
//   Check again for PAID
//       ↓
//   Find oldest eligible paid advance
//       ↓
//   Validate advance <= salary
//       ↓
//   Update Payroll to PAID
//       ↓
//   Mark advance as deducted
//       ↓
//   Commit
//
// If any step inside the transaction fails, the payment update and
// advance deduction are rolled back together.
// ============================================================

const markPayrollPaid = async (
    payrollId,
    companyId
) => {

    const payroll =
        await getPayrollForPayment(
            payrollId,
            companyId
        );

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

    const effectiveScheduledPaymentDate =
        await getEffectiveScheduledPaymentDate(
            payroll,
            companyId
        );

    assertScheduledPaymentDateReached(
        effectiveScheduledPaymentDate
    );

    /*
     * Recalculate immediately before payment.
     *
     * ExtraWork settlement is intentionally NOT performed here.
     */
    const liveValues =
        await calculateLivePaymentValues(
            payroll
        );

    const salaryAmount =
        roundMoney(
            liveValues
                .liveAttendanceBreakdown
                .regularSalary
        );

    /*
     * The current schema allows one AdvancePayment to be linked
     * through deductedInPayrollId because that field is UNIQUE.
     *
     * Use the oldest eligible paid advance for this payroll.
     */
    const advance =
        await getOldestPaidUnusedAdvance(
            payroll.employeeId,
            payroll.payPeriodStart,
            payroll.payPeriodEnd
        );

    let advanceDeduction =
        0;

    if (
        advance
    ) {

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

        if (
            paidAmount >
            salaryAmount
        ) {

            throw createServiceError(

                `Advance deduction (₹${paidAmount.toFixed(2)}) cannot exceed salary (₹${salaryAmount.toFixed(2)})`,

                400
            );
        }

        advanceDeduction =
            roundMoney(
                paidAmount
            );
    }

    const finalNetSalary =
        Math.max(
            0,
            roundMoney(
                salaryAmount -
                advanceDeduction
            )
        );

    const actualPaymentDate =
        getTodayISTCalendarDate();

    const updated =
        await prisma.$transaction(

            async (
                transaction
            ) => {

                // ------------------------------------------------
                // Re-read inside transaction.
                // Prevent a second concurrent payment request.
                // ------------------------------------------------

                const current =
                    await transaction.payroll.findUnique({

                        where: {

                            payrollId:
                                Number(
                                    payrollId
                                )
                        }
                    });

                if (
                    !current
                ) {

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

                // ------------------------------------------------
                // Re-check the advance inside the transaction.
                // Another request may have deducted it after the
                // first read but before this transaction began.
                // ------------------------------------------------

                const transactionAdvance =
                    await getOldestPaidUnusedAdvance(
                        current.employeeId,
                        current.payPeriodStart,
                        current.payPeriodEnd,
                        transaction
                    );

                let transactionAdvanceDeduction =
                    0;

                if (
                    transactionAdvance
                ) {

                    const paidAmount =
                        decimalToNumber(
                            transactionAdvance.paidAmount
                        );

                    if (
                        !Number.isFinite(
                            paidAmount
                        ) ||
                        paidAmount <= 0
                    ) {

                        throw createServiceError(
                            `Paid advance ${transactionAdvance.advanceId} has an invalid paid amount`,
                            400
                        );
                    }

                    if (
                        paidAmount >
                        salaryAmount
                    ) {

                        throw createServiceError(

                            `Advance deduction (₹${paidAmount.toFixed(2)}) cannot exceed salary (₹${salaryAmount.toFixed(2)})`,

                            400
                        );
                    }

                    transactionAdvanceDeduction =
                        roundMoney(
                            paidAmount
                        );
                }

                const finalAdvanceDeduction =
                    transactionAdvanceDeduction;

                const finalNetSalary =
                    Math.max(
                        0,
                        roundMoney(
                            salaryAmount -
                            finalAdvanceDeduction
                        )
                    );

                // ------------------------------------------------
                // Finalize normal payroll.
                //
                // Incentive is deliberately zero because
                // variable/extra-work payment is handled by the
                // separate extra-work module.
                // ------------------------------------------------

                const paidPayroll =
                    await transaction.payroll.update({

                        where: {

                            payrollId:
                                Number(
                                    payrollId
                                )
                        },

                        data: {

                            totalWorkingHours:
                                liveValues
                                    .liveWorkingHours,

                            regularWorkingHours:
                                liveValues
                                    .liveAttendanceBreakdown
                                    .regularWorkingHours,

                            shortageHours:
                                liveValues
                                    .liveAttendanceBreakdown
                                    .shortageHours,

                            shortageDeduction:
                                liveValues
                                    .liveAttendanceBreakdown
                                    .shortageDeduction,

                            extraHours:
                                liveValues
                                    .liveAttendanceBreakdown
                                    .extraHours,

                            paidHolidayHours:
                                liveValues
                                    .liveAttendanceBreakdown
                                    .paidHolidayHours,

                            basicSalary:
                                liveValues
                                    .liveAttendanceBreakdown
                                    .regularSalary,

                            incentiveAmount:
                                0,

                            advanceDeduction:
                                finalAdvanceDeduction,

                            netSalary:
                                finalNetSalary,

                            status:
                                "PAID",

                            paymentDate:
                                actualPaymentDate,

                            scheduledPaymentDate:
                                effectiveScheduledPaymentDate
                        },

                        include:
                            payrollInclude
                    });

                // ------------------------------------------------
                // Mark the recovered advance as deducted.
                // ------------------------------------------------

                if (
                    transactionAdvance
                ) {

                    await markAdvanceDeducted(
                        transactionAdvance.advanceId,
                        current.payrollId,
                        transaction,
                        actualPaymentDate
                    );
                }

                return paidPayroll;
            }
        );

    return updated;
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

getPayrollForPayment,

    getPaymentEligibility,

    calculateLivePaymentValues,

    markPayrollPaid,

    resolveEffectiveScheduledPaymentDate,

    getEffectiveScheduledPaymentDate,

    getISTCalendarKey,

    assertScheduledPaymentDateReached
};