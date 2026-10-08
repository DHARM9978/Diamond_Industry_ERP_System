const prisma = require("../../config/database");


// ============================================================
// PAYROLL EXTRA-WORK SERVICE
// ============================================================
//
// Responsibility:
//   - Create ExtraWork accumulation records
//   - Read accumulated extra-work balance
//   - Read extra-work history
//   - Reject accumulated extra-work records
//   - Settle ALL current accumulated extra-work records
//   - Preserve settlement history
//   - Return employee-level accumulated summaries
//
// Business rule:
//
//   ExtraWork is an EMPLOYEE-LEVEL running balance.
//
//   Example:
//
//   Record 1 = 67.53 h
//   Record 2 = 19.54 h
//   Record 3 = 1.10 h
//   Record 4 = 1.10 h
//   -------------------
//   Balance  = 89.27 h
//
//   These records can belong to different payroll periods.
//
//   When admin settles:
//
//       ExtraWorkSettlement created
//              ↓
//       all current ACCUMULATED records become SETTLED
//              ↓
//       accumulated balance becomes 0
//
//   Historical ExtraWork records are NEVER deleted.
//   Historical settlements are NEVER deleted.
//
//   Future extra hours create a new accumulation cycle.
//
// This service does NOT:
//   - calculate attendance extra hours
//   - calculate normal salary
//   - pay normal payroll
//
// Those responsibilities live in payroll-calculation,
// payroll-generation, and payroll-payment services.
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
// HELPER: Round Money / Hours
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
// HELPER: Validate Positive Integer
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
// HELPER: Validate Non-Negative Number
// ============================================================

const validateNonNegativeNumber = (
    value,
    fieldName
) => {

    const numericValue =
        decimalToNumber(
            value
        );

    if (
        !Number.isFinite(
            numericValue
        ) ||
        numericValue < 0
    ) {

        throw createServiceError(
            `${fieldName} must be a valid non-negative number`,
            400
        );
    }

    return roundMoney(
        numericValue
    );
};


// ============================================================
// HELPER: IST CALENDAR DATE
// ============================================================
//
// The settlement date is stored as Prisma @db.Date.
//
// Build a UTC-midnight Date from the current IST calendar date so
// the stored business date does not shift backward because the
// server uses UTC internally.
// ============================================================

const getTodayISTCalendarDate = (
    referenceDate = new Date()
) => {

    const date =
        referenceDate instanceof Date
            ? referenceDate
            : new Date(
                referenceDate
            );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        throw createServiceError(
            "Invalid settlement date",
            400
        );
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

    const year =
        Number(
            parts.find(
                (part) =>
                    part.type ===
                    "year"
            )?.value
        );

    const month =
        Number(
            parts.find(
                (part) =>
                    part.type ===
                    "month"
            )?.value
        );

    const day =
        Number(
            parts.find(
                (part) =>
                    part.type ===
                    "day"
            )?.value
        );

    return new Date(
        Date.UTC(
            year,
            month - 1,
            day,
            0,
            0,
            0,
            0
        )
    );
};


// ============================================================
// HELPER: Employee Include
// ============================================================

const employeeInclude = {

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
};


// ============================================================
// HELPER: Get Employee
// ============================================================

const getEmployeeById = async (
    employeeId,
    companyId,
    client = prisma
) => {

    const id =
        parsePositiveInteger(
            employeeId,
            "employeeId"
        );

    const company =
        parsePositiveInteger(
            companyId,
            "companyId"
        );

    const employee =
        await client.employee.findFirst({

            where: {

                employeeId:
                    id,

                companyId:
                    company
            },

            include:
                employeeInclude
        });

    if (
        !employee
    ) {

        throw createServiceError(
            "Employee not found",
            404
        );
    }

    return employee;
};


// ============================================================
// HELPER: Verify Payroll Belongs To Employee
// ============================================================

