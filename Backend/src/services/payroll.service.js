const prisma = require("../config/database");
const payrollPeriodService = require("./payroll/payroll-period.service");
const payrollCalculationService = require("./payroll/payroll-calculation.service");
const payrollGenerationService = require("./payroll/payroll-generation.service");
const payrollAdvanceService = require("./payroll/payroll-advance.service");
const payrollPaymentService = require("./payroll/payroll-payment.service");
const payrollExtraWorkService = require("./payroll/payroll-extra-work.service");
const payrollReportService = require("./payroll/payroll-report.service");

const PAYROLL_CONFIG_KEY_PREFIX = "PAYROLL_CONFIG_BRANCH_";
const DEFAULT_PAYROLL_CONFIGURATION = payrollPeriodService.DEFAULT_PAYROLL_CONFIGURATION;

const payrollInclude = {
  employee: {
    include: {
      branch: {
        select: { branchId: true, branchName: true, companyId: true }
      }
    }
  },
  advanceDeductionRecord: true
};

const createServiceError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parseDate = (value, fieldName = "date") => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createServiceError(`${fieldName} must be a valid date`);
  }
  return date;
};

const decimalToNumber = payrollCalculationService.decimalToNumber;
const roundMoney = payrollCalculationService.roundMoney;

const validatePositiveNumber = (value, fieldName) => {
  const numberValue = Number(value);
  if (value === undefined || value === null || value === "" || !Number.isFinite(numberValue) || numberValue <= 0) {
    throw createServiceError(`${fieldName} must be greater than 0`);
  }
  return numberValue;
};

const validateNonNegativeNumber = (value, fieldName) => {
  const numberValue = Number(value);
  if (value === undefined || value === null || value === "" || !Number.isFinite(numberValue) || numberValue < 0) {
    throw createServiceError(`${fieldName} must be greater than or equal to 0`);
  }
  return numberValue;
};

const validateInteger = (value, fieldName) => {
  const numberValue = Number(value);
  if (value === undefined || value === null || value === "" || !Number.isInteger(numberValue)) {
    throw createServiceError(`${fieldName} must be an integer`);
  }
  return numberValue;
};

const startOfDayUTC = (value) => {
  const date = parseDate(value, "date");
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
};

const endOfDayUTC = (value) => {
  const date = parseDate(value, "date");
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
};

const getEmployeeById = async (employeeId, companyId) => {
  const parsedEmployeeId = Number(employeeId);
  const parsedCompanyId = Number(companyId);
  if (!Number.isInteger(parsedEmployeeId) || parsedEmployeeId < 1) throw createServiceError("Invalid employee ID");
  if (!Number.isInteger(parsedCompanyId) || parsedCompanyId < 1) throw createServiceError("Invalid company ID");

  const employee = await prisma.employee.findFirst({
    where: { employeeId: parsedEmployeeId, companyId: parsedCompanyId },
    include: {
      branch: { select: { branchId: true, branchName: true, companyId: true } }
    }
  });
  if (!employee) throw createServiceError("Employee not found", 404);
  return employee;
};

const getBranchById = async (branchId, companyId) => {
  const parsedBranchId = Number(branchId);
  const parsedCompanyId = Number(companyId);
  if (!Number.isInteger(parsedBranchId) || parsedBranchId < 1) throw createServiceError("Invalid branch ID");
  if (!Number.isInteger(parsedCompanyId) || parsedCompanyId < 1) throw createServiceError("Invalid company ID");

  const branch = await prisma.branch.findFirst({
    where: { branchId: parsedBranchId, companyId: parsedCompanyId },
    select: { branchId: true, branchName: true, companyId: true }
  });
  if (!branch) throw createServiceError("Branch not found", 404);
  return branch;
};

const normalizePayrollConfiguration = (configuration) =>
  payrollPeriodService.normalizePayrollConfiguration(configuration);

const buildPayrollConfigKey = (branchId) =>
  `${PAYROLL_CONFIG_KEY_PREFIX}${Number(branchId)}`;

const getPayrollConfiguration = async (branchId, companyId) => {
  const branch = await getBranchById(branchId, companyId);
  const settingKey = buildPayrollConfigKey(branch.branchId);
  let configuration = null;

  const setting = await prisma.setting.findFirst({
    where: { companyId: branch.companyId, key: settingKey }
  });

  if (setting?.value !== undefined && setting?.value !== null) {
    let value = setting.value;
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        value = null;
      }
    }
    if (value && typeof value === "object") configuration = normalizePayrollConfiguration(value);
  }

  configuration ||= normalizePayrollConfiguration(DEFAULT_PAYROLL_CONFIGURATION);
  return {
    companyId: branch.companyId,
    branchId: branch.branchId,
    branchName: branch.branchName,
    ...configuration
  };
};

