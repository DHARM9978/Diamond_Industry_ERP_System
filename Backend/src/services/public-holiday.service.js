const prisma =
    require("../config/database");


// ============================================================
// PAYROLL REFRESH
// ============================================================
//
// Public holiday changes can affect unpaid payroll attendance
// calculations and ExtraWork balances. Keep that logic inside
// payroll.service.js instead of duplicating it here.
// ============================================================

const {
    refreshPayrollsForPublicHolidayChange
} =
    require("./payroll.service");


// ============================================================
// HELPERS
// ============================================================


// ------------------------------------------------------------
// Service Error
// ------------------------------------------------------------

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


// ------------------------------------------------------------
// Parse Positive Integer
// ------------------------------------------------------------

const parsePositiveInteger = (
    value,
    fieldName
) => {

    const numberValue =
        Number(value);

    if (
        !Number.isInteger(
            numberValue
        ) ||
        numberValue < 1
    ) {

        throw createServiceError(
            `${fieldName} must be a valid positive integer`
        );
    }

    return numberValue;
};


// ------------------------------------------------------------
// Parse Date-Only Value
// ------------------------------------------------------------
//
// Public holidays are date-based, not time-based.
//
// Expected format:
// YYYY-MM-DD
//
// The date is stored at UTC midnight so that timezone conversion
// does not move the holiday to the previous/next calendar day.
// ------------------------------------------------------------

const parseDateOnly = (
    value,
    fieldName = "Date"
) => {

    if (
        value === undefined ||
        value === null ||
        String(value).trim() === ""
    ) {

        throw createServiceError(
            `${fieldName} is required`
        );
    }

    const dateString =
        String(value)
            .trim()
            .slice(0, 10);

    const dateOnlyPattern =
        /^\d{4}-\d{2}-\d{2}$/;

    if (
        !dateOnlyPattern.test(
            dateString
        )
    ) {

        throw createServiceError(
            `${fieldName} must be in YYYY-MM-DD format`
        );
    }

    const [
        year,
        month,
        day
    ] =
        dateString
            .split("-")
            .map(Number);

    const date =
        new Date(
            Date.UTC(
                year,
                month - 1,
                day
            )
        );

    if (
        Number.isNaN(
            date.getTime()
        ) ||
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {

        throw createServiceError(
            `${fieldName} must be a valid calendar date`
        );
    }

    return date;
};


// ------------------------------------------------------------
// Date To YYYY-MM-DD
// ------------------------------------------------------------

const formatDateOnly = (
    value
) => {

    if (
        !value
    ) {
        return null;
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return null;
    }

    return date
        .toISOString()
        .slice(0, 10);
};


// ------------------------------------------------------------
// Parse Optional Date
// ------------------------------------------------------------

const parseOptionalDate = (
    value,
    fieldName
) => {

    if (
        value === undefined ||
        value === null ||
        String(value).trim() === ""
    ) {
        return null;
    }

    return parseDateOnly(
        value,
        fieldName
    );
};


// ------------------------------------------------------------
// Decimal To Number
// ------------------------------------------------------------

const decimalToNumber = (
    value
) => {

    if (
        value === undefined ||
        value === null
    ) {
        return 0;
    }

    return Number(value);
};


// ------------------------------------------------------------
// Validate Daily Working Hours
// ------------------------------------------------------------

const parseDailyWorkingHours = (
    value
) => {

    const numberValue =
        Number(value);

    if (
        value === undefined ||
        value === null ||
        value === "" ||
        !Number.isFinite(
            numberValue
        )
    ) {

        throw createServiceError(
            "Daily working hours must be a valid number"
        );
    }

    if (
        numberValue < 0
    ) {

        throw createServiceError(
            "Daily working hours cannot be negative"
        );
    }

    if (
        numberValue > 24
    ) {

        throw createServiceError(
            "Daily working hours cannot exceed 24 hours"
        );
    }

    return Number(
        numberValue.toFixed(2)
    );
};


// ------------------------------------------------------------
// Validate Holiday Name
// ------------------------------------------------------------

const parseHolidayName = (
    value
) => {

    const holidayName =
        String(
            value ?? ""
        ).trim();

    if (
        !holidayName
    ) {

        throw createServiceError(
            "Holiday name is required"
        );
    }

    if (
        holidayName.length > 150
    ) {

        throw createServiceError(
            "Holiday name cannot exceed 150 characters"
        );
    }

    return holidayName;
};


// ------------------------------------------------------------
// Normalize Paid Value
// ------------------------------------------------------------

const parseIsPaid = (
    value,
    defaultValue = true
) => {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return defaultValue;
    }

    if (
        typeof value === "boolean"
    ) {
        return value;
    }

    if (
        typeof value === "number"
    ) {

        if (
            value === 1
        ) {
            return true;
        }

        if (
            value === 0
        ) {
            return false;
        }
    }

    const normalized =
        String(value)
            .trim()
            .toLowerCase();

    if (
        [
            "true",
            "1",
            "yes",
            "paid"
        ].includes(
            normalized
        )
    ) {
        return true;
    }

    if (
        [
            "false",
            "0",
            "no",
            "unpaid"
        ].includes(
            normalized
        )
    ) {
        return false;
    }

    throw createServiceError(
        "isPaid must be true or false"
    );
};


