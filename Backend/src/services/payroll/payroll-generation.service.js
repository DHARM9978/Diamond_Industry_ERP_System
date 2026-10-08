const prisma = require("../../config/database");
const payrollPeriodService = require("./payroll-period.service");
const payrollCalculationService = require("./payroll-calculation.service");

const PAYROLL_CONFIG_KEY_PREFIX = "PAYROLL_CONFIG_BRANCH_";

const DEFAULT_PAYROLL_CONFIGURATION = {
  startDay: 1,
  endDay: 0,
  paymentDay: 5,
  enabled: true,
};

const createServiceError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parseDate = (value, fieldName) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createServiceError(`${fieldName} must be a valid date`, 400);
  }
  return date;
};

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const employeeInclude = {
  branch: {
    select: {
      branchId: true,
      branchName: true,
      companyId: true,
    },
  },
};

const payrollInclude = {
  employee: { include: employeeInclude },
  advanceDeductionRecord: true,
};

const getEmployeeById = async (employeeId, companyId) => {
  const employee = await prisma.employee.findFirst({
    where: {
      employeeId: Number(employeeId),
      companyId: Number(companyId),
    },
    include: employeeInclude,
  });

  if (!employee) {
    throw createServiceError("Employee not found", 404);
  }

  return employee;
};

const getBranchById = async (branchId, companyId) => {
  const branch = await prisma.branch.findFirst({
    where: {
      branchId: Number(branchId),
      companyId: Number(companyId),
    },
    select: {
      branchId: true,
      branchName: true,
      companyId: true,
    },
  });

  if (!branch) {
    throw createServiceError("Branch not found", 404);
  }

  return branch;
};

/**
 * Read payroll configuration directly from Setting so this generation
 * service does not depend on payroll.service.js and create a circular import.
 */
const getPayrollConfiguration = async (branchId, companyId) => {
  const parsedBranchId = Number(branchId);
  const parsedCompanyId = Number(companyId);

  if (!Number.isInteger(parsedBranchId) || parsedBranchId < 1) {
    throw createServiceError("Invalid branch ID", 400);
  }
  if (!Number.isInteger(parsedCompanyId) || parsedCompanyId < 1) {
    throw createServiceError("Invalid company ID", 400);
  }

  const branch = await getBranchById(parsedBranchId, parsedCompanyId);
  const settingKey = `${PAYROLL_CONFIG_KEY_PREFIX}${branch.branchId}`;
  let configuration = null;

  try {
    const setting = await prisma.setting.findFirst({
      where: { companyId: parsedCompanyId, key: settingKey },
    });

    if (setting) {
      let parsedValue = setting.value;
      if (typeof parsedValue === "string") {
        try {
          parsedValue = JSON.parse(parsedValue);
        } catch (_) {
          parsedValue = null;
        }
      }

      if (parsedValue) {
        configuration = payrollPeriodService.normalizePayrollConfiguration(parsedValue);
      }
    }
  } catch (_) {
    // Fall back to defaults. A bad/missing setting must not stop generation.
  }

  if (!configuration) {
    configuration = payrollPeriodService.normalizePayrollConfiguration(
      DEFAULT_PAYROLL_CONFIGURATION
    );
  }

  return {
    companyId: branch.companyId,
    branchId: branch.branchId,
    branchName: branch.branchName,
    ...configuration,
  };
};

const findExactPayroll = async (employeeId, payPeriodStart, payPeriodEnd) =>
  prisma.payroll.findFirst({
    where: {
      employeeId: Number(employeeId),
      payPeriodStart,
      payPeriodEnd,
    },
    orderBy: [
      { paymentDate: "desc" },
      { payrollId: "asc" },
    ],
  });

const findOverlappingPayroll = async (employeeId, payPeriodStart, payPeriodEnd) =>
  prisma.payroll.findFirst({
    where: {
      employeeId: Number(employeeId),
      payPeriodStart: { lte: payPeriodEnd },
      payPeriodEnd: { gte: payPeriodStart },
    },
    orderBy: { payrollId: "asc" },
  });