const savePayrollConfiguration = async (branchId, companyId, configuration) => {
  const branch = await getBranchById(branchId, companyId);
  const normalized = normalizePayrollConfiguration(configuration);
  const settingKey = buildPayrollConfigKey(branch.branchId);

  const result = await prisma.$transaction(async (transaction) => {
    const settingValue = JSON.stringify(normalized);
    const existing = await transaction.setting.findFirst({
      where: { companyId: branch.companyId, key: settingKey }
    });

    const setting = existing
      ? await transaction.setting.update({ where: { settingId: existing.settingId }, data: { value: settingValue } })
      : await transaction.setting.create({ data: { companyId: branch.companyId, key: settingKey, value: settingValue } });

    const unpaidPayrolls = await transaction.payroll.findMany({
      where: {
        status: "UNPAID",
        paymentDate: null,
        employee: { companyId: branch.companyId, branchId: branch.branchId }
      },
      select: { payrollId: true, payPeriodStart: true }
    });

    let updatedUnpaidPayrolls = 0;
    for (const payroll of unpaidPayrolls) {
      const periodStart = parseDate(payroll.payPeriodStart, "payPeriodStart");
      const period = payrollPeriodService.buildPeriodFromStartMonth(
        periodStart.getUTCFullYear(),
        periodStart.getUTCMonth(),
        normalized
      );
      const scheduledPaymentDate = payrollPeriodService.getScheduledPaymentDateForPeriod(period.periodEnd, normalized);
      await transaction.payroll.update({
        where: { payrollId: payroll.payrollId },
        data: {
          payPeriodStart: period.periodStart,
          payPeriodEnd: period.periodEnd,
          scheduledPaymentDate,
          paymentDate: null,
          status: "UNPAID"
        }
      });
      updatedUnpaidPayrolls += 1;
    }
    return { setting, updatedUnpaidPayrolls };
  });

  const currentPeriod = await payrollPeriodService.getCurrentPayrollPeriod(normalized);
  const nextPeriod = await payrollPeriodService.getNextPayrollPeriod(normalized);
  return {
    ...result.setting,
    companyId: branch.companyId,
    branchId: branch.branchId,
    branchName: branch.branchName,
    configuration: normalized,
    currentPeriod,
    nextPeriod,
    updatedUnpaidPayrolls: result.updatedUnpaidPayrolls
  };
};

const getConfiguration = (branchId, companyId) => getPayrollConfiguration(branchId, companyId);

const updateConfiguration = async (branchId, companyId, data = {}) => {
  const current = await getPayrollConfiguration(branchId, companyId);
  const next = {
    startDay: data.startDay !== undefined ? validateInteger(data.startDay, "startDay") : current.startDay,
    endDay: data.endDay !== undefined ? validateInteger(data.endDay, "endDay") : current.endDay,
    paymentDay: data.paymentDay !== undefined ? validateInteger(data.paymentDay, "paymentDay") : current.paymentDay,
    enabled: data.enabled !== undefined ? Boolean(data.enabled) : current.enabled
  };

  if (next.startDay < 1 || next.startDay > 31) throw createServiceError("startDay must be between 1 and 31");
  if (next.endDay < 0 || next.endDay > 31) throw createServiceError("endDay must be between 0 and 31");
  if (next.paymentDay < 1 || next.paymentDay > 31) throw createServiceError("paymentDay must be between 1 and 31");
  return savePayrollConfiguration(branchId, companyId, next);
};

const getCurrentPayrollPeriod = (configuration, referenceDate = new Date()) =>
  payrollPeriodService.getCurrentPayrollPeriod(normalizePayrollConfiguration(configuration), referenceDate);

const getPreviousPayrollPeriod = (configuration, referenceDate = new Date()) => {
  const normalized = normalizePayrollConfiguration(configuration);

  if (typeof payrollPeriodService.getPreviousPayrollPeriod === "function") {
    return payrollPeriodService.getPreviousPayrollPeriod(normalized, referenceDate);
  }

  throw createServiceError(
    "Previous payroll period support is not available in payroll-period.service.js"
  );
};

const getNextPayrollPeriod = (configuration, referenceDate = new Date()) =>
  payrollPeriodService.getNextPayrollPeriod(normalizePayrollConfiguration(configuration), referenceDate);

const getPayrollByPrimaryKey = async (payrollId, companyId, include = payrollInclude) => {
  const id = Number(payrollId);
  const company = Number(companyId);
  if (!Number.isInteger(id) || id < 1) throw createServiceError("Invalid payroll ID");
  if (!Number.isInteger(company) || company < 1) throw createServiceError("Invalid company ID");

  const payroll = await prisma.payroll.findFirst({
    where: { payrollId: id, employee: { companyId: company } },
    include
  });
  if (!payroll) throw createServiceError("Payroll not found", 404);
  return payroll;
};

const isPayrollPaidRecord = (payroll) =>
  String(payroll?.status || (payroll?.paymentDate ? "PAID" : "UNPAID")).toUpperCase() === "PAID";

const getPayrollPeriodKey = (payroll) => {
  const start = payroll?.payPeriodStart ? new Date(payroll.payPeriodStart).toISOString().slice(0, 10) : "";
  const end = payroll?.payPeriodEnd ? new Date(payroll.payPeriodEnd).toISOString().slice(0, 10) : "";
  return `${payroll?.employeeId || ""}|${start}|${end}`;
};

const resolveHistoricalDuplicates = (payrolls) => {
  const byPeriod = new Map();
  for (const payroll of payrolls) {
    const key = getPayrollPeriodKey(payroll);
    const existing = byPeriod.get(key);
    if (!existing || (isPayrollPaidRecord(payroll) && !isPayrollPaidRecord(existing))) byPeriod.set(key, payroll);
  }
  return [...byPeriod.values()];
};

const getScheduledPaymentDate = async (payroll) => {
  if (payroll?.scheduledPaymentDate) return payroll.scheduledPaymentDate;
  if (!payroll?.employee?.branchId || !payroll?.employee?.companyId) return null;
  try {
    const configuration = await getPayrollConfiguration(payroll.employee.branchId, payroll.employee.companyId);
    return payrollPeriodService.getScheduledPaymentDateForPeriod(payroll.payPeriodEnd, configuration);
  } catch {
    return null;
  }
};