// ============================================================
// BRANCH
// ============================================================


// ------------------------------------------------------------
// Get Branch
// ------------------------------------------------------------
//
// Every public holiday must belong to a branch owned by the
// authenticated user's company.
// ------------------------------------------------------------

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
            },

            select: {

                branchId:
                    true,

                branchName:
                    true,

                location:
                    true,

                companyId:
                    true
            }
        });

    if (
        !branch
    ) {

        throw createServiceError(
            "Branch not found in your company",
            404
        );
    }

    return branch;
};


// ============================================================
// NORMALIZE RESPONSE
// ============================================================

const normalizeHoliday = (
    holiday
) => {

    if (
        !holiday
    ) {
        return null;
    }

    return {

        publicHolidayId:
            holiday.publicHolidayId,

        companyId:
            holiday.companyId,

        branchId:
            holiday.branchId,

        holidayDate:
            formatDateOnly(
                holiday.holidayDate
            ),

        holidayName:
            holiday.holidayName,

        dailyWorkingHours:
            decimalToNumber(
                holiday.dailyWorkingHours
            ),

        isPaid:
            Boolean(
                holiday.isPaid
            ),

        createdAt:
            holiday.createdAt,

        updatedAt:
            holiday.updatedAt,

        ...(holiday.branch
            ? {
                branch:
                    holiday.branch
            }
            : {})
    };
};


// ============================================================
// CREATE PUBLIC HOLIDAY
// ============================================================
//
// Creates ONE calendar date.
//
// If a holiday covers multiple dates, each date is intentionally
// stored as a separate record.
// ============================================================

const createPublicHoliday = async (
    data,
    companyId
) => {

    const {
        branchId,
        holidayDate,
        holidayName,
        dailyWorkingHours,
        isPaid
    } =
        data || {};


    const company =
        Number(companyId);


    if (
        !Number.isInteger(
            company
        ) ||
        company < 1
    ) {

        throw createServiceError(
            "Invalid company ID",
            400
        );
    }


    const branch =
        await getBranchById(
            branchId,
            company
        );


    const parsedDate =
        parseDateOnly(
            holidayDate,
            "Holiday date"
        );


    const parsedName =
        parseHolidayName(
            holidayName
        );


    const parsedHours =
        parseDailyWorkingHours(
            dailyWorkingHours
        );


    const parsedIsPaid =
        parseIsPaid(
            isPaid,
            true
        );


    // --------------------------------------------------------
    // Unpaid public holidays do not contribute working hours.
    //
    // We still allow dailyWorkingHours to be stored because the
    // admin may configure the normal branch day, but payroll will
    // only use the value when isPaid === true.
    // --------------------------------------------------------

    const existingHoliday =
        await prisma.publicHoliday.findFirst({

            where: {

                companyId:
                    company,

                branchId:
                    branch.branchId,

                holidayDate:
                    parsedDate
            }
        });


    if (
        existingHoliday
    ) {

        throw createServiceError(
            "A public holiday already exists for this branch and date",
            409
        );
    }


    try {

        const holiday =
            await prisma.publicHoliday.create({

                data: {

                    companyId:
                        company,

                    branchId:
                        branch.branchId,

                    holidayDate:
                        parsedDate,

                    holidayName:
                        parsedName,

                    dailyWorkingHours:
                        parsedHours,

                    isPaid:
                        parsedIsPaid
                },

                include: {

                    branch: {

                        select: {

                            branchId:
                                true,

                            branchName:
                                true,

                            location:
                                true,

                            companyId:
                                true
                        }
                    }
                }
            });


        if (
            parsedIsPaid
        ) {

            await refreshPayrollsForPublicHolidayChange(
                company,
                branch.branchId,
                parsedDate
            );
        }


        return normalizeHoliday(
            holiday
        );

    } catch (
        error
    ) {

        // Prisma unique constraint.
        if (
            error?.code === "P2002"
        ) {

            throw createServiceError(
                "A public holiday already exists for this branch and date",
                409
            );
        }

        throw error;
    }
};