/**
 * A legacy payroll row created with the old UTC/IST boundary handling can
 * be exactly one calendar day earlier at the start while ending on the
 * same calendar day as the newly calculated period.
 *
 * Example legacy row:
 *   30 Sep 2026 -> 31 Oct 2026
 *
 * Correct current row:
 *   01 Oct 2026 -> 31 Oct 2026
 *
 * Only unpaid rows with this exact one-day start shift are eligible for
 * automatic repair. Paid historical payroll is never rewritten.
 */
const isLegacyOneDayShiftedPayroll = (
  payroll,
  requestedPeriodStart,
  requestedPeriodEnd
) => {
  if (!payroll) {
    return false;
  }

  const status = String(
    payroll.status || (payroll.paymentDate ? "PAID" : "UNPAID")
  ).toUpperCase();

  if (status === "PAID" || payroll.paymentDate) {
    return false;
  }

  const existingStart = parseDate(
    payroll.payPeriodStart,
    "existing.payPeriodStart"
  );
  const existingEnd = parseDate(
    payroll.payPeriodEnd,
    "existing.payPeriodEnd"
  );
  const requestedStart = parseDate(
    requestedPeriodStart,
    "requestedPeriodStart"
  );
  const requestedEnd = parseDate(
    requestedPeriodEnd,
    "requestedPeriodEnd"
  );

  const existingEndKey = Date.UTC(
    existingEnd.getUTCFullYear(),
    existingEnd.getUTCMonth(),
    existingEnd.getUTCDate()
  );
  const requestedEndKey = Date.UTC(
    requestedEnd.getUTCFullYear(),
    requestedEnd.getUTCMonth(),
    requestedEnd.getUTCDate()
  );

  const existingStartKey = Date.UTC(
    existingStart.getUTCFullYear(),
    existingStart.getUTCMonth(),
    existingStart.getUTCDate()
  );
  const requestedStartKey = Date.UTC(
    requestedStart.getUTCFullYear(),
    requestedStart.getUTCMonth(),
    requestedStart.getUTCDate()
  );

  const ONE_CALENDAR_DAY_MS =
    24 * 60 * 60 * 1000;

  return (
    existingEndKey === requestedEndKey &&
    existingStartKey + ONE_CALENDAR_DAY_MS === requestedStartKey
  );
};