const getPayrollForEmployee = async (
    payrollId,
    employeeId,
    companyId,
    client = prisma
) => {

    const id =
        parsePositiveInteger(
            payrollId,
            "payrollId"
        );

    const employee =
        parsePositiveInteger(
            employeeId,
            "employeeId"
        );

    const company =
        parsePositiveInteger(
            companyId,
            "companyId"
        );

    const payroll =
        await client.payroll.findFirst({

            where: {

                payrollId:
                    id,

                employeeId:
                    employee,

                employee: {

                    companyId:
                        company
                }
            },

            select: {

                payrollId:
                    true,

                employeeId:
                    true,

                payPeriodStart:
                    true,

                payPeriodEnd:
                    true
            }
        });

    if (
        !payroll
    ) {

        throw createServiceError(
            "Payroll not found for this employee",
            404
        );
    }

    return payroll;
};


// ============================================================
// CREATE ACCUMULATED EXTRA-WORK RECORD
// ============================================================
//
// Payroll generation can call this after calculating extraHours.
//
// Multiple ExtraWork records for the same payroll are allowed.
// No existing record is modified or merged.
// ============================================================

const createExtraWorkRecord = async (
    {
        employeeId,
        companyId,
        payrollId,
        extraHours
    },
    client = prisma
) => {

    const employee =
        await getEmployeeById(
            employeeId,
            companyId,
            client
        );

    const payroll =
        await getPayrollForEmployee(
            payrollId,
            employee.employeeId,
            companyId,
            client
        );

    const hours =
        validateNonNegativeNumber(
            extraHours,
            "extraHours"
        );

    if (
        hours <= 0
    ) {

        return null;
    }

    const record =
        await client.extraWork.create({

            data: {

                employeeId:
                    employee.employeeId,

                payrollId:
                    payroll.payrollId,

                extraHours:
                    hours,

                status:
                    "ACCUMULATED",

                settlementId:
                    null
            },

            include: {

                employee: {

                    include:
                        employeeInclude
                },

                payroll: {

                    select: {

                        payrollId:
                            true,

                        payPeriodStart:
                            true,

                        payPeriodEnd:
                            true
                    }
                }
            }
        });

    return record;
};


// ============================================================
// GET ACCUMULATED EXTRA-WORK RECORDS
// ============================================================
//
// Employee-level balance:
//
//   status = ACCUMULATED
//   settlementId = NULL
//
// Records from different payroll periods are intentionally mixed
// into the same employee-level accumulation balance.
// ============================================================

const getAccumulatedExtraWorkRecords = async (
    employeeId,
    companyId,
    client = prisma
) => {

    const employee =
        await getEmployeeById(
            employeeId,
            companyId,
            client
        );

    const records =
        await client.extraWork.findMany({

            where: {

                employeeId:
                    employee.employeeId,

                status:
                    "ACCUMULATED",

                settlementId:
                    null
            },

            include: {

                employee: {

                    include:
                        employeeInclude
                },

                payroll: {

                    select: {

                        payrollId:
                            true,

                        payPeriodStart:
                            true,

                        payPeriodEnd:
                            true,

                        monthlyExpectedHours:
                            true,

                        regularWorkingHours:
                            true
                    }
                },

                settlement:
                    true
            },

            orderBy: [

                {
                    createdAt:
                        "asc"
                },

                {
                    extraWorkId:
                        "asc"
                }
            ]
        });

    return records;
};


// ============================================================
// BUILD ACCUMULATED SUMMARY
// ============================================================

const buildAccumulatedSummary = (
    records
) => {

    let accumulatedExtraHours =
        0;

    for (
        const record
        of records
    ) {

        accumulatedExtraHours =
            roundMoney(
                accumulatedExtraHours +
                decimalToNumber(
                    record.extraHours
                )
            );
    }

    return {

        accumulatedExtraHours,

        accumulatedRecordCount:
            records.length
    };
};


// ============================================================
// GET EMPLOYEE ACCUMULATED BALANCE
// ============================================================

const getEmployeeAccumulatedExtraWork = async (
    employeeId,
    companyId,
    client = prisma
) => {

    const employee =
        await getEmployeeById(
            employeeId,
            companyId,
            client
        );

    const records =
        await getAccumulatedExtraWorkRecords(
            employee.employeeId,
            companyId,
            client
        );

    const summary =
        buildAccumulatedSummary(
            records
        );

    return {

        employee: {

            employeeId:
                employee.employeeId,

            firstName:
                employee.firstName,

            lastName:
                employee.lastName,

            email:
                employee.email
        },

        summary: {

            accumulatedExtraHours:
                summary.accumulatedExtraHours,

            accumulatedRecordCount:
                summary.accumulatedRecordCount
        },

        records
    };
};