// ============================================================
// GET ALL PUBLIC HOLIDAYS
// ============================================================
//
// Supported filters:
//
// year
// branchId
// fromDate
// toDate
// isPaid
//
// Example:
//
// getPublicHolidays(companyId, {
//     year: 2026,
//     branchId: 1
// });
// ============================================================

const getPublicHolidays = async (
    companyId,
    options = {}
) => {

    const company =
        Number(companyId);


    if (
        !Number.isInteger(
            company
        ) ||
        company < 1
    ) {

        throw createServiceError(
            "Invalid company ID",
            400
        );
    }


    const where = {

        companyId:
            company
    };


    // --------------------------------------------------------
    // Branch filter
    // --------------------------------------------------------

    if (
        options.branchId !== undefined &&
        options.branchId !== null &&
        options.branchId !== "" &&
        String(
            options.branchId
        ).toUpperCase() !== "ALL"
    ) {

        const branchId =
            parsePositiveInteger(
                options.branchId,
                "Branch ID"
            );


        await getBranchById(
            branchId,
            company
        );


        where.branchId =
            branchId;
    }


    // --------------------------------------------------------
    // Paid / unpaid filter
    // --------------------------------------------------------

    if (
        options.isPaid !== undefined &&
        options.isPaid !== null &&
        options.isPaid !== ""
    ) {

        where.isPaid =
            parseIsPaid(
                options.isPaid
            );
    }


    // --------------------------------------------------------
    // Date filters
    // --------------------------------------------------------

    let fromDate =
        parseOptionalDate(
            options.fromDate,
            "From date"
        );

    let toDate =
        parseOptionalDate(
            options.toDate,
            "To date"
        );


    // --------------------------------------------------------
    // Year filter
    // --------------------------------------------------------

    if (
        options.year !== undefined &&
        options.year !== null &&
        options.year !== ""
    ) {

        const year =
            Number(
                options.year
            );


        if (
            !Number.isInteger(
                year
            ) ||
            year < 2000 ||
            year > 2100
        ) {

            throw createServiceError(
                "Year must be between 2000 and 2100"
            );
        }


        const yearStart =
            new Date(
                Date.UTC(
                    year,
                    0,
                    1
                )
            );

        const yearEnd =
            new Date(
                Date.UTC(
                    year,
                    11,
                    31
                )
            );


        fromDate =
            fromDate
                ? (
                    fromDate > yearStart
                        ? fromDate
                        : yearStart
                )
                : yearStart;


        toDate =
            toDate
                ? (
                    toDate < yearEnd
                        ? toDate
                        : yearEnd
                )
                : yearEnd;
    }


    if (
        fromDate &&
        toDate &&
        fromDate > toDate
    ) {

        throw createServiceError(
            "From date cannot be after to date"
        );
    }


    if (
        fromDate ||
        toDate
    ) {

        where.holidayDate = {

            ...(fromDate
                ? {
                    gte:
                        fromDate
                }
                : {}),

            ...(toDate
                ? {
                    lte:
                        toDate
                }
                : {})
        };
    }


    const holidays =
        await prisma.publicHoliday.findMany({

            where,

            include: {

                branch: {

                    select: {

                        branchId:
                            true,

                        branchName:
                            true,

                        location:
                            true,

                        companyId:
                            true
                    }
                }
            },

            orderBy: [

                {
                    holidayDate:
                        "asc"
                },

                {
                    branchId:
                        "asc"
                },

                {
                    publicHolidayId:
                        "asc"
                }
            ]
        });


    return holidays.map(
        normalizeHoliday
    );
};


