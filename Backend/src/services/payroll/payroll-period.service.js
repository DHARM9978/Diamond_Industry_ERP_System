// ============================================================
// PAYROLL PERIOD SERVICE
// ============================================================
//
// Responsibility:
//   - Normalize payroll period configuration
//   - Resolve calendar-safe payroll period dates
//   - Resolve scheduled payment dates
//   - Determine the current payroll period
//   - Determine the next payroll period
//
// IMPORTANT:
//   This file is intentionally independent from payroll.service.js.
//   The existing payroll.service.js should NOT be modified yet.
//   The next step will connect this service to the existing payroll
//   service after this file has been verified.
//
// Payroll periods are business calendar dates. The Payroll Prisma
// model uses @db.Date for payPeriodStart/payPeriodEnd, so this
// service creates UTC-based calendar dates to prevent IST midnight
// from being stored as the previous database date.
// ============================================================

const PAYROLL_TIME_ZONE = "Asia/Kolkata";

const DEFAULT_PAYROLL_CONFIGURATION = {
    startDay: 1,
    endDay: 0, // 0 = last day of the month
    paymentDay: 5,
    enabled: true
};


// ============================================================
// HELPER: Create Service Error
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
// HELPER: Parse / Validate Reference Date
// ============================================================

const parseReferenceDate = (
    value,
    fieldName = "referenceDate"
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
// HELPER: Get Days In Month
// ============================================================

const getDaysInMonth = (
    year,
    month
) => {

    return new Date(
        Date.UTC(
            year,
            month + 1,
            0
        )
    ).getUTCDate();
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
// HELPER: Create UTC Calendar Start
// ============================================================
//
// 2026-10-01 means exactly 1 October 2026.
//
// Do NOT use new Date(year, month, day) here. That creates a
// server-local midnight. In IST that becomes 2026-09-30T18:30:00Z,
// which can be stored by Prisma/MySQL as 30 September for @db.Date.
//
// Using UTC calendar dates keeps the database date stable.
// ============================================================

const createCalendarStartUTC = (
    year,
    month,
    day
) => {

    return new Date(
        Date.UTC(
            year,
            month,
            day,
            0,
            0,
            0,
            0
        )
    );
};


// ============================================================
// HELPER: Create UTC Calendar End
// ============================================================

const createCalendarEndUTC = (
    year,
    month,
    day
) => {

    return new Date(
        Date.UTC(
            year,
            month,
            day,
            23,
            59,
            59,
            999
        )
    );
};


// ============================================================
// HELPER: Get Current IST Calendar Parts
// ============================================================

const getISTCalendarParts = (
    referenceDate = new Date()
) => {

    const date =
        parseReferenceDate(
            referenceDate
        );

    const parts =
        new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone:
                    PAYROLL_TIME_ZONE,
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }
        ).formatToParts(date);

    const result = {};

    for (
        const part
        of parts
    ) {

        if (
            part.type !== "literal"
        ) {

            result[part.type] =
                Number(part.value);
        }
    }

    if (
        !Number.isInteger(result.year) ||
        !Number.isInteger(result.month) ||
        !Number.isInteger(result.day)
    ) {

        throw createServiceError(
            "Unable to determine the current IST calendar date",
            500
        );
    }

    return {

        year:
            result.year,

        month:
            result.month - 1,

        day:
            result.day
    };
};


// ============================================================
// BUILD PERIOD FROM START MONTH
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

    // Example:
    // startDay = 26
    // endDay   = 25
    // result   = 26 Aug -> 25 Sep
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
        createCalendarStartUTC(
            year,
            month,
            startDay
        );

    const periodEnd =
        createCalendarEndUTC(
            endYear,
            endMonth,
            resolvedEndDay
        );

    return {

        periodStart,

        periodEnd
    };
};


// ============================================================
// SCHEDULED PAYMENT DATE
// ============================================================

const getScheduledPaymentDateForPeriod = (
    periodEnd,
    configuration
) => {

    const config =
        normalizePayrollConfiguration(
            configuration
        );

    const endDate =
        parseReferenceDate(
            periodEnd,
            "periodEnd"
        );

    const paymentDay =
        config.paymentDay;

    // periodEnd is a UTC calendar date, so use UTC parts here.
    let paymentYear =
        endDate.getUTCFullYear();

    let paymentMonth =
        endDate.getUTCMonth() + 1;

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

    return createCalendarStartUTC(
        paymentYear,
        paymentMonth,
        resolvedPaymentDay
    );
};


// ============================================================
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

    const calendar =
        getISTCalendarParts(
            referenceDate
        );

    const currentYear =
        calendar.year;

    const currentMonth =
        calendar.month;

    let period =
        buildPeriodFromStartMonth(
            currentYear,
            currentMonth,
            config
        );

    // Compare calendar dates, not server-local timestamps.
    const referenceCalendarStart =
        createCalendarStartUTC(
            currentYear,
            currentMonth,
            calendar.day
        );

    if (
        referenceCalendarStart <
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

    const currentStart =
        currentPeriod.periodStart;

    let nextYear =
        currentStart.getUTCFullYear();

    let nextMonth =
        currentStart.getUTCMonth() + 1;

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
// GET PREVIOUS PAYROLL PERIOD
// ============================================================
//
// Returns the payroll cycle immediately before the actual current
// payroll period.
//
// IMPORTANT:
//   This is NOT based on:
//      - the selected month in the UI
//      - the newest payroll record in the database
//      - subtracting 30 days from the current period
//
// It is calculated from the current payroll period's start month,
// which keeps custom payroll cycles safe.
//
// Example:
//   Current  = 01 Oct -> 31 Oct
//   Previous = 01 Sep -> 30 Sep
//
// Custom cycle example:
//   Current  = 26 Sep -> 25 Oct
//   Previous = 26 Aug -> 25 Sep
// ============================================================

const getPreviousPayrollPeriod = async (
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
        !currentPeriod ||
        !currentPeriod.periodStart
    ) {

        return null;
    }

    let previousYear =
        currentPeriod.periodStart.getUTCFullYear();

    let previousMonth =
        currentPeriod.periodStart.getUTCMonth() - 1;

    if (
        previousMonth < 0
    ) {

        previousMonth = 11;
        previousYear -= 1;
    }

    const previousPeriod =
        buildPeriodFromStartMonth(
            previousYear,
            previousMonth,
            config
        );

    return {

        ...previousPeriod,

        scheduledPaymentDate:
            getScheduledPaymentDateForPeriod(
                previousPeriod.periodEnd,
                config
            ),

        configuration:
            config
    };
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    PAYROLL_TIME_ZONE,

    DEFAULT_PAYROLL_CONFIGURATION,

    normalizePayrollConfiguration,

    getDaysInMonth,

    resolveDayOfMonth,

    buildPeriodFromStartMonth,

    getScheduledPaymentDateForPeriod,

    getCurrentPayrollPeriod,

    getPreviousPayrollPeriod,

    getNextPayrollPeriod,

    getISTCalendarParts
};