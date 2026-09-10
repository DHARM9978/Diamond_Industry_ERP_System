const prisma = require("../config/database");

const {
    ensureCompanyLeaveBalances
} = require("./leaveBalance.service");

const VALID_STATUSES = [
    "PENDING",
    "APPROVED",
    "REJECTED",
    "CANCELLED"
];


/**
 * Validate positive integer ID
 */
function validateId(value, fieldName) {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        const error = new Error(
            `Invalid ${fieldName}`
        );

        error.statusCode = 400;
        throw error;
    }

    return id;
}


/**
 * Validate year
 */
function validateYear(year) {
    const parsedYear = Number(year);

    if (
        !Number.isInteger(parsedYear) ||
        parsedYear < 2000 ||
        parsedYear > 2100
    ) {
        const error = new Error(
            "Invalid year"
        );

        error.statusCode = 400;
        throw error;
    }

    return parsedYear;
}


/**
 * Parse date safely
 *
 * Expected format:
 * YYYY-MM-DD
 */
function parseDate(value, fieldName) {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        const error = new Error(
            `${fieldName} must use YYYY-MM-DD format`
        );

        error.statusCode = 400;
        throw error;
    }

    const date = new Date(
        `${value}T00:00:00`
    );

    if (Number.isNaN(date.getTime())) {
        const error = new Error(
            `${fieldName} must be a valid date`
        );

        error.statusCode = 400;
        throw error;
    }

    return date;
}


/**
 * Get the calendar date portion from a Date.
 *
 * This keeps comparisons consistent when
 * Prisma returns Date objects.
 */
function normalizeDate(date) {
    const result = new Date(date);

    result.setHours(
        0,
        0,
        0,
        0
    );

    return result;
}


/**
 * Calculate inclusive leave days.
 *
 * Example:
 *
 * 2026-09-04 -> 2026-09-04 = 1
 * 2026-09-04 -> 2026-09-05 = 2
 */
function calculateTotalDays(
    startDate,
    endDate
) {
    const start =
        normalizeDate(startDate);

    const end =
        normalizeDate(endDate);

    return (
        (
            end.getTime() -
            start.getTime()
        ) /
        (1000 * 60 * 60 * 24)
    ) + 1;
}


/**
 * Check whether two date ranges overlap.
 */
function dateRangesOverlap(
    firstStart,
    firstEnd,
    secondStart,
    secondEnd
) {
    const firstStartDate =
        normalizeDate(firstStart);

    const firstEndDate =
        normalizeDate(firstEnd);

    const secondStartDate =
        normalizeDate(secondStart);

    const secondEndDate =
        normalizeDate(secondEnd);

    return (
        firstStartDate <= secondEndDate &&
        firstEndDate >= secondStartDate
    );
}


/**
 * Verify employee belongs to the company
 * and is active.
 */
async function verifyEmployee(
    employeeId,
    companyId,
    transactionClient = prisma
) {
    const employee =
        await transactionClient.employee.findFirst({
            where: {
                employeeId,
                companyId
            },

            select: {
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
                status: true
            }
        });

    if (!employee) {
        const error = new Error(
            "Employee not found in your company"
        );

        error.statusCode = 404;
        throw error;
    }

    if (employee.status !== "ACTIVE") {
        const error = new Error(
            "Employee is not active"
        );

        error.statusCode = 400;
        throw error;
    }

    return employee;
}


/**
 * Create Leave Request
 */
