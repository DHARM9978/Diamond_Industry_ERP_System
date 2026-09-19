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

function createError(message, statusCode, code, details) {
    const error = new Error(message);
    error.statusCode = statusCode || 400;

    if (code) {
        error.code = code;
    }

    if (details !== undefined) {
        error.details = details;
    }

    return error;
}

function validateId(value, fieldName) {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        throw createError(
            "Invalid " + fieldName,
            400
        );
    }

    return id;
}

function validateYear(value) {
    const year = Number(value);

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        throw createError("Invalid year", 400);
    }

    return year;
}

function parseDate(value, fieldName) {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        throw createError(
            fieldName + " must use YYYY-MM-DD format",
            400
        );
    }

    const date = new Date(value + "T00:00:00");

    if (Number.isNaN(date.getTime())) {
        throw createError(
            fieldName + " must be a valid date",
            400
        );
    }

    return normalizeDate(date);
}

function normalizeDate(value) {
    const date = new Date(value);

    date.setHours(0, 0, 0, 0);

    return date;
}

function calculateInclusiveDays(startDate, endDate) {
    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate);

    return (
        (end.getTime() - start.getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1;
}

function formatDateOnly(date) {
    const normalized = normalizeDate(date);
    const year = normalized.getFullYear();
    const month = String(normalized.getMonth() + 1).padStart(2, "0");
    const day = String(normalized.getDate()).padStart(2, "0");

    return year + "-" + month + "-" + day;
}

function rangesOverlap(
    firstStart,
    firstEnd,
    secondStart,
    secondEnd
) {
    const firstStartDate = normalizeDate(firstStart);
    const firstEndDate = normalizeDate(firstEnd);
    const secondStartDate = normalizeDate(secondStart);
    const secondEndDate = normalizeDate(secondEnd);

    return (
        firstStartDate <= secondEndDate &&
        firstEndDate >= secondStartDate
    );
}

async function verifyEmployee(
    employeeId,
    companyId,
    transactionClient
) {
    const client = transactionClient || prisma;

    const employee = await client.employee.findFirst({
        where: {
            employeeId: employeeId,
            companyId: companyId
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
        throw createError(
            "Employee not found in your company",
            404
        );
    }

    if (employee.status !== "ACTIVE") {
        throw createError(
            "Employee is not active",
            400
        );
    }

    return employee;
}

function getEmployeeInclude() {
    return {
        employee: {
            select: {
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true
            }
        },
        leaveType: true
    };
}

async function createLeaveRequest(companyId, employeeId, data) {
    const company = validateId(companyId, "company ID");
    const employee = validateId(employeeId, "employee ID");

    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw createError("Leave request data is required", 400);
    }

    const leaveTypeId = validateId(
        data.leaveTypeId,
        "leave type ID"
    );

    if (!data.startDate) {
        throw createError("startDate is required", 400);
    }

    if (!data.endDate) {
        throw createError("endDate is required", 400);
    }

    const startDate = parseDate(data.startDate, "startDate");
    const endDate = parseDate(data.endDate, "endDate");

    if (endDate < startDate) {
        throw createError(
            "endDate cannot be before startDate",
            400
        );
    }

    const calculatedTotalDays = calculateInclusiveDays(
        startDate,
        endDate
    );

    const totalDays =
        data.totalDays === undefined || data.totalDays === null
            ? calculatedTotalDays
            : Number(data.totalDays);

    if (!Number.isFinite(totalDays) || totalDays <= 0) {
        throw createError(
            "totalDays must be greater than zero",
            400
        );
    }

    if (
        Number.isInteger(calculatedTotalDays) &&
        Number.isInteger(totalDays) &&
        totalDays !== calculatedTotalDays
    ) {
        throw createError(
            "totalDays does not match the selected date range",
            400
        );
    }

    await verifyEmployee(employee, company);

    const leaveType = await prisma.leaveType.findFirst({
        where: {
            leaveTypeId: leaveTypeId,
            companyId: company
        }
    });

    if (!leaveType) {
        throw createError(
            "Leave type not found in your company",
            404
        );
    }

    if (leaveType.status !== "ACTIVE") {
        throw createError(
            "Leave type is inactive",
            400
        );
    }

    if (
        totalDays % 1 !== 0 &&
        !leaveType.allowHalfDay
    ) {
        throw createError(
            "Half-day leave is not allowed for this leave type",
            400
        );
    }

    const existingRequests = await prisma.leaveRequest.findMany({
        where: {
            employeeId: employee,
            status: {
                in: ["PENDING", "APPROVED"]
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

    const overlappingRequest = existingRequests.find(function (existing) {
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

        return rangesOverlap(
            existingStart,
            existingEnd,
            startDate,
            endDate
        );
    });

    if (overlappingRequest) {
        throw createError(
            "Leave dates overlap an existing leave request",
            409,
            "LEAVE_DATE_OVERLAP",
            {
                conflictingLeaveRequestId:
                    overlappingRequest.leaveRequestId,
                status: overlappingRequest.status,
                startDate: overlappingRequest.startDate,
                endDate: overlappingRequest.endDate,
                approvedStartDate:
                    overlappingRequest.approvedStartDate,
                approvedEndDate:
                    overlappingRequest.approvedEndDate,
                leaveTypeId: overlappingRequest.leaveTypeId
            }
        );
    }

    return prisma.leaveRequest.create({
        data: {
            employeeId: employee,
            leaveTypeId: leaveTypeId,
            startDate: startDate,
            endDate: endDate,
            totalDays: totalDays,
            reason:
                typeof data.reason === "string"
                    ? data.reason.trim() || null
                    : null,
            status: "PENDING",
            approvedStartDate: null,
            approvedEndDate: null,
            approvedDays: null
        },
        include: getEmployeeInclude()
    });
}

async function getLeaveRequests(companyId, filters) {
    const company = validateId(companyId, "company ID");
    const safeFilters = filters && typeof filters === "object"
        ? filters
        : {};

    const where = {
        employee: {
            companyId: company
        }
    };

    if (
        safeFilters.employeeId !== undefined &&
        safeFilters.employeeId !== null &&
        safeFilters.employeeId !== ""
    ) {
        where.employeeId = validateId(
            safeFilters.employeeId,
            "employee ID"
        );
    }

    if (
        safeFilters.status !== undefined &&
        safeFilters.status !== null &&
        safeFilters.status !== ""
    ) {
        const status = String(safeFilters.status).toUpperCase();

        if (!VALID_STATUSES.includes(status)) {
            throw createError(
                "status must be one of: " + VALID_STATUSES.join(", "),
                400
            );
        }

        where.status = status;
    }

    return prisma.leaveRequest.findMany({
        where: where,
        include: getEmployeeInclude(),
        orderBy: {
            createdAt: "desc"
        }
    });
}

async function getLeaveRequestById(companyId, leaveRequestId) {
    const company = validateId(companyId, "company ID");
    const requestId = validateId(
        leaveRequestId,
        "leave request ID"
    );

    const request = await prisma.leaveRequest.findFirst({
        where: {
            leaveRequestId: requestId,
            employee: {
                companyId: company
            }
        },
        include: getEmployeeInclude()
    });

    if (!request) {
        throw createError("Leave request not found", 404);
    }

    return request;
}

function readApprovalDates(request, approvalData) {
    const data = approvalData || {};

    const hasStart =
        data.approvedStartDate !== undefined &&
        data.approvedStartDate !== null &&
        data.approvedStartDate !== "";

    const hasEnd =
        data.approvedEndDate !== undefined &&
        data.approvedEndDate !== null &&
        data.approvedEndDate !== "";

    let approvedStartDate;
    let approvedEndDate;

    if (!hasStart && !hasEnd) {
        approvedStartDate = normalizeDate(request.startDate);
        approvedEndDate = normalizeDate(request.endDate);
    } else {
        if (!hasStart || !hasEnd) {
            throw createError(
                "Both approvedStartDate and approvedEndDate are required",
                400
            );
        }

        approvedStartDate = parseDate(
            data.approvedStartDate,
            "approvedStartDate"
        );

        approvedEndDate = parseDate(
            data.approvedEndDate,
            "approvedEndDate"
        );
    }

    if (approvedEndDate < approvedStartDate) {
        throw createError(
            "approvedEndDate cannot be before approvedStartDate",
            400
        );
    }

    const requestedStart = normalizeDate(request.startDate);
    const requestedEnd = normalizeDate(request.endDate);

    if (
        approvedStartDate < requestedStart ||
        approvedEndDate > requestedEnd
    ) {
        throw createError(
            "Approved leave dates must be within the originally requested dates",
            400,
            "APPROVED_DATES_OUTSIDE_REQUEST"
        );
    }

    const approvedDays = calculateInclusiveDays(
        approvedStartDate,
        approvedEndDate
    );

    const requestedDays = Number(request.totalDays);

    if (
        !Number.isFinite(approvedDays) ||
        approvedDays <= 0
    ) {
        throw createError(
            "Approved leave days must be greater than zero",
            400
        );
    }

    if (
        Number.isFinite(requestedDays) &&
        approvedDays > requestedDays
    ) {
        throw createError(
            "Approved leave days cannot be greater than requested leave days",
            400
        );
    }

    return {
        requestedStart: requestedStart,
        requestedEnd: requestedEnd,
        approvedStartDate: approvedStartDate,
        approvedEndDate: approvedEndDate,
        approvedDays: approvedDays
    };
}

async function approveLeaveRequest(
    companyId,
    leaveRequestId,
    adminId,
    approvalData
) {
    const company = validateId(companyId, "company ID");
    const requestId = validateId(
        leaveRequestId,
        "leave request ID"
    );
    const admin = validateId(adminId, "admin ID");

    const request = await prisma.leaveRequest.findFirst({
        where: {
            leaveRequestId: requestId,
            employee: {
                companyId: company
            }
        }
    });

    if (!request) {
        throw createError("Leave request not found", 404);
    }

    if (request.status !== "PENDING") {
        throw createError(
            "Leave request cannot be approved because its current status is " + request.status,
            409
        );
    }

    const approval = readApprovalDates(
        request,
        approvalData || {}
    );

    const requestedStartYear = approval.requestedStart.getFullYear();
    const requestedEndYear = approval.requestedEnd.getFullYear();
    const approvedStartYear = approval.approvedStartDate.getFullYear();
    const approvedEndYear = approval.approvedEndDate.getFullYear();

    if (requestedStartYear !== requestedEndYear) {
        throw createError(
            "Leave requests cannot currently span multiple calendar years",
            400
        );
    }

    if (approvedStartYear !== approvedEndYear) {
        throw createError(
            "Approved leave cannot span multiple calendar years",
            400
        );
    }

    if (approvedStartYear !== requestedStartYear) {
        throw createError(
            "Approved leave must remain in the same year as the requested leave",
            400
        );
    }

    const year = validateYear(requestedStartYear);

    return prisma.$transaction(async function (tx) {
        const currentRequest = await tx.leaveRequest.findFirst({
            where: {
                leaveRequestId: requestId,
                employee: {
                    companyId: company
                }
            }
        });

        if (!currentRequest) {
            throw createError("Leave request not found", 404);
        }

        if (currentRequest.status !== "PENDING") {
            throw createError(
                "Leave request cannot be approved because its current status is " + currentRequest.status,
                409
            );
        }

        const currentApproval = readApprovalDates(
            currentRequest,
            approvalData || {}
        );

        await ensureCompanyLeaveBalances(
            company,
            year,
            tx
        );

        const balance = await tx.leaveBalance.findUnique({
            where: {
                employeeId_leaveTypeId_year: {
                    employeeId: currentRequest.employeeId,
                    leaveTypeId: currentRequest.leaveTypeId,
                    year: year
                }
            }
        });

        if (!balance) {
            throw createError(
                "Leave balance could not be created for this employee and leave type",
                400
            );
        }

        const remaining = Number(balance.remaining);
        const approvedDays = currentApproval.approvedDays;

        if (!Number.isFinite(remaining) || remaining < 0) {
            throw createError(
                "Invalid leave balance",
                400
            );
        }

        if (remaining < approvedDays) {
            throw createError(
                "Insufficient leave balance",
                400,
                "INSUFFICIENT_LEAVE_BALANCE",
                {
                    allocated: Number(balance.allocated),
                    used: Number(balance.used),
                    remaining: remaining,
                    requestedDays: Number(currentRequest.totalDays),
                    approvedDays: approvedDays
                }
            );
        }

        const updatedRequest = await tx.leaveRequest.update({
            where: {
                leaveRequestId: requestId
            },
            data: {
                status: "APPROVED",
                approvedBy: admin,
                approvedAt: new Date(),
                approvedStartDate: currentApproval.approvedStartDate,
                approvedEndDate: currentApproval.approvedEndDate,
                approvedDays: approvedDays
            },
            include: getEmployeeInclude()
        });

        await tx.leaveBalance.update({
            where: {
                leaveBalanceId: balance.leaveBalanceId
            },
            data: {
                used: Number(balance.used) + approvedDays,
                remaining: remaining - approvedDays
            }
        });

        return updatedRequest;
    });
}

async function rejectLeaveRequest(
    companyId,
    leaveRequestId,
    adminId,
    rejectionReason
) {
    const company = validateId(companyId, "company ID");
    const requestId = validateId(
        leaveRequestId,
        "leave request ID"
    );
    const admin = validateId(adminId, "admin ID");

    const request = await prisma.leaveRequest.findFirst({
        where: {
            leaveRequestId: requestId,
            employee: {
                companyId: company
            }
        }
    });

    if (!request) {
        throw createError("Leave request not found", 404);
    }

    if (request.status !== "PENDING") {
        throw createError(
            "Leave request cannot be rejected because its current status is " + request.status,
            409
        );
    }

    return prisma.leaveRequest.update({
        where: {
            leaveRequestId: requestId
        },
        data: {
            status: "REJECTED",
            approvedBy: admin,
            approvedAt: new Date(),
            rejectionReason:
                typeof rejectionReason === "string"
                    ? rejectionReason.trim() || null
                    : null,
            approvedStartDate: null,
            approvedEndDate: null,
            approvedDays: null
        },
        include: getEmployeeInclude()
    });
}

async function cancelLeaveRequest(
    companyId,
    leaveRequestId,
    employeeId
) {
    const company = validateId(companyId, "company ID");
    const requestId = validateId(
        leaveRequestId,
        "leave request ID"
    );
    const employee = validateId(employeeId, "employee ID");

    const request = await prisma.leaveRequest.findFirst({
        where: {
            leaveRequestId: requestId,
            employeeId: employee,
            employee: {
                companyId: company
            }
        }
    });

    if (!request) {
        throw createError("Leave request not found", 404);
    }

    if (![
        "PENDING",
        "APPROVED"
    ].includes(request.status)) {
        throw createError(
            "Leave request cannot be cancelled because its current status is " + request.status,
            409
        );
    }

    return prisma.$transaction(async function (tx) {
        const currentRequest = await tx.leaveRequest.findFirst({
            where: {
                leaveRequestId: requestId,
                employeeId: employee,
                employee: {
                    companyId: company
                }
            }
        });

        if (!currentRequest) {
            throw createError("Leave request not found", 404);
        }

        if (!["PENDING", "APPROVED"].includes(currentRequest.status)) {
            throw createError(
                "Leave request cannot be cancelled because its current status is " + currentRequest.status,
                409
            );
        }

        if (currentRequest.status === "PENDING") {
            return tx.leaveRequest.update({
                where: {
                    leaveRequestId: requestId
                },
                data: {
                    status: "CANCELLED"
                },
                include: getEmployeeInclude()
            });
        }

        const startDate = normalizeDate(currentRequest.startDate);
        const year = startDate.getFullYear();
        validateYear(year);

        const balance = await tx.leaveBalance.findUnique({
            where: {
                employeeId_leaveTypeId_year: {
                    employeeId: currentRequest.employeeId,
                    leaveTypeId: currentRequest.leaveTypeId,
                    year: year
                }
            }
        });

        const approvedDays =
            currentRequest.approvedDays !== null &&
            currentRequest.approvedDays !== undefined
                ? Number(currentRequest.approvedDays)
                : Number(currentRequest.totalDays);

        if (!Number.isFinite(approvedDays) || approvedDays < 0) {
            throw createError(
                "Invalid approved leave days",
                400
            );
        }

        if (balance) {
            const used = Number(balance.used);
            const remaining = Number(balance.remaining);

            await tx.leaveBalance.update({
                where: {
                    leaveBalanceId: balance.leaveBalanceId
                },
                data: {
                    used: Math.max(0, used - approvedDays),
                    remaining: remaining + approvedDays
                }
            });
        }

        return tx.leaveRequest.update({
            where: {
                leaveRequestId: requestId
            },
            data: {
                status: "CANCELLED"
            },
            include: getEmployeeInclude()
        });
    });
}

module.exports = {
    createLeaveRequest,
    getLeaveRequests,
    getLeaveRequestById,
    approveLeaveRequest,
    rejectLeaveRequest,
    cancelLeaveRequest,
    calculateInclusiveDays,
    formatDateOnly
};