// ============================================================
// GET PUBLIC HOLIDAY BY ID
// ============================================================

const getPublicHolidayById = async (
    publicHolidayId,
    companyId
) => {

    const id =
        parsePositiveInteger(
            publicHolidayId,
            "Public holiday ID"
        );


    const company =
        Number(companyId);


    if (
        !Number.isInteger(
            company
        ) ||
        company < 1
    ) {

        throw createServiceError(
            "Invalid company ID",
            400
        );
    }


    const holiday =
        await prisma.publicHoliday.findFirst({

            where: {

                publicHolidayId:
                    id,

                companyId:
                    company
            },

            include: {

                branch: {

                    select: {

                        branchId:
                            true,

                        branchName:
                            true,

                        location:
                            true,

                        companyId:
                            true
                    }
                }
            }
        });


    if (
        !holiday
    ) {

        throw createServiceError(
            "Public holiday not found",
            404
        );
    }


    return normalizeHoliday(
        holiday
    );
};


// ============================================================
// UPDATE PUBLIC HOLIDAY
// ============================================================
//
// Admin can change:
//
// - branch
// - date
// - name
// - daily working hours
// - paid/unpaid
//
// Branch ownership is always checked against the company.
// ============================================================

const updatePublicHoliday = async (
    publicHolidayId,
    data,
    companyId
) => {

    const id =
        parsePositiveInteger(
            publicHolidayId,
            "Public holiday ID"
        );


    const company =
        Number(companyId);


    if (
        !Number.isInteger(
            company
        ) ||
        company < 1
    ) {

        throw createServiceError(
            "Invalid company ID",
            400
        );
    }


    const existingHoliday =
        await prisma.publicHoliday.findFirst({

            where: {

                publicHolidayId:
                    id,

                companyId:
                    company
            }
        });


    if (
        !existingHoliday
    ) {

        throw createServiceError(
            "Public holiday not found",
            404
        );
    }


    const updateData = {};


    // --------------------------------------------------------
    // Branch
    // --------------------------------------------------------

    let targetBranchId =
        existingHoliday.branchId;


    if (
        data &&
        data.branchId !== undefined &&
        data.branchId !== null &&
        data.branchId !== ""
    ) {

        targetBranchId =
            parsePositiveInteger(
                data.branchId,
                "Branch ID"
            );


        await getBranchById(
            targetBranchId,
            company
        );


        updateData.branchId =
            targetBranchId;
    }


    // --------------------------------------------------------
    // Date
    // --------------------------------------------------------

    let targetDate =
        existingHoliday.holidayDate;


    if (
        data &&
        data.holidayDate !== undefined &&
        data.holidayDate !== null &&
        data.holidayDate !== ""
    ) {

        targetDate =
            parseDateOnly(
                data.holidayDate,
                "Holiday date"
            );


        updateData.holidayDate =
            targetDate;
    }


    // --------------------------------------------------------
    // Name
    // --------------------------------------------------------

    if (
        data &&
        data.holidayName !== undefined
    ) {

        updateData.holidayName =
            parseHolidayName(
                data.holidayName
            );
    }


    // --------------------------------------------------------
    // Daily working hours
    // --------------------------------------------------------

    if (
        data &&
        data.dailyWorkingHours !== undefined
    ) {

        updateData.dailyWorkingHours =
            parseDailyWorkingHours(
                data.dailyWorkingHours
            );
    }


    // --------------------------------------------------------
    // Paid / unpaid
    // --------------------------------------------------------

    if (
        data &&
        data.isPaid !== undefined
    ) {

        updateData.isPaid =
            parseIsPaid(
                data.isPaid
            );
    }


    // --------------------------------------------------------
    // Check duplicate branch/date combination.
    //
    // This is especially important when an admin edits the
    // holiday date or moves it to another branch.
    // --------------------------------------------------------

    const duplicateHoliday =
        await prisma.publicHoliday.findFirst({

            where: {

                companyId:
                    company,

                branchId:
                    targetBranchId,

                holidayDate:
                    targetDate,

                publicHolidayId: {
                    not:
                        id
                }
            }
        });


    if (
        duplicateHoliday
    ) {

        throw createServiceError(
            "A public holiday already exists for this branch and date",
            409
        );
    }


    if (
        Object.keys(
            updateData
        ).length === 0
    ) {

        return await getPublicHolidayById(
            id,
            company
        );
    }


    try {

        const updatedHoliday =
            await prisma.publicHoliday.update({

                where: {

                    publicHolidayId:
                        id
                },

                data:
                    updateData,

                include: {

                    branch: {

                        select: {

                            branchId:
                                true,

                            branchName:
                                true,

                            location:
                                true,

                            companyId:
                                true
                        }
                    }
                }
            });


        const branchChanged =
            Number(
                existingHoliday.branchId
            ) !==
            Number(
                updatedHoliday.branchId
            );

        const dateChanged =
            formatDateOnly(
                existingHoliday.holidayDate
            ) !==
            formatDateOnly(
                updatedHoliday.holidayDate
            );

        const payrollRelevantChange =
            branchChanged ||
            dateChanged ||
            Boolean(
                existingHoliday.isPaid
            ) ||
            Boolean(
                updatedHoliday.isPaid
            );

        if (
            payrollRelevantChange
        ) {

            const refreshRequests = [];

            // Recalculate the old location/date so a moved,
            // un-paid, or deleted entitlement is removed.
            if (
                existingHoliday.isPaid
            ) {

                refreshRequests.push(
                    refreshPayrollsForPublicHolidayChange(
                        company,
                        existingHoliday.branchId,
                        existingHoliday.holidayDate
                    )
                );
            }

            // Recalculate the new location/date so a newly paid
            // entitlement or changed paid hours becomes effective.
            if (
                updatedHoliday.isPaid
            ) {

                const sameLocationAndDate =
                    Number(
                        existingHoliday.branchId
                    ) ===
                    Number(
                        updatedHoliday.branchId
                    ) &&
                    formatDateOnly(
                        existingHoliday.holidayDate
                    ) ===
                    formatDateOnly(
                        updatedHoliday.holidayDate
                    );

                if (
                    !sameLocationAndDate ||
                    !existingHoliday.isPaid
                ) {

                    refreshRequests.push(
                        refreshPayrollsForPublicHolidayChange(
                            company,
                            updatedHoliday.branchId,
                            updatedHoliday.holidayDate
                        )
                    );
                }
            }

            if (
                refreshRequests.length > 0
            ) {

                await Promise.all(
                    refreshRequests
                );
            }
        }


        return normalizeHoliday(
            updatedHoliday
        );

    } catch (
        error
    ) {

        if (
            error?.code === "P2002"
        ) {

            throw createServiceError(
                "A public holiday already exists for this branch and date",
                409
            );
        }

        throw error;
    }
};