// ============================================================
// GET COMPANY EXTRA-WORK RECORDS
// ============================================================
//
// Default status is ACCUMULATED because the admin dashboard
// normally works with currently payable/settleable extra work.
//
// Pass:
//   status = ACCUMULATED
//   status = SETTLED
//   status = REJECTED
//   status = ALL
// ============================================================

const getExtraWorkRecords = async (
    companyId,
    options = {},
    client = prisma
) => {

    const company =
        parsePositiveInteger(
            companyId,
            "companyId"
        );

    const requestedStatus =
        options.status
            ? String(
                options.status
            ).trim().toUpperCase()
            : "ACCUMULATED";

    const allowedStatuses = [
        "ACCUMULATED",
        "SETTLED",
        "REJECTED"
    ];

    const statusFilter =
        requestedStatus ===
        "ALL"
            ? undefined
            : (
                allowedStatuses.includes(
                    requestedStatus
                )
                    ? requestedStatus
                    : null
            );

    if (
        requestedStatus !==
        "ALL" &&
        !statusFilter
    ) {

        throw createServiceError(
            "Invalid extra-work status",
            400
        );
    }

    const where = {

        employee: {

            companyId:
                company
        },

        ...(statusFilter
            ? {
                status:
                    statusFilter
            }
            : {}),

        ...(options.employeeId
            ? {
                employeeId:
                    parsePositiveInteger(
                        options.employeeId,
                        "employeeId"
                    )
            }
            : {}),

        ...(options.payrollId
            ? {
                payrollId:
                    parsePositiveInteger(
                        options.payrollId,
                        "payrollId"
                    )
            }
            : {})
    };

    const records =
        await client.extraWork.findMany({

            where,

            include: {

                employee: {

                    include:
                        employeeInclude
                },

                payroll: {

                    select: {

                        payrollId:
                            true,

                        payPeriodStart:
                            true,

                        payPeriodEnd:
                            true,

                        monthlyExpectedHours:
                            true,

                        regularWorkingHours:
                            true
                    }
                },

                settlement:
                    true
            },

            orderBy: [

                {
                    createdAt:
                        "desc"
                },

                {
                    extraWorkId:
                        "desc"
                }
            ]
        });

    const formattedRecords =
        records.map(
            (
                record
            ) => {

                const regularWorkingHours =
                    record.payroll
                        ? decimalToNumber(
                            record.payroll
                                .regularWorkingHours
                        )
                        : 0;

                const extraHours =
                    decimalToNumber(
                        record.extraHours
                    );

                return {

                    extraWorkId:
                        record.extraWorkId,

                    employeeId:
                        record.employeeId,

                    employee:
                        record.employee,

                    payrollId:
                        record.payrollId,

                    payPeriodStart:
                        record.payroll
                            ? record.payroll
                                .payPeriodStart
                            : null,

                    payPeriodEnd:
                        record.payroll
                            ? record.payroll
                                .payPeriodEnd
                            : null,

                    expectedHours:
                        record.payroll
                            ? decimalToNumber(
                                record.payroll
                                    .monthlyExpectedHours
                            )
                            : 0,

                    regularWorkingHours,

                    extraHours,

                    totalWorkingHours:
                        roundMoney(
                            regularWorkingHours +
                            extraHours
                        ),

                    status:
                        record.status,

                    settlementId:
                        record.settlementId,

                    settlement:
                        record.settlement,

                    createdAt:
                        record.createdAt,

                    updatedAt:
                        record.updatedAt
                };
            }
        );

    return formattedRecords;
};


// ============================================================
// GET EMPLOYEE SUMMARIES
// ============================================================
//
// Returns one running accumulated balance per employee.
//
// This is the structure used by the admin extra-work dashboard.
//
// Employees are grouped by employeeId, NOT by payroll period.
// ============================================================