const createGeneratedPayroll = async (employee, periodStart, periodEnd, calculation) => {
  const baseSalary = roundMoney(calculation.baseSalary);
  const shortageDeduction = roundMoney(calculation.shortageDeduction);
  const netSalaryBeforeAdvance = Math.max(0, roundMoney(baseSalary - shortageDeduction));
  const scheduledPaymentDate = calculation.scheduledPaymentDate || periodEnd;

  return prisma.$transaction(async (transaction) => {
    const exactExisting = await transaction.payroll.findFirst({
      where: {
        employeeId: employee.employeeId,
        payPeriodStart: periodStart,
        payPeriodEnd: periodEnd,
      },
      orderBy: [
        { paymentDate: "desc" },
        { payrollId: "asc" },
      ],
    });

    if (exactExisting) {
      return {
        payroll: exactExisting,
        created: false,
        repaired: false,
      };
    }

    const overlappingExisting = await transaction.payroll.findFirst({
      where: {
        employeeId: employee.employeeId,
        payPeriodStart: { lte: periodEnd },
        payPeriodEnd: { gte: periodStart },
      },
      orderBy: { payrollId: "asc" },
    });

    if (overlappingExisting) {
      if (
        isLegacyOneDayShiftedPayroll(
          overlappingExisting,
          periodStart,
          periodEnd
        )
      ) {
        const repairedPayroll =
          await transaction.payroll.update({
            where: {
              payrollId:
                overlappingExisting.payrollId,
            },
            data: {
              payPeriodStart:
                periodStart,
              payPeriodEnd:
                periodEnd,
              baseSalary,
              monthlyExpectedHours:
                roundMoney(
                  calculation.expectedHours
                ),
              salaryRatePerHour:
                roundMoney(
                  calculation.salaryRatePerHour
                ),
              totalWorkingHours:
                roundMoney(
                  calculation.actualAttendanceHours
                ),
              paidHolidayHours:
                roundMoney(
                  calculation.paidHolidayHours
                ),
              regularWorkingHours:
                roundMoney(
                  calculation.regularWorkingHours
                ),
              shortageHours:
                roundMoney(
                  calculation.shortageHours
                ),
              shortageDeduction,
              extraHours:
                roundMoney(
                  calculation.extraHours
                ),
              basicSalary:
                roundMoney(
                  calculation.regularSalary
                ),
              incentiveAmount: 0,
              advanceDeduction: 0,
              netSalary:
                netSalaryBeforeAdvance,
              scheduledPaymentDate:
                scheduledPaymentDate
                  ? parseDate(
                      scheduledPaymentDate,
                      "scheduledPaymentDate"
                    )
                  : null,
              paymentDate: null,
              status: "UNPAID",
            },
            include: payrollInclude,
          });

        return {
          payroll: repairedPayroll,
          created: false,
          repaired: true,
        };
      }

      return {
        payroll: overlappingExisting,
        created: false,
        repaired: false,
      };
    }

    const payroll = await transaction.payroll.create({
      data: {
        employeeId: employee.employeeId,
        payPeriodStart: periodStart,
        payPeriodEnd: periodEnd,
        baseSalary,
        monthlyExpectedHours: roundMoney(calculation.expectedHours),
        salaryRatePerHour: roundMoney(calculation.salaryRatePerHour),
        totalWorkingHours: roundMoney(calculation.actualAttendanceHours),
        paidHolidayHours: roundMoney(calculation.paidHolidayHours),
        regularWorkingHours: roundMoney(calculation.regularWorkingHours),
        shortageHours: roundMoney(calculation.shortageHours),
        shortageDeduction,
        extraHours: roundMoney(calculation.extraHours),
        basicSalary: roundMoney(calculation.regularSalary),
        incentiveAmount: 0,
        advanceDeduction: 0,
        netSalary: netSalaryBeforeAdvance,
        scheduledPaymentDate: scheduledPaymentDate
          ? parseDate(scheduledPaymentDate, "scheduledPaymentDate")
          : null,
        paymentDate: null,
        status: "UNPAID",
      },
      include: payrollInclude,
    });

    if (calculation.extraHours > 0) {
      await transaction.extraWork.create({
        data: {
          employeeId: employee.employeeId,
          payrollId: payroll.payrollId,
          extraHours: roundMoney(calculation.extraHours),
          status: "ACCUMULATED",
        },
      });
    }

    return {
      payroll,
      created: true,
      repaired: false,
    };
  });
};

const generatePayrollForEmployee = async (
  employeeId,
  payPeriodStart,
  payPeriodEnd,
  companyId
) => {
  const employee = await getEmployeeById(employeeId, companyId);
  const periodStart = parseDate(payPeriodStart, "payPeriodStart");
  const periodEnd = parseDate(payPeriodEnd, "payPeriodEnd");

  if (periodStart > periodEnd) {
    throw createServiceError("Payroll period start date cannot be after end date", 400);
  }

  const exactExisting = await findExactPayroll(
    employee.employeeId,
    periodStart,
    periodEnd
  );

  if (exactExisting) {
    return {
      ...exactExisting,
      created: false,
      alreadyExists: true,
      repaired: false,
    };
  }

  const existing = await findOverlappingPayroll(
    employee.employeeId,
    periodStart,
    periodEnd
  );

  if (
    existing &&
    !isLegacyOneDayShiftedPayroll(
      existing,
      periodStart,
      periodEnd
    )
  ) {
    return {
      ...existing,
      created: false,
      alreadyExists: true,
      repaired: false,
    };
  }

  const calculation =
    await payrollCalculationService.calculateEmployeeAttendanceBreakdown({
      employeeId: employee.employeeId,
      companyId: Number(companyId),
      payPeriodStart: periodStart,
      payPeriodEnd: periodEnd,
      baseSalary: employee.baseSalary,
      monthlyExpectedHours: employee.monthlyExpectedHours,
      salaryRatePerHour: employee.salaryRatePerHour,
    });

  const configuration = await getPayrollConfiguration(
    employee.branchId,
    companyId
  );

  const scheduledPaymentDate = payrollPeriodService.getScheduledPaymentDateForPeriod(
    periodEnd,
    configuration
  );

  const result = await createGeneratedPayroll(
    employee,
    periodStart,
    periodEnd,
    { ...calculation, scheduledPaymentDate }
  );

  return {
    ...result.payroll,
    created: result.created,
    alreadyExists:
      result.created
        ? false
        : result.repaired !== true,
    repaired:
      result.repaired === true,
  };
};