const syncExtraWorkForUnpaidPayroll = async (payroll, extraHours) => {
  const amount = roundMoney(Math.max(0, decimalToNumber(extraHours)));
  const current = await prisma.extraWork.findFirst({
    where: {
      payrollId: Number(payroll.payrollId),
      employeeId: Number(payroll.employeeId),
      status: "ACCUMULATED",
      settlementId: null
    },
    orderBy: { extraWorkId: "desc" }
  });

  if (amount > 0) {
    if (current) {
      if (roundMoney(current.extraHours) !== amount) {
        await prisma.extraWork.update({ where: { extraWorkId: current.extraWorkId }, data: { extraHours: amount } });
      }
    } else {
      await prisma.extraWork.create({
        data: {
          employeeId: Number(payroll.employeeId),
          payrollId: Number(payroll.payrollId),
          extraHours: amount,
          status: "ACCUMULATED"
        }
      });
    }
  } else if (current && roundMoney(current.extraHours) !== 0) {
    await prisma.extraWork.update({ where: { extraWorkId: current.extraWorkId }, data: { extraHours: 0 } });
  }
};

const toAdvancePaymentView = (advance) => ({
  advancePaymentId: advance.advanceId,
  amount: decimalToNumber(advance.amount),
  approvedAmount: decimalToNumber(advance.approvedAmount),
  paidAmount: decimalToNumber(advance.paidAmount),
  paymentDate: advance.paymentDate,
  status: advance.status,
  deductedAt: advance.deductedAt,
  deductedInPayrollId: advance.deductedInPayrollId
});

const decoratePayroll = async (payroll, options = {}) => {
  if (!payroll) return null;
  const status = isPayrollPaidRecord(payroll) ? "PAID" : "UNPAID";
  const scheduledPaymentDate = await getScheduledPaymentDate(payroll);

  if (status === "PAID") {
    const advancePayments = Array.isArray(payroll.advanceDeductionRecord)
      ? payroll.advanceDeductionRecord.map(toAdvancePaymentView)
      : payroll.advanceDeductionRecord ? [toAdvancePaymentView(payroll.advanceDeductionRecord)] : [];

    return {
      ...payroll,
      status: "PAID",
      totalWorkingHours: decimalToNumber(payroll.totalWorkingHours),
      paidHolidayHours: decimalToNumber(payroll.paidHolidayHours),
      regularWorkingHours: decimalToNumber(payroll.regularWorkingHours),
      shortageHours: decimalToNumber(payroll.shortageHours),
      shortageDeduction: roundMoney(payroll.shortageDeduction),
      extraHours: decimalToNumber(payroll.extraHours),
      basicSalary: roundMoney(payroll.basicSalary),
      advanceDeduction: roundMoney(payroll.advanceDeduction),
      netSalary: roundMoney(payroll.netSalary),
      pendingAmount: roundMoney(payroll.netSalary),
      accumulatedExtraHours: 0,
      scheduledPaymentDate,
      advancePayments
    };
  }

  const liveWorkingHours = await payrollCalculationService.getAttendanceWorkingHoursForPeriod(
    payroll.employeeId,
    payroll.payPeriodStart,
    payroll.payPeriodEnd
  );
  const employee = await prisma.employee.findUnique({
    where: { employeeId: Number(payroll.employeeId) },
    select: { baseSalary: true, monthlyExpectedHours: true, salaryRatePerHour: true }
  });
  const liveBaseSalary = employee ? decimalToNumber(employee.baseSalary) : decimalToNumber(payroll.baseSalary);
  const liveExpectedHours = employee ? decimalToNumber(employee.monthlyExpectedHours) : decimalToNumber(payroll.monthlyExpectedHours);
  const liveHourlyRate = employee
    ? decimalToNumber(employee.salaryRatePerHour) || payrollCalculationService.calculateHourlyRate(liveBaseSalary, liveExpectedHours)
    : decimalToNumber(payroll.salaryRatePerHour) || payrollCalculationService.calculateHourlyRate(liveBaseSalary, liveExpectedHours);
  const livePaidHolidayHours = await payrollCalculationService.getPaidPublicHolidayHoursForPeriod(
    payroll.employeeId,
    payroll.employee?.companyId,
    payroll.payPeriodStart,
    payroll.payPeriodEnd
  );
  const breakdown = payrollCalculationService.calculateAttendanceBreakdown(
    liveWorkingHours,
    liveExpectedHours,
    liveHourlyRate,
    livePaidHolidayHours
  );
  const accumulated = await payrollExtraWorkService.getEmployeeAccumulatedExtraWork(
    payroll.employeeId,
    payroll.employee?.companyId
  );
  const liveShortageDeduction = Math.min(
    liveBaseSalary,
    Math.max(0, roundMoney(breakdown.shortageDeduction))
  );
  const amountAfterShortage = Math.max(0, roundMoney(liveBaseSalary - liveShortageDeduction));
  const liveAdvanceSummary = await payrollAdvanceService.getLiveAdvanceSummary(
    payroll.employeeId,
    payroll.payPeriodStart,
    payroll.payPeriodEnd
  );
  const advanceDeduction = payrollAdvanceService.calculateAdvanceDeduction(
    amountAfterShortage,
    liveAdvanceSummary.totalAdvance
  );
  const pendingAmount = Math.max(0, roundMoney(amountAfterShortage - advanceDeduction));

  if (options.syncExtraWork === true) {
    await syncExtraWorkForUnpaidPayroll(payroll, breakdown.extraHours);
  }

  return {
    ...payroll,
    status: "UNPAID",
    totalWorkingHours: roundMoney(liveWorkingHours),
    paidHolidayHours: roundMoney(breakdown.paidHolidayHours),
    regularWorkingHours: roundMoney(breakdown.regularWorkingHours),
    shortageHours: roundMoney(breakdown.shortageHours),
    shortageDeduction: liveShortageDeduction,
    extraHours: roundMoney(breakdown.extraHours),
    basicSalary: roundMoney(breakdown.regularSalary),
    advanceDeduction: roundMoney(advanceDeduction),
    pendingAmount,
    netSalary: pendingAmount,
    accumulatedExtraHours: roundMoney(accumulated?.summary?.accumulatedExtraHours || 0),
    scheduledPaymentDate,
    advancePayments: liveAdvanceSummary.advances
  };
};