const getEmployeeAccumulatedSummaries = async (
    companyId,
    client = prisma
) => {

    const records =
        await getExtraWorkRecords(
            companyId,
            {
                status:
                    "ACCUMULATED"
            },
            client
        );

    const summaryMap =
        new Map();

    for (
        const record
        of records
    ) {

        const key =
            record.employeeId;

        if (
            !summaryMap.has(
                key
            )
        ) {

            summaryMap.set(
                key,
                {

                    employeeId:
                        key,

                    employee:
                        record.employee,

                    accumulatedExtraHours:
                        0,

                    accumulatedRecordCount:
                        0,

                    records:
                        []
                }
            );
        }

        const summary =
            summaryMap.get(
                key
            );

        summary.accumulatedExtraHours =
            roundMoney(
                summary.accumulatedExtraHours +
                record.extraHours
            );

        summary.accumulatedRecordCount +=
            1;

        summary.records.push(
            record
        );
    }

    return Array.from(
        summaryMap.values()
    );
};


// ============================================================
// REJECT EXTRA-WORK RECORD
// ============================================================
//
// Rejection closes only the selected record.
// It does NOT delete the record.
//
// Rejected records are excluded from the accumulated balance.
// ============================================================

const rejectExtraWork = async (
    extraWorkId,
    companyId,
    reason = null,
    client = prisma
) => {

    const recordId =
        parsePositiveInteger(
            extraWorkId,
            "extraWorkId"
        );

    const company =
        parsePositiveInteger(
            companyId,
            "companyId"
        );

    const existing =
        await client.extraWork.findFirst({

            where: {

                extraWorkId:
                    recordId,

                employee: {

                    companyId:
                        company
                }
            },

            include: {

                employee: {

                    include:
                        employeeInclude
                },

                payroll:
                    true
            }
        });

    if (
        !existing
    ) {

        throw createServiceError(
            "Extra-work record not found",
            404
        );
    }

    if (
        existing.status !==
        "ACCUMULATED"
    ) {

        throw createServiceError(
            "Only accumulated extra-work records can be rejected",
            409
        );
    }

    const rejected =
        await client.extraWork.update({

            where: {

                extraWorkId:
                    recordId
            },

            data: {

                status:
                    "REJECTED"
            },

            include: {

                employee: {

                    include:
                        employeeInclude
                },

                payroll:
                    true,

                settlement:
                    true
            }
        });

    return {

        extraWorkId:
            rejected.extraWorkId,

        employeeId:
            rejected.employeeId,

        payrollId:
            rejected.payrollId,

        extraHours:
            decimalToNumber(
                rejected.extraHours
            ),

        status:
            rejected.status,

        settlementId:
            rejected.settlementId,

        reason:
            reason
                ? String(reason).trim()
                : null,

        createdAt:
            rejected.createdAt,

        updatedAt:
            rejected.updatedAt
    };
};


// ============================================================
// SETTLE ALL ACCUMULATED EXTRA WORK
// ============================================================
//
// Employee-level settlement.
//
// IMPORTANT:
//
// All currently accumulated records are settled together:
//
//   employeeId = X
//   status = ACCUMULATED
//   settlementId = NULL
//
// The records can belong to many payroll periods.
//
// A single ExtraWorkSettlement is created.
//
// Every selected ExtraWork record is then marked SETTLED and
// receives the new settlementId.
//
// No ExtraWork row is deleted.
//
// After the transaction, the employee's accumulated balance is 0.
// ============================================================