// ============================================================
// DELETE PUBLIC HOLIDAY
// ============================================================

const deletePublicHoliday = async (
    publicHolidayId,
    companyId
) => {

    const id =
        parsePositiveInteger(
            publicHolidayId,
            "Public holiday ID"
        );


    const company =
        Number(companyId);


    if (
        !Number.isInteger(
            company
        ) ||
        company < 1
    ) {

        throw createServiceError(
            "Invalid company ID",
            400
        );
    }


    const existingHoliday =
        await prisma.publicHoliday.findFirst({

            where: {

                publicHolidayId:
                    id,

                companyId:
                    company
            }
        });


    if (
        !existingHoliday
    ) {

        throw createServiceError(
            "Public holiday not found",
            404
        );
    }


    await prisma.publicHoliday.delete({

        where: {

            publicHolidayId:
                id
        }
    });


    if (
        existingHoliday.isPaid
    ) {

        await refreshPayrollsForPublicHolidayChange(
            company,
            existingHoliday.branchId,
            existingHoliday.holidayDate
        );
    }


    return {

        publicHolidayId:
            id,

        deleted:
            true
    };
};


// ============================================================
// GET PUBLIC HOLIDAY CALENDAR
// ============================================================
//
// This is intended for calendar-style displays.
//
// Optional:
// - year
// - branchId
//
// The result contains one record per holiday date.
// ============================================================