const findOverlappingPayroll = async (employeeId, payPeriodStart, payPeriodEnd, excludePayrollId = null) => {
  const where = {
    employeeId: Number(employeeId),
    payPeriodStart: { lte: payPeriodEnd },
    payPeriodEnd: { gte: payPeriodStart }
  };
  if (excludePayrollId !== null && excludePayrollId !== undefined) where.payrollId = { not: Number(excludePayrollId) };
  return prisma.payroll.findFirst({ where, orderBy: { payrollId: "asc" } });
};

const createPayroll = async (data, companyId) => {
  const employee = await getEmployeeById(data.employeeId, companyId);
  const periodStart = parseDate(data.payPeriodStart, "payPeriodStart");
  const periodEnd = parseDate(data.payPeriodEnd, "payPeriodEnd");
  if (periodStart > periodEnd) throw createServiceError("Payroll period start date cannot be after end date");

  if (await findOverlappingPayroll(employee.employeeId, periodStart, periodEnd)) {
    throw createServiceError("A payroll already exists for this employee with an overlapping payroll period", 409);
  }

  const baseSalary = data.baseSalary != null ? validateNonNegativeNumber(data.baseSalary, "baseSalary") : decimalToNumber(employee.baseSalary);
  const monthlyExpectedHours = data.monthlyExpectedHours != null
    ? validatePositiveNumber(data.monthlyExpectedHours, "monthlyExpectedHours")
    : decimalToNumber(employee.monthlyExpectedHours);
  const salaryRatePerHour = data.salaryRatePerHour != null
    ? validateNonNegativeNumber(data.salaryRatePerHour, "salaryRatePerHour")
    : decimalToNumber(employee.salaryRatePerHour) || payrollCalculationService.calculateHourlyRate(baseSalary, monthlyExpectedHours);
  const totalWorkingHours = data.totalWorkingHours !== undefined
    ? validateNonNegativeNumber(data.totalWorkingHours, "totalWorkingHours")
    : await payrollCalculationService.getAttendanceWorkingHoursForPeriod(employee.employeeId, periodStart, periodEnd);
  const paidHolidayHours = await payrollCalculationService.getPaidPublicHolidayHoursForPeriod(
    employee.employeeId,
    companyId,
    periodStart,
    periodEnd
  );
  const breakdown = payrollCalculationService.calculateAttendanceBreakdown(
    totalWorkingHours,
    monthlyExpectedHours,
    salaryRatePerHour,
    paidHolidayHours
  );
  const salaryAfterShortage = Math.max(0, roundMoney(baseSalary - breakdown.shortageDeduction));
  const advanceSource = await payrollAdvanceService.getPayrollAdvanceDeduction(
    employee.employeeId,
    periodStart,
    periodEnd,
    salaryAfterShortage
  );
  const requestedAdvance = data.advanceDeduction != null
    ? validateNonNegativeNumber(data.advanceDeduction, "advanceDeduction")
    : advanceSource.advanceDeduction;
  const advanceDeduction = payrollAdvanceService.calculateAdvanceDeduction(salaryAfterShortage, requestedAdvance);

  let scheduledPaymentDate = null;
  if (data.scheduledPaymentDate) {
    scheduledPaymentDate = parseDate(data.scheduledPaymentDate, "scheduledPaymentDate");
  } else if (data.paymentDate) {
    scheduledPaymentDate = parseDate(data.paymentDate, "paymentDate");
  } else {
    const configuration = await getPayrollConfiguration(employee.branchId, companyId);
    scheduledPaymentDate = payrollPeriodService.getScheduledPaymentDateForPeriod(periodEnd, configuration);
  }

  const netSalary = Math.max(0, roundMoney(salaryAfterShortage - advanceDeduction));
  const payroll = await prisma.$transaction(async (transaction) => {
    const created = await transaction.payroll.create({
      data: {
        employeeId: employee.employeeId,
        payPeriodStart: periodStart,
        payPeriodEnd: periodEnd,
        baseSalary: roundMoney(baseSalary),
        monthlyExpectedHours: roundMoney(monthlyExpectedHours),
        salaryRatePerHour: roundMoney(salaryRatePerHour),
        totalWorkingHours: roundMoney(totalWorkingHours),
        paidHolidayHours: roundMoney(breakdown.paidHolidayHours),
        regularWorkingHours: roundMoney(breakdown.regularWorkingHours),
        shortageHours: roundMoney(breakdown.shortageHours),
        shortageDeduction: roundMoney(breakdown.shortageDeduction),
        extraHours: roundMoney(breakdown.extraHours),
        basicSalary: roundMoney(breakdown.regularSalary),
        incentiveAmount: 0,
        advanceDeduction: roundMoney(advanceDeduction),
        netSalary,
        scheduledPaymentDate,
        paymentDate: null,
        status: "UNPAID"
      },
      include: payrollInclude
    });

    if (breakdown.extraHours > 0) {
      await transaction.extraWork.create({
        data: {
          employeeId: employee.employeeId,
          payrollId: created.payrollId,
          extraHours: roundMoney(breakdown.extraHours),
          status: "ACCUMULATED"
        }
      });
    }
    return created;
  });

  return decoratePayroll(payroll);
};

