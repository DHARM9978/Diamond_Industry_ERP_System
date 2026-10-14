
const express = require("express");
const cors = require("cors");

const prisma = require("./config/database");

// ============================================================
// MIDDLEWARE
// ============================================================

const errorHandler = require("./middleware/error.middleware");

// ============================================================
// EXISTING ROUTES
// ============================================================

const authRoutes = require("./routes/auth.routes");
const companyRoutes = require("./routes/company.routes");
const branchRoutes = require("./routes/branch.routes");
const departmentRoutes = require("./routes/department.routes");
const employeeRoutes = require("./routes/employee.routes");
const fingerprintRoutes = require("./routes/fingerprint.routes");
const deviceRoutes = require("./routes/device.routes");
const attendanceRoutes = require("./routes/attendance.routes");
const deviceEnrollmentRoutes = require("./routes/device-enrollment.routes");
const employeeSelfRoutes = require("./routes/employee-self.routes");
const payrollRoutes = require("./routes/payroll.routes");
const bonusRoutes = require("./routes/bonus.routes");
const employeeBonusRoutes = require("./routes/employee-bonus.routes");
const advanceRoutes = require("./routes/advance.routes");
const leaveTypeRoutes = require("./routes/leaveType.routes");
const leaveBalanceRoutes = require("./routes/leaveBalance.routes");
const leaveRequestRoutes = require("./routes/leaveRequest.routes");
const reportRoutes = require("./routes/report.routes");
const publicHolidayRoutes = require("./routes/public-holiday.routes");

// ============================================================
// DIAMOND JOB WORK ROUTES
// ============================================================

const externalProcessorRoutes = require("./routes/externalProcessor.routes");

const jobWorkProcessTypeRoutes = require(
    "./routes/jobWorkProcessType.routes"
);

// ============================================================
// EXPRESS APP
// ============================================================

const app = express();

// ============================================================
// GLOBAL MIDDLEWARE
// ============================================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// EXISTING API ROUTES
// ============================================================

app.use("/api/auth", authRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/fingerprints", fingerprintRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/device", deviceEnrollmentRoutes);
app.use("/api/me", employeeSelfRoutes);
app.use("/api/payroll", payrollRoutes);

// Bonus and extra-work payment routes.
app.use("/api/bonuses", bonusRoutes);
app.use("/api/me/bonuses", employeeBonusRoutes);

app.use("/api/advances", advanceRoutes);
app.use("/api/leave-types", leaveTypeRoutes);
app.use("/api/leave-balances", leaveBalanceRoutes);
app.use("/api/leave-requests", leaveRequestRoutes);
app.use("/api/reports", reportRoutes);

// Public holidays.
app.use("/api/holidays", publicHolidayRoutes);

// ============================================================
// DIAMOND JOB WORK API ROUTES
// ============================================================

// External Processor Master.
// Example: GET /api/job-work/processors
app.use(
    "/api/job-work/processors",
    externalProcessorRoutes
);

// Processing Type Master.
// Example: GET /api/job-work/process-types
app.use(
    "/api/job-work/process-types",
    jobWorkProcessTypeRoutes
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/api/health", (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Diamond ERP Backend is running",
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// DATABASE HEALTH CHECK
// ============================================================

app.get("/api/health/database", async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;

        return res.status(200).json({
            success: true,
            message: "Database connection is working"
        });
    } catch (error) {
        console.error("Database connection error:", error);

        return res.status(500).json({
            success: false,
            message: "Database connection failed"
        });
    }
});

// ============================================================
// ROOT
// ============================================================

app.get("/", (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Diamond ERP API"
    });
});

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use(errorHandler);

module.exports = app;