const generatePayrollForBranch = async (
  branchId,
  payPeriodStart,
  payPeriodEnd,
  companyId
) => {
  const branch = await getBranchById(branchId, companyId);
  const periodStart = parseDate(payPeriodStart, "payPeriodStart");
  const periodEnd = parseDate(payPeriodEnd, "payPeriodEnd");

  if (periodStart > periodEnd) {
    throw createServiceError("Payroll period start date cannot be after end date", 400);
  }

  const employees = await prisma.employee.findMany({
    where: {
      branchId: branch.branchId,
      companyId: Number(companyId),
      status: "ACTIVE",
    },
    orderBy: { employeeId: "asc" },
  });

  const results = [];

  for (const employee of employees) {
    try {
      results.push(
        await generatePayrollForEmployee(
          employee.employeeId,
          periodStart,
          periodEnd,
          companyId
        )
      );
    } catch (error) {
      results.push({
        employeeId: employee.employeeId,
        employeeName:
          `${employee.firstName || ""} ${employee.lastName || ""}`.trim() ||
          employee.name ||
          `Employee ${employee.employeeId}`,
        created: false,
        alreadyExists: false,
        success: false,
        error: error.message,
      });
    }
  }

  const generatedCount = results.filter(
    (result) => result.created === true
  ).length;
  const repairedCount = results.filter(
    (result) => result.repaired === true
  ).length;
  const alreadyGeneratedCount = results.filter(
    (result) =>
      result.alreadyExists === true &&
      result.repaired !== true
  ).length;
  const failedCount = results.filter(
    (result) => result.success === false
  ).length;

  let message = "Branch payroll generation completed";
  if (
    generatedCount === 0 &&
    repairedCount === 0 &&
    alreadyGeneratedCount > 0 &&
    failedCount === 0
  ) {
    message = "Payroll is already generated for this period.";
  } else if (
    (generatedCount > 0 || repairedCount > 0) &&
    failedCount === 0
  ) {
    message = "Payroll generated successfully.";
  } else if (
    (generatedCount > 0 || repairedCount > 0) &&
    failedCount > 0
  ) {
    message = "Payroll generation completed with some errors.";
  }

  return {
    branchId: branch.branchId,
    branchName: branch.branchName,
    periodStart,
    periodEnd,
    count: results.length,
    generatedCount,
    repairedCount,
    alreadyGeneratedCount,
    failedCount,
    message,
    results,
  };
};

const generateCurrentBranchPayroll = async (
  branchId,
  companyId,
  referenceDate = new Date()
) => {
  const configuration = await getPayrollConfiguration(branchId, companyId);

  if (!configuration.enabled) {
    throw createServiceError("Payroll is disabled for this branch", 400);
  }

  const period = await payrollPeriodService.getCurrentPayrollPeriod(
    configuration,
    referenceDate
  );

  return generatePayrollForBranch(
    branchId,
    period.periodStart,
    period.periodEnd,
    companyId
  );
};

module.exports = {
  findOverlappingPayroll,
  createGeneratedPayroll,
  generatePayrollForEmployee,
  generatePayrollForBranch,
  generateCurrentBranchPayroll,
};