const generatePayrollForEmployee = (...args) => payrollGenerationService.generatePayrollForEmployee(...args);
const generatePayrollForBranch = (...args) => payrollGenerationService.generatePayrollForBranch(...args);
const generateCurrentBranchPayroll = async (branchId, companyId, referenceDate = new Date()) => {
  const configuration = await getPayrollConfiguration(branchId, companyId);
  if (!configuration.enabled) throw createServiceError("Payroll is disabled for this branch");
  return payrollGenerationService.generateCurrentBranchPayroll(branchId, companyId, referenceDate);
};

const getAllPayroll = async (companyId, filters = {}) => {
  const parsedCompanyId = Number(companyId);
  if (!Number.isInteger(parsedCompanyId) || parsedCompanyId < 1) throw createServiceError("Invalid company ID");

  const where = { employee: { companyId: parsedCompanyId } };
  if (filters.employeeId) where.employee.employeeId = Number(filters.employeeId);
  if (filters.branchId) where.employee.branchId = Number(filters.branchId);

  if (filters.status) {
    const status = String(filters.status).toUpperCase();
    if (!["PAID", "UNPAID"].includes(status)) throw createServiceError("status must be PAID or UNPAID");
    where.status = status;
  }

  // A payroll period is a span, so a date-range query must use
  // overlap semantics rather than requiring the entire payroll
  // period to fit inside the requested range.
  //
  // Example:
  //   Payroll:      30 Sep → 31 Oct
  //   Requested:    01 Sep → 30 Sep
  //
  // That payroll overlaps September and must remain discoverable
  // by the September query. The frontend/report layer can then
  // classify it by payPeriodStart when it needs a specific payroll
  // month.
  if (filters.startDate || filters.endDate) {
    const rangeStart = filters.startDate
      ? startOfDayUTC(filters.startDate)
      : null;

    const rangeEnd = filters.endDate
      ? endOfDayUTC(filters.endDate)
      : null;

    if (rangeStart && rangeEnd) {
      where.payPeriodStart = {
        ...(where.payPeriodStart || {}),
        lte: rangeEnd
      };
      where.payPeriodEnd = {
        ...(where.payPeriodEnd || {}),
        gte: rangeStart
      };
    } else if (rangeStart) {
      where.payPeriodEnd = {
        ...(where.payPeriodEnd || {}),
        gte: rangeStart
      };
    } else if (rangeEnd) {
      where.payPeriodStart = {
        ...(where.payPeriodStart || {}),
        lte: rangeEnd
      };
    }
  }

  if (filters.month !== undefined || filters.year !== undefined) {
    if (filters.month === undefined || filters.year === undefined) {
      throw createServiceError("Both month and year are required for payroll month filtering");
    }
    const range = payrollReportService.getMonthDateRange(filters.month, filters.year);
    where.payPeriodStart = { ...(where.payPeriodStart || {}), lt: range.nextMonthDate };
    where.payPeriodEnd = { ...(where.payPeriodEnd || {}), gte: range.startDate };
  }

  const payrolls = await prisma.payroll.findMany({
    where,
    include: payrollInclude,
    orderBy: [{ payPeriodStart: "desc" }, { payrollId: "desc" }]
  });

  const decorated = [];
  for (const payroll of payrolls) decorated.push(await decoratePayroll(payroll));
  return resolveHistoricalDuplicates(decorated);
};


const getPayrollRecordsForPeriod = async (
  companyId,
  periodStart,
  periodEnd,
  filters = {}
) => {
  const parsedCompanyId = Number(companyId);
  if (!Number.isInteger(parsedCompanyId) || parsedCompanyId < 1) {
    throw createServiceError("Invalid company ID");
  }

  const start = parseDate(periodStart, "periodStart");
  const end = parseDate(periodEnd, "periodEnd");

  if (start.getTime() > end.getTime()) {
    throw createServiceError("periodStart cannot be after periodEnd");
  }

  const where = {
    employee: {
      companyId: parsedCompanyId
    },
    payPeriodStart: start,
    payPeriodEnd: end
  };

  if (filters.branchId !== undefined && filters.branchId !== null && filters.branchId !== "") {
    where.employee.branchId = Number(filters.branchId);
  }

  if (filters.status) {
    const status = String(filters.status).toUpperCase();
    if (!["PAID", "UNPAID"].includes(status)) {
      throw createServiceError("status must be PAID or UNPAID");
    }
    where.status = status;
  }

  const payrolls = await prisma.payroll.findMany({
    where,
    include: payrollInclude,
    orderBy: [{ employeeId: "asc" }, { payrollId: "asc" }]
  });

  const decorated = [];
  for (const payroll of payrolls) {
    decorated.push(await decoratePayroll(payroll));
  }

  return resolveHistoricalDuplicates(decorated);
};

const getPayrollRecordsForMonth = async (
  companyId,
  month,
  year,
  filters = {}
) => {
  const parsedMonth = validateInteger(month, "month");
  const parsedYear = validateInteger(year, "year");

  if (parsedMonth < 1 || parsedMonth > 12) {
    throw createServiceError("month must be between 1 and 12");
  }

  const range = payrollReportService.getMonthDateRange(parsedMonth, parsedYear);

  // This method is intentionally different from the generic date-range
  // report. A "payroll month" means the month in which payPeriodStart
  // falls. That gives the frontend a stable month classification even
  // when a payroll period overlaps two calendar months.
  const where = {
    employee: {
      companyId: Number(companyId)
    },
    payPeriodStart: {
      gte: range.startDate,
      lt: range.nextMonthDate
    }
  };

  if (filters.branchId !== undefined && filters.branchId !== null && filters.branchId !== "") {
    where.employee.branchId = Number(filters.branchId);
  }

  if (filters.status) {
    const status = String(filters.status).toUpperCase();
    if (!["PAID", "UNPAID"].includes(status)) {
      throw createServiceError("status must be PAID or UNPAID");
    }
    where.status = status;
  }

  const payrolls = await prisma.payroll.findMany({
    where,
    include: payrollInclude,
    orderBy: [{ payPeriodStart: "desc" }, { employeeId: "asc" }, { payrollId: "desc" }]
  });

  const decorated = [];
  for (const payroll of payrolls) {
    decorated.push(await decoratePayroll(payroll));
  }

  return resolveHistoricalDuplicates(decorated);
};

