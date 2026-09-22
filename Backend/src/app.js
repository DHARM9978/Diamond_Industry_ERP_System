const express = require("express");
const cors = require("cors");

const prisma = require("./config/database");

const authRoutes = require("./routes/auth.routes");
const errorHandler = require("./middleware/error.middleware");
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


const app = express();


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Routes
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

// Bonus / Extra Work Payment Routes
app.use("/api/bonuses", bonusRoutes);
app.use("/api/me/bonuses", employeeBonusRoutes);

app.use("/api/advances", advanceRoutes);
app.use("/api/leave-types", leaveTypeRoutes);
app.use("/api/leave-balances", leaveBalanceRoutes);
app.use("/api/leave-requests", leaveRequestRoutes);
app.use("/api/reports", reportRoutes);

// Public Holiday Routes
app.use("/api/holidays", publicHolidayRoutes);


// Health
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Diamond ERP Backend is running",
        timestamp: new Date().toISOString()
    });
});


// Database Health
app.get("/api/health/database", async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;

        res.status(200).json({
            success: true,
            message: "Database connection is working"
        });

    } catch (error) {
        console.error("Database connection error:", error);

        res.status(500).json({
            success: false,
            message: "Database connection failed"
        });
    }
});


// Root
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Diamond ERP API"
    });
});


// Global error handler
app.use(errorHandler);


module.exports = app;