const settleExtraWork = async (
    employeeId,
    companyId,
    incentiveAmount = 0,
    payrollId = null,
    client = prisma
) => {

    const employee =
        await getEmployeeById(
            employeeId,
            companyId,
            client
        );

    const requestedIncentiveAmount =
        validateNonNegativeNumber(
            incentiveAmount,
            "incentiveAmount"
        );

    let referencePayrollId =
        null;

    if (
        payrollId !== null &&
        payrollId !== undefined &&
        payrollId !== ""
    ) {

        const referencePayroll =
            await getPayrollForEmployee(
                payrollId,
                employee.employeeId,
                companyId,
                client
            );

        referencePayrollId =
            referencePayroll.payrollId;
    }

    const settlement =
        await client.$transaction(

            async (
                transaction
            ) => {

                const accumulatedExtraWork =
                    await transaction.extraWork.findMany({

                        where: {

                            employeeId:
                                employee.employeeId,

                            status:
                                "ACCUMULATED",

                            settlementId:
                                null
                        },

                        orderBy: [

                            {
                                createdAt:
                                    "asc"
                            },

                            {
                                extraWorkId:
                                    "asc"
                            }
                        ]
                    });

                const settledHours =
                    roundMoney(

                        accumulatedExtraWork.reduce(
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

                if (
                    settledHours <= 0
                ) {

                    throw createServiceError(
                        "There are no accumulated extra hours to settle",
                        400
                    );
                }

                const settlementDate =
                    getTodayISTCalendarDate();

                const createdSettlement =
                    await transaction
                        .extraWorkSettlement
                        .create({

                            data: {

                                employeeId:
                                    employee.employeeId,

                                payrollId:
                                    referencePayrollId,

                                settledHours,

                                incentiveAmount:
                                    requestedIncentiveAmount,

                                settlementDate
                            }
                        });

                const updateResult =
                    await transaction.extraWork.updateMany({

                        where: {

                            extraWorkId: {

                                in:
                                    accumulatedExtraWork.map(
                                        (
                                            record
                                        ) =>
                                            record.extraWorkId
                                    )
                            },

                            employeeId:
                                employee.employeeId,

                            status:
                                "ACCUMULATED",

                            settlementId:
                                null
                        },

                        data: {

                            status:
                                "SETTLED",

                            settlementId:
                                createdSettlement
                                    .settlementId
                        }
                    });

                if (
                    updateResult.count !==
                    accumulatedExtraWork.length
                ) {

                    throw createServiceError(
                        "Extra-work settlement could not close all accumulated records",
                        409
                    );
                }

                return createdSettlement;
            }
        );

    const result =
        await client.extraWorkSettlement.findUnique({

            where: {

                settlementId:
                    settlement.settlementId
            },

            include: {

                employee: {

                    include:
                        employeeInclude
                },

                payroll:
                    true,

                extraWorkRecords:
                    true
            }
        });

    if (
        !result
    ) {

        throw createServiceError(
            "Extra-work settlement could not be loaded after creation",
            500
        );
    }

    return {

        settlementId:
            result.settlementId,

        employeeId:
            result.employeeId,

        employee:
            result.employee,

        payrollId:
            result.payrollId,

        payPeriodStart:
            result.payroll
                ? result.payroll
                    .payPeriodStart
                : null,

        payPeriodEnd:
            result.payroll
                ? result.payroll
                    .payPeriodEnd
                : null,

        settledHours:
            decimalToNumber(
                result.settledHours
            ),

        incentiveAmount:
            decimalToNumber(
                result.incentiveAmount
            ),

        settlementDate:
            result.settlementDate,

        extraWorkRecords:
            result.extraWorkRecords,

        createdAt:
            result.createdAt,

        updatedAt:
            result.updatedAt
    };
};


// ============================================================
// GET SETTLEMENT HISTORY
// ============================================================

const getSettlementHistory = async (
    companyId,
    options = {},
    client = prisma
) => {

    const company =
        parsePositiveInteger(
            companyId,
            "companyId"
        );

    const settlements =
        await client.extraWorkSettlement.findMany({

            where: {

                employee: {

                    companyId:
                        company
                },

                ...(options.employeeId
                    ? {

                        employeeId:
                            parsePositiveInteger(
                                options.employeeId,
                                "employeeId"
                            )
                    }
                    : {}),

                ...(options.payrollId
                    ? {

                        payrollId:
                            parsePositiveInteger(
                                options.payrollId,
                                "payrollId"
                            )
                    }
                    : {})
            },

            include: {

                employee: {

                    include:
                        employeeInclude
                },

                payroll:
                    true,

                extraWorkRecords:
                    true
            },

            orderBy: [

                {
                    settlementDate:
                        "desc"
                },

                {
                    settlementId:
                        "desc"
                }
            ]
        });

    return settlements.map(
        (
            settlement
        ) => ({

            settlementId:
                settlement.settlementId,

            employeeId:
                settlement.employeeId,

            employee:
                settlement.employee,

            payrollId:
                settlement.payrollId,

            payPeriodStart:
                settlement.payroll
                    ? settlement.payroll
                        .payPeriodStart
                    : null,

            payPeriodEnd:
                settlement.payroll
                    ? settlement.payroll
                        .payPeriodEnd
                    : null,

            settledHours:
                decimalToNumber(
                    settlement.settledHours
                ),

            incentiveAmount:
                decimalToNumber(
                    settlement.incentiveAmount
                ),

            settlementDate:
                settlement.settlementDate,

            extraWorkRecords:
                settlement.extraWorkRecords,

            createdAt:
                settlement.createdAt,

            updatedAt:
                settlement.updatedAt
        })
    );
};


// ============================================================
// GET EMPLOYEE EXTRA-WORK / BONUS SUMMARY
// ============================================================
//
// Employee view:
//
//   - current accumulated extra hours
//   - number of accumulated records
//   - total settled hours
//   - total incentive paid
//   - all extra-work history
//   - settlement history
// ============================================================

const getEmployeeExtraWorkSummary = async (
    employeeId,
    companyId,
    client = prisma
) => {

    const employee =
        await getEmployeeById(
            employeeId,
            companyId,
            client
        );

    const extraWorkRecords =
        await client.extraWork.findMany({

            where: {

                employeeId:
                    employee.employeeId
            },

            include: {

                payroll: {

                    select: {

                        payrollId:
                            true,

                        payPeriodStart:
                            true,

                        payPeriodEnd:
                            true,

                        monthlyExpectedHours:
                            true,

                        regularWorkingHours:
                            true
                    }
                },

                settlement:
                    true
            },

            orderBy: [

                {
                    createdAt:
                        "desc"
                },

                {
                    extraWorkId:
                        "desc"
                }
            ]
        });

    const settlements =
        await client.extraWorkSettlement.findMany({

            where: {

                employeeId:
                    employee.employeeId
            },

            include: {

                payroll:
                    true,

                extraWorkRecords:
                    true
            },

            orderBy: [

                {
                    settlementDate:
                        "desc"
                },

                {
                    settlementId:
                        "desc"
                }
            ]
        });

    let accumulatedExtraHours =
        0;

    let totalSettledHours =
        0;

    let totalBonusPaid =
        0;

    for (
        const record
        of extraWorkRecords
    ) {

        if (
            record.status ===
            "ACCUMULATED" &&
            !record.settlementId
        ) {

            accumulatedExtraHours =
                roundMoney(
                    accumulatedExtraHours +
                    decimalToNumber(
                        record.extraHours
                    )
                );
        }
    }

    for (
        const settlement
        of settlements
    ) {

        totalSettledHours =
            roundMoney(
                totalSettledHours +
                decimalToNumber(
                    settlement.settledHours
                )
            );

        totalBonusPaid =
            roundMoney(
                totalBonusPaid +
                decimalToNumber(
                    settlement.incentiveAmount
                )
            );
    }

    return {

        employee: {

            employeeId:
                employee.employeeId,

            firstName:
                employee.firstName,

            lastName:
                employee.lastName,

            email:
                employee.email
        },

        summary: {

            accumulatedExtraHours,

            accumulatedRecordCount:
                extraWorkRecords.filter(
                    (record) =>
                        record.status ===
                        "ACCUMULATED" &&
                        !record.settlementId
                ).length,

            totalSettledHours,

            totalBonusPaid
        },

        extraWork:
            extraWorkRecords,

        settlements
    };
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    decimalToNumber,

    roundMoney,

    createExtraWorkRecord,

    getAccumulatedExtraWorkRecords,

    getEmployeeAccumulatedExtraWork,

    getExtraWorkRecords,

    getEmployeeAccumulatedSummaries,

    rejectExtraWork,

    settleExtraWork,

    getSettlementHistory,

    getEmployeeExtraWorkSummary
};