async function createLeaveRequest(
    companyId,
    employeeId,
    data
) {
    const company = validateId(
        companyId,
        "company ID"
    );

    const employee = validateId(
        employeeId,
        "employee ID"
    );

    if (
        !data ||
        typeof data !== "object"
    ) {
        const error = new Error(
            "Leave request data is required"
        );

        error.statusCode = 400;
        throw error;
    }


    const leaveTypeId = validateId(
        data.leaveTypeId,
        "leave type ID"
    );


    /**
     * Validate start date
     */
    if (!data.startDate) {
        const error = new Error(
            "startDate is required"
        );

        error.statusCode = 400;
        throw error;
    }


    /**
     * Validate end date
     */
    if (!data.endDate) {
        const error = new Error(
            "endDate is required"
        );

        error.statusCode = 400;
        throw error;
    }


    const startDate = parseDate(
        data.startDate,
        "startDate"
    );

    const endDate = parseDate(
        data.endDate,
        "endDate"
    );


    /**
     * End date cannot be before start date.
     */
    if (endDate < startDate) {
        const error = new Error(
            "endDate cannot be before startDate"
        );

        error.statusCode = 400;
        throw error;
    }


    /**
     * Calculate requested days.
     *
     * Backend calculates the value from
     * the requested date range.
     *
     * If totalDays is supplied, it is still
     * validated for compatibility.
     */
    const calculatedTotalDays =
        calculateTotalDays(
            startDate,
            endDate
        );

    const totalDays =
        data.totalDays !== undefined
            ? Number(data.totalDays)
            : calculatedTotalDays;


    if (
        !Number.isFinite(totalDays) ||
        totalDays <= 0
    ) {
        const error = new Error(
            "totalDays must be greater than zero"
        );

        error.statusCode = 400;
        throw error;
    }


    /**
     * Make sure the requested totalDays
     * is consistent with the selected dates
     * for normal full-day requests.
     */
    if (
        Number.isInteger(
            calculatedTotalDays
        ) &&
        Number.isInteger(totalDays) &&
        totalDays !== calculatedTotalDays
    ) {
        const error = new Error(
            "totalDays does not match the selected date range"
        );

        error.statusCode = 400;
        throw error;
    }


    /**
     * Verify employee.
     */
    await verifyEmployee(
        employee,
        company
    );


    /**
     * Verify leave type belongs
     * to the same company.
     */
    const leaveType =
        await prisma.leaveType.findFirst({
            where: {
                leaveTypeId,
                companyId: company
            }
        });


    if (!leaveType) {
        const error = new Error(
            "Leave type not found in your company"
        );

        error.statusCode = 404;
        throw error;
    }


    /**
     * Leave type must be active.
     */
    if (
        leaveType.status !== "ACTIVE"
    ) {
        const error = new Error(
            "Leave type is inactive"
        );

        error.statusCode = 400;
        throw error;
    }


    /**
     * Half-day validation.
     *
     * This keeps compatibility with the existing
     * allowHalfDay field.
     */
    if (
        totalDays % 1 !== 0 &&
        !leaveType.allowHalfDay
    ) {
        const error = new Error(
            "Half-day leave is not allowed for this leave type"
        );

        error.statusCode = 400;
        throw error;
    }


    /**
     * --------------------------------------------------------
     * CHECK OVERLAPPING LEAVE
     * --------------------------------------------------------
     *
     * PENDING:
     *     requested dates are used.
     *
     * APPROVED:
     *     approved dates are used when available.
     *
     * REJECTED / CANCELLED:
     *     do not block.
     *
     * This is important for partial approval.
     *
     * Example:
     *
     * Requested:
     * 10 Sep -> 13 Sep
     *
     * Approved:
     * 10 Sep -> 11 Sep
     *
     * Another request on:
     * 12 Sep -> 13 Sep
     *
     * should NOT conflict with the approved
     * portion of the previous request.
     */
    const existingRequests =
        await prisma.leaveRequest.findMany({
            where: {
                employeeId: employee,

                status: {
                    in: [
                        "PENDING",
                        "APPROVED"
                    ]
                }
            },

            select: {
                leaveRequestId: true,
                leaveTypeId: true,
                status: true,
                startDate: true,
                endDate: true,
                approvedStartDate: true,
                approvedEndDate: true
            }
        });


    const overlapping =
        existingRequests.find(
            (existing) => {

                const existingStart =
                    existing.status === "APPROVED" &&
                    existing.approvedStartDate
                        ? existing.approvedStartDate
                        : existing.startDate;

                const existingEnd =
                    existing.status === "APPROVED" &&
                    existing.approvedEndDate
                        ? existing.approvedEndDate
                        : existing.endDate;


                return dateRangesOverlap(
                    existingStart,
                    existingEnd,
                    startDate,
                    endDate
                );
            }
        );


    if (overlapping) {
        const error = new Error(
            "Leave dates overlap an existing leave request"
        );

        error.statusCode = 409;

        error.code =
            "LEAVE_DATE_OVERLAP";

        error.details = {
            conflictingLeaveRequestId:
                overlapping.leaveRequestId,

            status:
                overlapping.status,

            startDate:
                overlapping.startDate,

            endDate:
                overlapping.endDate,

            approvedStartDate:
                overlapping.approvedStartDate,

            approvedEndDate:
                overlapping.approvedEndDate,

            leaveTypeId:
                overlapping.leaveTypeId
        };

        throw error;
    }


    /**
     * Create the request.
     *
     * approvedStartDate,
     * approvedEndDate and
     * approvedDays remain NULL until
     * an admin approves the request.
     */
    return await prisma.leaveRequest.create({
        data: {
            employeeId: employee,

            leaveTypeId,

            startDate,

            endDate,

            totalDays,

            reason:
                typeof data.reason === "string"
                    ? data.reason.trim() || null
                    : null,

            status: "PENDING",

            approvedStartDate: null,

            approvedEndDate: null,

            approvedDays: null
        },

        include: {
            employee: {
                select: {
                    employeeId: true,
                    firstName: true,
                    lastName: true,
                    email: true
                }
            },

            leaveType: true
        }
    });
}