const getPreviousPayrollRecords = async (
  companyId,
  configuration,
  referenceDate = new Date(),
  filters = {}
) => {
  const normalized = normalizePayrollConfiguration(configuration);
  const period = await getPreviousPayrollPeriod(normalized, referenceDate);

  const payrolls = await getPayrollRecordsForPeriod(
    companyId,
    period.periodStart,
    period.periodEnd,
    filters
  );

  return {
    ...period,
    payrolls
  };
};

const getPayrollSummaryByMonthYear = async (companyId, month, year, filters = {}) => {
  const range = payrollReportService.getMonthDateRange(month, year);
  const payrolls = await getAllPayroll(companyId, { ...filters, month: range.month, year: range.year });
  let totalPayroll = 0;
  let totalNetPayroll = 0;
  let totalAdvanceTaken = 0;
  let totalPaid = 0;
  let totalPending = 0;
  let paidCount = 0;
  let pendingCount = 0;
  const employeeIds = new Set();

  for (const payroll of payrolls) {
    const gross = roundMoney(payroll.baseSalary);
    const net = roundMoney(payroll.netSalary);
    const advance = roundMoney(payroll.advanceDeduction);
    totalPayroll = roundMoney(totalPayroll + gross);
    totalNetPayroll = roundMoney(totalNetPayroll + net);
    totalAdvanceTaken = roundMoney(totalAdvanceTaken + advance);
    employeeIds.add(payroll.employeeId);
    if (String(payroll.status).toUpperCase() === "PAID") {
      totalPaid = roundMoney(totalPaid + net);
      paidCount += 1;
    } else {
      totalPending = roundMoney(totalPending + net);
      pendingCount += 1;
    }
  }

  return {
    month: range.month,
    year: range.year,
    periodStart: range.startDate,
    periodEnd: range.endDate,
    employeeCount: employeeIds.size,
    payrollCount: payrolls.length,
    paidCount,
    pendingCount,
    totalPayroll: roundMoney(totalPayroll),
    totalPayrollGenerated: roundMoney(totalPayroll),
    totalNetPayroll: roundMoney(totalNetPayroll),
    totalAdvanceTaken: roundMoney(totalAdvanceTaken),
    totalPaid: roundMoney(totalPaid),
    totalPending: roundMoney(totalPending),
    payrolls
  };
};

const getPayrollById = async (payrollId, companyId) =>
  decoratePayroll(await getPayrollByPrimaryKey(payrollId, companyId));

const getEmployeePayroll = async (employeeId, companyId) => {
  await getEmployeeById(employeeId, companyId);
  const payrolls = await prisma.payroll.findMany({
    where: { employeeId: Number(employeeId), employee: { companyId: Number(companyId) } },
    include: payrollInclude,
    orderBy: { payPeriodStart: "desc" }
  });
  const decorated = [];
  for (const payroll of payrolls) decorated.push(await decoratePayroll(payroll));
  return resolveHistoricalDuplicates(decorated);
};

const getMyPayroll = (employeeId, companyId) => getEmployeePayroll(employeeId, companyId);