const getPublicHolidayCalendar = async (
    companyId,
    options = {}
) => {

    return await getPublicHolidays(
        companyId,
        options
    );
};


// ============================================================
// CHECK PUBLIC HOLIDAY
// ============================================================
//
// Used by:
//
// - employee dashboard
// - payroll
// - future attendance/calendar logic
//
// Example:
//
// checkPublicHoliday(
//     "2026-10-02",
//     1,
//     1
// );
//
// Returns:
// {
//     isHoliday: true,
//     holiday: {...}
// }
// ============================================================

const checkPublicHoliday = async (
    date,
    branchId,
    companyId
) => {

    const company =
        Number(companyId);


    if (
        !Number.isInteger(
            company
        ) ||
        company < 1
    ) {

        throw createServiceError(
            "Invalid company ID",
            400
        );
    }


    const branch =
        await getBranchById(
            branchId,
            company
        );


    const parsedDate =
        parseDateOnly(
            date,
            "Date"
        );


    const holiday =
        await prisma.publicHoliday.findFirst({

            where: {

                companyId:
                    company,

                branchId:
                    branch.branchId,

                holidayDate:
                    parsedDate
            },

            include: {

                branch: {

                    select: {

                        branchId:
                            true,

                        branchName:
                            true,

                        location:
                            true,

                        companyId:
                            true
                    }
                }
            }
        });


    if (
        !holiday
    ) {

        return {

            isHoliday:
                false,

            date:
                formatDateOnly(
                    parsedDate
                ),

            holiday:
                null
        };
    }


    return {

        isHoliday:
            true,

        date:
            formatDateOnly(
                parsedDate
            ),

        holiday:
            normalizeHoliday(
                holiday
            )
    };
};


// ============================================================
// GET EMPLOYEE PUBLIC HOLIDAYS
// ============================================================
//
// Employees should only see holidays belonging to their own
// branch.
//
// No branchId is trusted directly from the frontend here.
// The branch is obtained from the employee record.
// ============================================================

const getEmployeePublicHolidays = async (
    employeeId,
    companyId,
    options = {}
) => {

    const employeeIdNumber =
        parsePositiveInteger(
            employeeId,
            "Employee ID"
        );


    const company =
        Number(companyId);


    if (
        !Number.isInteger(
            company
        ) ||
        company < 1
    ) {

        throw createServiceError(
            "Invalid company ID",
            400
        );
    }


    const employee =
        await prisma.employee.findFirst({

            where: {

                employeeId:
                    employeeIdNumber,

                companyId:
                    company
            },

            select: {

                employeeId:
                    true,

                branchId:
                    true
            }
        });


    if (
        !employee
    ) {

        throw createServiceError(
            "Employee not found",
            404
        );
    }


    if (
        !employee.branchId
    ) {

        throw createServiceError(
            "Employee is not assigned to a branch",
            400
        );
    }


    return await getPublicHolidays(
        company,
        {

            ...options,

            branchId:
                employee.branchId
        }
    );
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    createPublicHoliday,

    getPublicHolidays,

    getPublicHolidayById,

    updatePublicHoliday,

    deletePublicHoliday,

    getPublicHolidayCalendar,

    checkPublicHoliday,

    getEmployeePublicHolidays
};