/**
 * Get Leave Requests
 */
async function getLeaveRequests(
    companyId,
    filters = {}
) {
    const company = validateId(
        companyId,
        "company ID"
    );

    const where = {
        employee: {
            companyId: company
        }
    };


    /**
     * Optional employee filter.
     */
    if (
        filters.employeeId !== undefined &&
        filters.employeeId !== ""
    ) {
        where.employeeId = validateId(
            filters.employeeId,
            "employee ID"
        );
    }


    /**
     * Optional status filter.
     */
    if (
        filters.status !== undefined &&
        filters.status !== ""
    ) {
        if (
            !VALID_STATUSES.includes(
                filters.status
            )
        ) {
            const error = new Error(
                `status must be one of: ${VALID_STATUSES.join(", ")}`
            );

            error.statusCode = 400;
            throw error;
        }

        where.status =
            filters.status;
    }


    return await prisma.leaveRequest.findMany({
        where,

        include: {
            employee: {
                select: {
                    employeeId: true,
                    firstName: true,
                    lastName: true,
                    email: true
                }
            },

            leaveType: true
        },

        orderBy: {
            createdAt: "desc"
        }
    });
}


/**
 * Get Leave Request by ID
 */
async function getLeaveRequestById(
    companyId,
    leaveRequestId
) {
    const company = validateId(
        companyId,
        "company ID"
    );

    const id = validateId(
        leaveRequestId,
        "leave request ID"
    );


    const request =
        await prisma.leaveRequest.findFirst({
            where: {
                leaveRequestId: id,

                employee: {
                    companyId: company
                }
            },

            include: {
                employee: {
                    select: {
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },

                leaveType: true
            }
        });


    if (!request) {
        const error = new Error(
            "Leave request not found"
        );

        error.statusCode = 404;
        throw error;
    }


    return request;
}


/**
 * Approve Leave Request
 *
 * Supports:
 *
 * 1. Full approval
 *
 * approveLeaveRequest(
 *     companyId,
 *     requestId,
 *     adminId
 * )
 *
 * 2. Partial approval
 *
 * approveLeaveRequest(
 *     companyId,
 *     requestId,
 *     adminId,
 *     {
 *         approvedStartDate: "2026-09-10",
 *         approvedEndDate: "2026-09-11"
 *     }
 * )
 *
 * Original requested dates remain unchanged.
 *
 * Balance is deducted using approvedDays.
 */
async function approveLeaveRequest(
    companyId,
    leaveRequestId,
    adminId,
    approvalData = {}
) {
    const company = validateId(
        companyId,
        "company ID"
    );

    const requestId = validateId(
        leaveRequestId,
        "leave request ID"
    );

    const admin = validateId(
        adminId,
        "admin ID"
    );


    /**
     * Validate approvalData.
     */
    if (
        approvalData === null ||
        approvalData === undefined
    ) {
        approvalData = {};
    }

    if (
        typeof approvalData !== "object" ||
        Array.isArray(approvalData)
    ) {
        const error = new Error(
            "Approval data must be an object"
        );

        error.statusCode = 400;
        throw error;
    }


    /**
     * Get request.
     */
    const request =
        await prisma.leaveRequest.findFirst({
            where: {
                leaveRequestId: requestId,

                employee: {
                    companyId: company
                }
            }
        });


    if (!request) {
        const error = new Error(
            "Leave request not found"
        );

        error.statusCode = 404;
        throw error;
    }


    /**
     * Only pending requests can be approved.
     */
    if (
        request.status !== "PENDING"
    ) {
        const error = new Error(
            `Leave request cannot be approved because its current status is ${request.status}`
        );

        error.statusCode = 409;
        throw error;
    }


    /**
     * Original requested date range.
     */
    const requestedStart =
        normalizeDate(
            request.startDate
        );

    const requestedEnd =
        normalizeDate(
            request.endDate
        );


    /**
     * --------------------------------------------------------
     * DETERMINE APPROVED DATE RANGE
     * --------------------------------------------------------
     *
     * No dates supplied:
     *     approve entire request.
     *
     * Dates supplied:
     *     approve only the specified range.
     */
    let approvedStartDate;
    let approvedEndDate;


    const hasApprovedStart =
        approvalData.approvedStartDate !==
            undefined &&
        approvalData.approvedStartDate !==
            null &&
        approvalData.approvedStartDate !==
            "";


    const hasApprovedEnd =
        approvalData.approvedEndDate !==
            undefined &&
        approvalData.approvedEndDate !==
            null &&
        approvalData.approvedEndDate !==
            "";


    if (
        !hasApprovedStart &&
        !hasApprovedEnd
    ) {
        approvedStartDate =
            requestedStart;

        approvedEndDate =
            requestedEnd;

    } else {

        /**
         * Both dates are required for
         * an explicit partial approval.
         */
        if (
            !hasApprovedStart ||
            !hasApprovedEnd
        ) {
            const error = new Error(
                "Both approvedStartDate and approvedEndDate are required"
            );

            error.statusCode = 400;
            throw error;
        }


        approvedStartDate =
            parseDate(
                approvalData.approvedStartDate,
                "approvedStartDate"
            );

        approvedEndDate =
            parseDate(
                approvalData.approvedEndDate,
                "approvedEndDate"
            );


        /**
         * Approved end date cannot be before
         * approved start date.
         */
        if (
            approvedEndDate <
            approvedStartDate
        ) {
            const error = new Error(
                "approvedEndDate cannot be before approvedStartDate"
            );

            error.statusCode = 400;
            throw error;
        }
    }


    approvedStartDate =
        normalizeDate(
            approvedStartDate
        );

    approvedEndDate =
        normalizeDate(
            approvedEndDate
        );


    /**
     * --------------------------------------------------------
     * APPROVED RANGE MUST BE INSIDE REQUESTED RANGE
     * --------------------------------------------------------
     */
    if (
        approvedStartDate <
            requestedStart ||
        approvedEndDate >
            requestedEnd
    ) {
        const error = new Error(
            "Approved leave dates must be within the originally requested dates"
        );

        error.statusCode = 400;
        error.code =
            "APPROVED_DATES_OUTSIDE_REQUEST";

        throw error;
    }


    /**
     * Calculate approved days.
     *
     * Inclusive:
     *
     * 10 -> 10 = 1
     * 10 -> 11 = 2
     */
    const approvedDays =
        calculateTotalDays(
            approvedStartDate,
            approvedEndDate
        );


    if (
        !Number.isFinite(
            approvedDays
        ) ||
        approvedDays <= 0
    ) {
        const error = new Error(
            "Approved leave days must be greater than zero"
        );

        error.statusCode = 400;
        throw error;
    }


    /**
     * --------------------------------------------------------
     * PREVENT CROSS-YEAR APPROVAL
     * --------------------------------------------------------
     *
     * Current LeaveBalance is keyed by:
     *
     * employee + leaveType + year
     *
     * Therefore one approved leave cannot span
     * two calendar years.
     */
    const requestedStartYear =
        requestedStart.getFullYear();

    const requestedEndYear =
        requestedEnd.getFullYear();

    const approvedStartYear =
        approvedStartDate.getFullYear();

    const approvedEndYear =
        approvedEndDate.getFullYear();


    if (
        requestedStartYear !==
        requestedEndYear
    ) {
        const error = new Error(
            "Leave requests cannot currently span multiple calendar years"
        );

        error.statusCode = 400;

        throw error;
    }


    if (
        approvedStartYear !==
        approvedEndYear
    ) {
        const error = new Error(
            "Approved leave cannot span multiple calendar years"
        );

        error.statusCode = 400;

        throw error;
    }


    if (
        approvedStartYear !==
        requestedStartYear
    ) {
        const error = new Error(
            "Approved leave must remain in the same year as the requested leave"
        );

        error.statusCode = 400;

        throw error;
    }


    const year =
        validateYear(
            requestedStartYear
        );


    /**
     * --------------------------------------------------------
     * TRANSACTION
     * --------------------------------------------------------
     */
    return await prisma.$transaction(
        async (tx) => {

            /**
             * Re-read the request inside the transaction.
             *
             * This avoids approving a request that
             * another operation already changed.
             */
            const currentRequest =
                await tx.leaveRequest.findFirst({
                    where: {
                        leaveRequestId:
                            requestId,

                        employee: {
                            companyId: company
                        }
                    }
                });


            if (!currentRequest) {
                const error = new Error(
                    "Leave request not found"
                );

                error.statusCode = 404;
                throw error;
            }


            if (
                currentRequest.status !==
                "PENDING"
            ) {
                const error = new Error(
                    `Leave request cannot be approved because its current status is ${currentRequest.status}`
                );

                error.statusCode = 409;
                throw error;
            }


            /**
             * ------------------------------------------------
             * ENSURE LEAVE BALANCES EXIST
             * ------------------------------------------------
             *
             * This creates missing balances for active
             * employees using the active LeaveType annualQuota.
             *
             * Existing used values are preserved.
             */
            await ensureCompanyLeaveBalances(
                company,
                year,
                tx
            );


            /**
             * Find the employee's balance.
             */
            const balance =
                await tx.leaveBalance.findUnique({
                    where: {
                        employeeId_leaveTypeId_year: {
                            employeeId:
                                currentRequest.employeeId,

                            leaveTypeId:
                                currentRequest.leaveTypeId,

                            year
                        }
                    }
                });


            if (!balance) {
                const error = new Error(
                    "Leave balance could not be created for this employee and leave type"
                );

                error.statusCode = 400;
                throw error;
            }


            const remaining =
                Number(
                    balance.remaining
                );


            /**
             * ------------------------------------------------
             * PREVENT NEGATIVE BALANCE
             * ------------------------------------------------
             *
             * IMPORTANT:
             * Deduct approvedDays, NOT totalDays.
             */
            if (
                remaining <
                approvedDays
            ) {
                const error = new Error(
                    "Insufficient leave balance"
                );

                error.statusCode = 400;
                error.code =
                    "INSUFFICIENT_LEAVE_BALANCE";

                error.details = {
                    allocated:
                        Number(
                            balance.allocated
                        ),

                    used:
                        Number(
                            balance.used
                        ),

                    remaining,

                    requestedDays:
                        Number(
                            currentRequest.totalDays
                        ),

                    approvedDays
                };

                throw error;
            }


            /**
             * ------------------------------------------------
             * UPDATE LEAVE REQUEST
             * ------------------------------------------------
             *
             * Original:
             *
             * startDate
             * endDate
             * totalDays
             *
             * remain unchanged.
             *
             * Approved values are stored separately.
             */
            const updatedRequest =
                await tx.leaveRequest.update({
                    where: {
                        leaveRequestId:
                            requestId
                    },

                    data: {
                        status: "APPROVED",

                        approvedBy:
                            admin,

                        approvedAt:
                            new Date(),

                        approvedStartDate,

                        approvedEndDate,

                        approvedDays
                    },

                    include: {
                        employee: {
                            select: {
                                employeeId: true,
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        },

                        leaveType: true
                    }
                });


            /**
             * ------------------------------------------------
             * UPDATE LEAVE BALANCE
             * ------------------------------------------------
             *
             * Deduct ONLY approved days.
             */
            await tx.leaveBalance.update({
                where: {
                    leaveBalanceId:
                        balance.leaveBalanceId
                },

                data: {
                    used:
                        Number(
                            balance.used
                        ) +
                        approvedDays,

                    remaining:
                        remaining -
                        approvedDays
                }
            });


            return updatedRequest;
        }
    );
}


/**
 * Reject Leave Request
 *
 * Rejection:
 *
 * - changes status to REJECTED
 * - stores rejection reason
 * - clears approval fields
 * - does not affect leave balance
 */
async function rejectLeaveRequest(
    companyId,
    leaveRequestId,
    adminId,
    rejectionReason
) {
    const company = validateId(
        companyId,
        "company ID"
    );

    const requestId = validateId(
        leaveRequestId,
        "leave request ID"
    );

    const admin = validateId(
        adminId,
        "admin ID"
    );


    /**
     * Get request and verify company.
     */
    const request =
        await prisma.leaveRequest.findFirst({
            where: {
                leaveRequestId: requestId,

                employee: {
                    companyId: company
                }
            }
        });


    if (!request) {
        const error = new Error(
            "Leave request not found"
        );

        error.statusCode = 404;
        throw error;
    }


    /**
     * Only pending requests can be rejected.
     */
    if (
        request.status !== "PENDING"
    ) {
        const error = new Error(
            `Leave request cannot be rejected because its current status is ${request.status}`
        );

        error.statusCode = 409;
        throw error;
    }


    return await prisma.leaveRequest.update({
        where: {
            leaveRequestId: requestId
        },

        data: {
            status: "REJECTED",

            approvedBy:
                admin,

            approvedAt:
                new Date(),

            rejectionReason:
                typeof rejectionReason === "string"
                    ? rejectionReason.trim() || null
                    : null,

            /**
             * A rejected request must not
             * contain approval information.
             */
            approvedStartDate: null,

            approvedEndDate: null,

            approvedDays: null
        },

        include: {
            employee: {
                select: {
                    employeeId: true,
                    firstName: true,
                    lastName: true,
                    email: true
                }
            },

            leaveType: true
        }
    });
}


/**
 * Cancel Leave Request
 *
 * PENDING:
 *     Just cancel.
 *
 * APPROVED:
 *     Cancel and refund ONLY approvedDays.
 *
 * For old records that were approved before
 * approvedDays existed, totalDays is used
 * as a backwards-compatible fallback.
 */
async function cancelLeaveRequest(
    companyId,
    leaveRequestId,
    employeeId
) {
    const company = validateId(
        companyId,
        "company ID"
    );

    const requestId = validateId(
        leaveRequestId,
        "leave request ID"
    );

    const employee = validateId(
        employeeId,
        "employee ID"
    );


    /**
     * Get employee's request.
     */
    const request =
        await prisma.leaveRequest.findFirst({
            where: {
                leaveRequestId: requestId,

                employeeId: employee,

                employee: {
                    companyId: company
                }
            }
        });


    if (!request) {
        const error = new Error(
            "Leave request not found"
        );

        error.statusCode = 404;
        throw error;
    }


    /**
     * Only PENDING and APPROVED requests
     * can be cancelled.
     */
    if (
        ![
            "PENDING",
            "APPROVED"
        ].includes(
            request.status
        )
    ) {
        const error = new Error(
            `Leave request cannot be cancelled because its current status is ${request.status}`
        );

        error.statusCode = 409;
        throw error;
    }


    return await prisma.$transaction(
        async (tx) => {

            /**
             * ------------------------------------------------
             * PENDING CANCELLATION
             * ------------------------------------------------
             *
             * Nothing was deducted, so simply cancel.
             */
            if (
                request.status === "PENDING"
            ) {
                return await tx.leaveRequest.update({
                    where: {
                        leaveRequestId:
                            requestId
                    },

                    data: {
                        status: "CANCELLED"
                    },

                    include: {
                        employee: {
                            select: {
                                employeeId: true,
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        },

                        leaveType: true
                    }
                });
            }


            /**
             * ------------------------------------------------
             * APPROVED CANCELLATION
             * ------------------------------------------------
             */
            const year =
                new Date(
                    request.startDate
                ).getFullYear();


            /**
             * Find balance.
             */
            const balance =
                await tx.leaveBalance.findUnique({
                    where: {
                        employeeId_leaveTypeId_year: {
                            employeeId:
                                request.employeeId,

                            leaveTypeId:
                                request.leaveTypeId,

                            year
                        }
                    }
                });


            /**
             * Determine how many days were
             * actually deducted.
             *
             * New records:
             *     approvedDays
             *
             * Legacy records:
             *     totalDays
             */
            const approvedDays =
                request.approvedDays !== null &&
                request.approvedDays !== undefined
                    ? Number(
                        request.approvedDays
                    )
                    : Number(
                        request.totalDays
                    );


            if (
                !Number.isFinite(
                    approvedDays
                ) ||
                approvedDays < 0
            ) {
                const error = new Error(
                    "Invalid approved leave days"
                );

                error.statusCode = 400;
                throw error;
            }


            /**
             * Refund the balance when
             * the balance record exists.
             */
            if (balance) {

                const used =
                    Number(
                        balance.used
                    );

                const remaining =
                    Number(
                        balance.remaining
                    );


                await tx.leaveBalance.update({
                    where: {
                        leaveBalanceId:
                            balance.leaveBalanceId
                    },

                    data: {
                        used:
                            Math.max(
                                0,
                                used -
                                approvedDays
                            ),

                        remaining:
                            remaining +
                            approvedDays
                    }
                });
            }


            /**
             * Mark request as cancelled.
             *
             * Keep original request dates/days.
             *
             * Keep approved information for historical
             * reference. The status tells us that the
             * approved leave was cancelled.
             */
            return await tx.leaveRequest.update({
                where: {
                    leaveRequestId:
                        requestId
                },

                data: {
                    status: "CANCELLED"
                },

                include: {
                    employee: {
                        select: {
                            employeeId: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },

                    leaveType: true
                }
            });
        }
    );
}


/**
 * Export service functions
 */
module.exports = {
    createLeaveRequest,
    getLeaveRequests,
    getLeaveRequestById,
    approveLeaveRequest,
    rejectLeaveRequest,
    cancelLeaveRequest
};