const updatePayroll = async (payrollId, data = {}, companyId) => {
  const existing = await getPayrollByPrimaryKey(payrollId, companyId);
  if (isPayrollPaidRecord(existing)) throw createServiceError("Paid payroll cannot be modified", 409);

  const updateData = {};
  const finalStart = data.payPeriodStart !== undefined ? parseDate(data.payPeriodStart, "payPeriodStart") : existing.payPeriodStart;
  const finalEnd = data.payPeriodEnd !== undefined ? parseDate(data.payPeriodEnd, "payPeriodEnd") : existing.payPeriodEnd;
  if (finalStart > finalEnd) throw createServiceError("Payroll period start date cannot be after end date");

  if (data.payPeriodStart !== undefined || data.payPeriodEnd !== undefined) {
    const overlap = await findOverlappingPayroll(existing.employeeId, finalStart, finalEnd, existing.payrollId);
    if (overlap) throw createServiceError("The updated payroll period overlaps another payroll for this employee", 409);
    updateData.payPeriodStart = finalStart;
    updateData.payPeriodEnd = finalEnd;
  }
  if (data.baseSalary !== undefined) updateData.baseSalary = validateNonNegativeNumber(data.baseSalary, "baseSalary");
  if (data.monthlyExpectedHours !== undefined) updateData.monthlyExpectedHours = validatePositiveNumber(data.monthlyExpectedHours, "monthlyExpectedHours");
  if (data.salaryRatePerHour !== undefined) updateData.salaryRatePerHour = validateNonNegativeNumber(data.salaryRatePerHour, "salaryRatePerHour");
  if (data.totalWorkingHours !== undefined) updateData.totalWorkingHours = validateNonNegativeNumber(data.totalWorkingHours, "totalWorkingHours");
  if (data.scheduledPaymentDate !== undefined) {
    updateData.scheduledPaymentDate = data.scheduledPaymentDate === null ? null : parseDate(data.scheduledPaymentDate, "scheduledPaymentDate");
  }
  if (data.basicSalary !== undefined) updateData.basicSalary = validateNonNegativeNumber(data.basicSalary, "basicSalary");
  if (data.status !== undefined) {
    const status = String(data.status).toUpperCase();
    if (status === "PAID") throw createServiceError("Use the payroll payment action to mark payroll as paid");
    if (status !== "UNPAID") throw createServiceError("Invalid payroll status");
    updateData.status = "UNPAID";
    updateData.paymentDate = null;
  }

  const salaryInputsChanged =
    data.payPeriodStart !== undefined ||
    data.payPeriodEnd !== undefined ||
    data.baseSalary !== undefined ||
    data.monthlyExpectedHours !== undefined ||
    data.salaryRatePerHour !== undefined ||
    data.totalWorkingHours !== undefined;

  if (salaryInputsChanged) {
    const finalBaseSalary = data.baseSalary !== undefined ? validateNonNegativeNumber(data.baseSalary, "baseSalary") : decimalToNumber(existing.baseSalary);
    const finalExpectedHours = data.monthlyExpectedHours !== undefined
      ? validatePositiveNumber(data.monthlyExpectedHours, "monthlyExpectedHours")
      : decimalToNumber(existing.monthlyExpectedHours);
    const finalWorkingHours = data.totalWorkingHours !== undefined
      ? validateNonNegativeNumber(data.totalWorkingHours, "totalWorkingHours")
      : await payrollCalculationService.getAttendanceWorkingHoursForPeriod(existing.employeeId, finalStart, finalEnd);
    const finalHourlyRate = data.salaryRatePerHour !== undefined
      ? validateNonNegativeNumber(data.salaryRatePerHour, "salaryRatePerHour")
      : decimalToNumber(existing.salaryRatePerHour) || payrollCalculationService.calculateHourlyRate(finalBaseSalary, finalExpectedHours);
    const paidHolidayHours = await payrollCalculationService.getPaidPublicHolidayHoursForPeriod(
      existing.employeeId,
      companyId,
      finalStart,
      finalEnd
    );
    const breakdown = payrollCalculationService.calculateAttendanceBreakdown(
      finalWorkingHours,
      finalExpectedHours,
      finalHourlyRate,
      paidHolidayHours
    );
    const shortageDeduction = Math.min(finalBaseSalary, Math.max(0, roundMoney(breakdown.shortageDeduction)));
    const amountAfterShortage = Math.max(0, roundMoney(finalBaseSalary - shortageDeduction));
    const advance = await payrollAdvanceService.getPayrollAdvanceDeduction(
      existing.employeeId,
      finalStart,
      finalEnd,
      amountAfterShortage
    );
    const requestedAdvance = data.advanceDeduction !== undefined
      ? validateNonNegativeNumber(data.advanceDeduction, "advanceDeduction")
      : advance.advanceDeduction;
    const advanceDeduction = payrollAdvanceService.calculateAdvanceDeduction(amountAfterShortage, requestedAdvance);

    updateData.baseSalary = roundMoney(finalBaseSalary);
    updateData.monthlyExpectedHours = roundMoney(finalExpectedHours);
    updateData.salaryRatePerHour = roundMoney(finalHourlyRate);
    updateData.totalWorkingHours = roundMoney(finalWorkingHours);
    updateData.paidHolidayHours = roundMoney(breakdown.paidHolidayHours);
    updateData.regularWorkingHours = roundMoney(breakdown.regularWorkingHours);
    updateData.shortageHours = roundMoney(breakdown.shortageHours);
    updateData.shortageDeduction = shortageDeduction;
    updateData.extraHours = roundMoney(breakdown.extraHours);
    updateData.basicSalary = roundMoney(breakdown.regularSalary);
    updateData.advanceDeduction = advanceDeduction;
    updateData.netSalary = Math.max(0, roundMoney(amountAfterShortage - advanceDeduction));

    if (data.scheduledPaymentDate === undefined) {
      const configuration = await getPayrollConfiguration(existing.employee.branchId, companyId);
      updateData.scheduledPaymentDate = payrollPeriodService.getScheduledPaymentDateForPeriod(finalEnd, configuration);
    }
  } else if (data.advanceDeduction !== undefined) {
    const baseSalary = decimalToNumber(existing.baseSalary);
    const shortage = Math.min(baseSalary, Math.max(0, decimalToNumber(existing.shortageDeduction)));
    const amountAfterShortage = Math.max(0, roundMoney(baseSalary - shortage));
    const deduction = payrollAdvanceService.calculateAdvanceDeduction(
      amountAfterShortage,
      validateNonNegativeNumber(data.advanceDeduction, "advanceDeduction")
    );
    updateData.advanceDeduction = deduction;
    updateData.netSalary = Math.max(0, roundMoney(amountAfterShortage - deduction));
  }

  const updated = await prisma.payroll.update({
    where: { payrollId: Number(payrollId) },
    data: updateData,
    include: payrollInclude
  });

  if (salaryInputsChanged) await syncExtraWorkForUnpaidPayroll(updated, updated.extraHours);
  return decoratePayroll(updated);
};

const deletePayroll = async (payrollId, companyId) => {
  const existing = await getPayrollByPrimaryKey(payrollId, companyId, {
    employee: { select: { employeeId: true, companyId: true } }
  });
  if (isPayrollPaidRecord(existing)) throw createServiceError("Paid payroll cannot be deleted", 409);

  const linkedExtraWork = await prisma.extraWork.findFirst({ where: { payrollId: Number(payrollId) } });
  if (linkedExtraWork) {
    throw createServiceError("Payroll with extra-work records cannot be deleted because extra-work history must be preserved", 409);
  }
  return prisma.payroll.delete({ where: { payrollId: Number(payrollId) } });
};

const markPayrollPaid = async (payrollId, companyId) =>
  decoratePayroll(await payrollPaymentService.markPayrollPaid(payrollId, companyId));

