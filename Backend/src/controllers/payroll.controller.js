const payrollService = require("../services/payroll.service");

const createControllerError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getCompanyId = (req) => {
  const companyId = Number(req?.user?.companyId);
  if (!Number.isInteger(companyId) || companyId < 1) {
    throw createControllerError("Invalid company ID", 400);
  }
  return companyId;
};

const getPositiveInteger = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw createControllerError(`Invalid ${fieldName}`, 400);
  }
  return parsed;
};

const getOptionalPositiveInteger = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return getPositiveInteger(value, fieldName);
};

const getMonth = (value) => {
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw createControllerError("Month must be an integer between 1 and 12", 400);
  }
  return month;
};

const getYear = (value) => {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2200) {
    throw createControllerError("Year must be a valid four-digit year", 400);
  }
  return year;
};

const getBranchConfiguration = async (req, branchId) => {
  return payrollService.getPayrollConfiguration(
    branchId,
    getCompanyId(req)
  );
};

// POST /api/payroll
const createPayroll = async (req, res) => {
  const payroll = await payrollService.createPayroll(
    req.body || {},
    getCompanyId(req)
  );

  return res.status(201).json({
    success: true,
    message: "Payroll created successfully",
    data: payroll,
  });
};

// GET /api/payroll
// Supported filters: employeeId, branchId, status, startDate, endDate, month, year
const getPayroll = async (req, res) => {
  const monthProvided = req.query.month !== undefined && req.query.month !== "";
  const yearProvided = req.query.year !== undefined && req.query.year !== "";

  if (monthProvided !== yearProvided) {
    throw createControllerError("Both month and year are required for payroll month filtering", 400);
  }

  const filters = {
    employeeId: getOptionalPositiveInteger(req.query.employeeId, "employee ID"),
    branchId: getOptionalPositiveInteger(req.query.branchId, "branch ID"),
    status: req.query.status,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  };

  if (monthProvided && yearProvided) {
    filters.month = getMonth(req.query.month);
    filters.year = getYear(req.query.year);
  }

  const payrolls = await payrollService.getAllPayroll(
    getCompanyId(req),
    filters
  );

  return res.status(200).json({
    success: true,
    message: "Payroll records fetched successfully",
    data: payrolls,
  });
};

// GET /api/payroll/summary?month=10&year=2026&branchId=2
const getPayrollSummary = async (req, res) => {
  const month = getMonth(req.query.month);
  const year = getYear(req.query.year);
  const branchId = getOptionalPositiveInteger(req.query.branchId, "branch ID");

  const summary = await payrollService.getPayrollSummaryByMonthYear(
    getCompanyId(req),
    month,
    year,
    { branchId }
  );

  return res.status(200).json({
    success: true,
    message: "Payroll summary fetched successfully",
    data: summary,
  });
};

// GET /api/payroll/:id
const getPayrollById = async (req, res) => {
  const payrollId = getPositiveInteger(req.params.id, "payroll ID");

  const payroll = await payrollService.getPayrollById(
    payrollId,
    getCompanyId(req)
  );

  return res.status(200).json({
    success: true,
    message: "Payroll record fetched successfully",
    data: payroll,
  });
};

// GET /api/payroll/employee/:employeeId
const getEmployeePayroll = async (req, res) => {
  const employeeId = getPositiveInteger(req.params.employeeId, "employee ID");

  const payrolls = await payrollService.getEmployeePayroll(
    employeeId,
    getCompanyId(req)
  );

  return res.status(200).json({
    success: true,
    message: "Employee payroll records fetched successfully",
    data: payrolls,
  });
};

// GET /api/payroll/my
// Kept for compatibility with employee-facing payroll routes.
const getMyPayroll = async (req, res) => {
  const employeeId = req?.user?.employeeId;
  if (!employeeId) {
    throw createControllerError(
      "Employee ID is not available for the authenticated user",
      400
    );
  }

  const payrolls = await payrollService.getMyPayroll(
    getPositiveInteger(employeeId, "employee ID"),
    getCompanyId(req)
  );

  return res.status(200).json({
    success: true,
    message: "My payroll records fetched successfully",
    data: payrolls,
  });
};

// PUT /api/payroll/:id
const updatePayroll = async (req, res) => {
  const payrollId = getPositiveInteger(req.params.id, "payroll ID");

  const payroll = await payrollService.updatePayroll(
    payrollId,
    req.body || {},
    getCompanyId(req)
  );

  return res.status(200).json({
    success: true,
    message: "Payroll updated successfully",
    data: payroll,
  });
};

// DELETE /api/payroll/:id
const deletePayroll = async (req, res) => {
  const payrollId = getPositiveInteger(req.params.id, "payroll ID");

  await payrollService.deletePayroll(
    payrollId,
    getCompanyId(req)
  );

  return res.status(200).json({
    success: true,
    message: "Payroll deleted successfully",
  });
};

// GET /api/payroll/configuration/:branchId
const getPayrollConfiguration = async (req, res) => {
  const branchId = getPositiveInteger(req.params.branchId, "branch ID");
  const configuration = await getBranchConfiguration(req, branchId);

  return res.status(200).json({
    success: true,
    message: "Payroll configuration fetched successfully",
    data: configuration,
  });
};

// PUT /api/payroll/configuration/:branchId
const updatePayrollConfiguration = async (req, res) => {
  const branchId = getPositiveInteger(req.params.branchId, "branch ID");
  const configuration = await payrollService.updateConfiguration(
    branchId,
    getCompanyId(req),
    req.body || {}
  );

  return res.status(200).json({
    success: true,
    message: "Payroll configuration updated successfully",
    data: configuration,
  });
};

const buildPeriodResponse = (configuration, period) => ({
  companyId: configuration.companyId,
  branchId: configuration.branchId,
  branchName: configuration.branchName,
  configuration: {
    startDay: configuration.startDay,
    endDay: configuration.endDay,
    paymentDay: configuration.paymentDay,
    enabled: configuration.enabled,
  },
  payPeriodStart: period.periodStart,
  payPeriodEnd: period.periodEnd,
  paymentDate: period.scheduledPaymentDate,
});

// GET /api/payroll/period/:branchId/current
const getCurrentPayrollPeriod = async (req, res) => {
  const branchId = getPositiveInteger(req.params.branchId, "branch ID");
  const configuration = await getBranchConfiguration(req, branchId);

  const period = await payrollService.getCurrentPayrollPeriod(configuration);

  return res.status(200).json({
    success: true,
    message: "Current payroll period calculated successfully",
    data: buildPeriodResponse(configuration, period),
  });
};

// GET /api/payroll/period/:branchId/next
const getNextPayrollPeriod = async (req, res) => {
  const branchId = getPositiveInteger(req.params.branchId, "branch ID");
  const configuration = await getBranchConfiguration(req, branchId);

  // IMPORTANT: the current payroll service method is async.
  const period = await payrollService.getNextPayrollPeriod(configuration);

  return res.status(200).json({
    success: true,
    message: "Next payroll period calculated successfully",
    data: buildPeriodResponse(configuration, period),
  });
};

// POST /api/payroll/generate/branch/:branchId
const generatePayrollForBranch = async (req, res) => {
  const branchId = getPositiveInteger(req.params.branchId, "branch ID");
  const body = req.body || {};

  let payPeriodStart = body.payPeriodStart;
  let payPeriodEnd = body.payPeriodEnd;

  if (!payPeriodStart || !payPeriodEnd) {
    const configuration = await getBranchConfiguration(req, branchId);

    if (!configuration.enabled) {
      throw createControllerError(
        "Automatic payroll generation is disabled for this branch",
        400
      );
    }

    const period = await payrollService.getCurrentPayrollPeriod(configuration);
    payPeriodStart = period.periodStart;
    payPeriodEnd = period.periodEnd;
  }

  const result = await payrollService.generatePayrollForBranch(
    branchId,
    payPeriodStart,
    payPeriodEnd,
    getCompanyId(req)
  );

  return res.status(201).json({
    success: true,
    message: result.message || "Branch payroll generation completed",
    data: result,
  });
};

// POST /api/payroll/generate/branch/:branchId/current
const generateCurrentBranchPayroll = async (req, res) => {
  const branchId = getPositiveInteger(req.params.branchId, "branch ID");

  const result = await payrollService.generateCurrentBranchPayroll(
    branchId,
    getCompanyId(req)
  );

  return res.status(201).json({
    success: true,
    message: result.message || "Current branch payroll generated successfully",
    data: result,
  });
};

// PATCH /api/payroll/:id/pay
const markPayrollPaid = async (req, res) => {
  const payrollId = getPositiveInteger(req.params.id, "payroll ID");

  const payroll = await payrollService.markPayrollPaid(
    payrollId,
    getCompanyId(req)
  );

  return res.status(200).json({
    success: true,
    message: "Payroll paid successfully",
    data: payroll,
  });
};

module.exports = {
  createPayroll,
  getPayroll,
  getPayrollSummary,
  getPayrollById,
  getEmployeePayroll,
  getMyPayroll,
  updatePayroll,
  deletePayroll,
  getPayrollConfiguration,
  updatePayrollConfiguration,
  getCurrentPayrollPeriod,
  getNextPayrollPeriod,
  generatePayrollForBranch,
  generateCurrentBranchPayroll,
  markPayrollPaid,
};