const getCurrentBranchPayroll = async (branchId, companyId, referenceDate = new Date()) => {
  const configuration = await getPayrollConfiguration(branchId, companyId);
  const period = await payrollPeriodService.getCurrentPayrollPeriod(configuration, referenceDate);
  const payrolls = await prisma.payroll.findMany({
    where: {
      employee: { companyId: Number(companyId), branchId: Number(branchId) },
      payPeriodStart: period.periodStart,
      payPeriodEnd: period.periodEnd
    },
    include: payrollInclude,
    orderBy: { employeeId: "asc" }
  });
  const decorated = [];
  for (const payroll of payrolls) decorated.push(await decoratePayroll(payroll));
  return {
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    scheduledPaymentDate: period.scheduledPaymentDate,
    configuration,
    payrolls: resolveHistoricalDuplicates(decorated)
  };
};

const refreshPayrollsForPublicHolidayChange = async (companyId, branchId, holidayDate) => {
  const company = Number(companyId);
  const branch = Number(branchId);
  if (!Number.isInteger(company) || company < 1) throw createServiceError("Invalid company ID");
  if (!Number.isInteger(branch) || branch < 1) throw createServiceError("Invalid branch ID");

  const parsedHolidayDate = parseDate(holidayDate, "holidayDate");
  const holidayStart = startOfDayUTC(parsedHolidayDate);
  const holidayEnd = endOfDayUTC(parsedHolidayDate);
  const affectedPayrolls = await prisma.payroll.findMany({
    where: {
      status: "UNPAID",
      payPeriodStart: { lte: holidayEnd },
      payPeriodEnd: { gte: holidayStart },
      employee: { companyId: company, branchId: branch }
    },
    include: payrollInclude,
    orderBy: { payrollId: "asc" }
  });

  const refreshedPayrollIds = [];
  for (const payroll of affectedPayrolls) {
    const liveWorkingHours = await payrollCalculationService.getAttendanceWorkingHoursForPeriod(
      payroll.employeeId,
      payroll.payPeriodStart,
      payroll.payPeriodEnd
    );
    const employee = await prisma.employee.findUnique({
      where: { employeeId: Number(payroll.employeeId) },
      select: { baseSalary: true, monthlyExpectedHours: true, salaryRatePerHour: true }
    });
    const baseSalary = employee ? decimalToNumber(employee.baseSalary) : decimalToNumber(payroll.baseSalary);
    const expectedHours = employee ? decimalToNumber(employee.monthlyExpectedHours) : decimalToNumber(payroll.monthlyExpectedHours);
    const hourlyRate = employee
      ? decimalToNumber(employee.salaryRatePerHour) || payrollCalculationService.calculateHourlyRate(baseSalary, expectedHours)
      : decimalToNumber(payroll.salaryRatePerHour) || payrollCalculationService.calculateHourlyRate(baseSalary, expectedHours);
    const paidHolidayHours = await payrollCalculationService.getPaidPublicHolidayHoursForPeriod(
      payroll.employeeId,
      company,
      payroll.payPeriodStart,
      payroll.payPeriodEnd
    );
    const breakdown = payrollCalculationService.calculateAttendanceBreakdown(
      liveWorkingHours,
      expectedHours,
      hourlyRate,
      paidHolidayHours
    );
    const shortageDeduction = Math.min(baseSalary, Math.max(0, roundMoney(breakdown.shortageDeduction)));
    const amountAfterShortage = Math.max(0, roundMoney(baseSalary - shortageDeduction));
    const advance = await payrollAdvanceService.getPayrollAdvanceDeduction(
      payroll.employeeId,
      payroll.payPeriodStart,
      payroll.payPeriodEnd,
      amountAfterShortage
    );
    const advanceDeduction = payrollAdvanceService.calculateAdvanceDeduction(amountAfterShortage, advance.advanceDeduction);
    const netSalary = Math.max(0, roundMoney(amountAfterShortage - advanceDeduction));

    const refreshed = await prisma.payroll.update({
      where: { payrollId: Number(payroll.payrollId) },
      data: {
        baseSalary: roundMoney(baseSalary),
        monthlyExpectedHours: roundMoney(expectedHours),
        salaryRatePerHour: roundMoney(hourlyRate),
        totalWorkingHours: roundMoney(liveWorkingHours),
        paidHolidayHours: roundMoney(breakdown.paidHolidayHours),
        regularWorkingHours: roundMoney(breakdown.regularWorkingHours),
        shortageHours: roundMoney(breakdown.shortageHours),
        shortageDeduction,
        extraHours: roundMoney(breakdown.extraHours),
        basicSalary: roundMoney(breakdown.regularSalary),
        advanceDeduction,
        netSalary
      },
      include: payrollInclude
    });

    await syncExtraWorkForUnpaidPayroll(refreshed, breakdown.extraHours);
    refreshedPayrollIds.push(refreshed.payrollId);
  }

  return { affectedPayrollCount: refreshedPayrollIds.length, refreshedPayrollIds };
};

module.exports = {
  createPayroll,
  generatePayrollForEmployee,
  generatePayrollForBranch,
  generateCurrentBranchPayroll,
  getAllPayroll,
  getPayrollSummaryByMonthYear,
  getPayrollById,
  getEmployeePayroll,
  getMyPayroll,
  updatePayroll,
  deletePayroll,
  markPayrollPaid,
  getCurrentPayrollPeriod,
  getPreviousPayrollPeriod,
  getNextPayrollPeriod,
  getPayrollRecordsForPeriod,
  getPayrollRecordsForMonth,
  getPreviousPayrollRecords,
  getCurrentBranchPayroll,
  getConfiguration,
  updateConfiguration,
  getPayrollConfiguration,
  refreshPayrollsForPublicHolidayChange
};