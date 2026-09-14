const payrollService =
    require("../services/payroll.service");


// ============================================================
// CREATE PAYROLL
//
// POST /api/payroll
// ============================================================

const createPayroll = async (
    req,
    res
) => {

    const payroll =
        await payrollService.createPayroll(
            req.body || {},
            req.user.companyId
        );

    return res.status(201).json({

        success:
            true,

        message:
            "Payroll created successfully",

        data:
            payroll

    });

};


// ============================================================
// GET ALL PAYROLL
//
// GET /api/payroll
//
// Optional query parameters:
//
// employeeId
// branchId
// status
// startDate
// endDate
//
// Example:
//
// GET /api/payroll?status=UNPAID
// GET /api/payroll?status=PAID
// GET /api/payroll?employeeId=12
// GET /api/payroll?branchId=2
// ============================================================

const getPayroll = async (
    req,
    res
) => {

    const filters = {

        employeeId:
            req.query.employeeId,

        branchId:
            req.query.branchId,

        status:
            req.query.status,

        startDate:
            req.query.startDate,

        endDate:
            req.query.endDate

    };


    const payrolls =
        await payrollService.getAllPayroll(
            req.user.companyId,
            filters
        );


    return res.status(200).json({

        success:
            true,

        message:
            "Payroll records fetched successfully",

        data:
            payrolls

    });

};


// ============================================================
// GET PAYROLL BY ID
//
// GET /api/payroll/:id
// ============================================================

const getPayrollById = async (
    req,
    res
) => {

    const payroll =
        await payrollService.getPayrollById(
            req.params.id,
            req.user.companyId
        );


    return res.status(200).json({

        success:
            true,

        message:
            "Payroll record fetched successfully",

        data:
            payroll

    });

};


// ============================================================
// GET PAYROLL FOR EMPLOYEE
//
// GET /api/payroll/employee/:employeeId
// ============================================================

const getEmployeePayroll = async (
    req,
    res
) => {

    const payrolls =
        await payrollService.getEmployeePayroll(
            req.params.employeeId,
            req.user.companyId
        );


    return res.status(200).json({

        success:
            true,

        message:
            "Employee payroll records fetched successfully",

        data:
            payrolls

    });

};


// ============================================================
// GET MY PAYROLL
//
// This controller can be used by an employee-facing route
// if the authenticated employee ID is available in req.user.
//
// GET /api/payroll/my
// ============================================================

const getMyPayroll = async (
    req,
    res
) => {

    const employeeId =
        req.user.employeeId;


    if (
        !employeeId
    ) {

        const error =
            new Error(
                "Employee ID is not available for the authenticated user"
            );

        error.statusCode =
            400;

        throw error;
    }


    const payrolls =
        await payrollService.getMyPayroll(
            employeeId,
            req.user.companyId
        );


    return res.status(200).json({

        success:
            true,

        message:
            "My payroll records fetched successfully",

        data:
            payrolls

    });

};


// ============================================================
// UPDATE PAYROLL
//
// PUT /api/payroll/:id
//
// Important:
// Paid payroll cannot be modified.
// ============================================================

const updatePayroll = async (
    req,
    res
) => {

    const payroll =
        await payrollService.updatePayroll(
            req.params.id,
            req.body || {},
            req.user.companyId
        );


    return res.status(200).json({

        success:
            true,

        message:
            "Payroll updated successfully",

        data:
            payroll

    });

};


// ============================================================
// DELETE PAYROLL
//
// DELETE /api/payroll/:id
//
// Important:
// Paid payroll cannot be deleted.
// ============================================================

const deletePayroll = async (
    req,
    res
) => {

    await payrollService.deletePayroll(
        req.params.id,
        req.user.companyId
    );


    return res.status(200).json({

        success:
            true,

        message:
            "Payroll deleted successfully"

    });

};


// ============================================================
// GET PAYROLL CONFIGURATION
//
// GET /api/payroll/configuration/:branchId
//
// Configuration:
//
// startDay
// endDay
// paymentDay
// enabled
//
// Default:
//
// startDay   = 1
// endDay     = 0
// paymentDay = 5
// enabled    = true
//
// endDay = 0 means the last day of the month.
// ============================================================

const getPayrollConfiguration = async (
    req,
    res
) => {

    const branchId =
        Number(
            req.params.branchId
        );


    if (
        !Number.isInteger(
            branchId
        ) ||
        branchId < 1
    ) {

        const error =
            new Error(
                "Invalid branch ID"
            );

        error.statusCode =
            400;

        throw error;
    }


    const configuration =
        await payrollService.getPayrollConfiguration(
            branchId,
            req.user.companyId
        );


    return res.status(200).json({

        success:
            true,

        message:
            "Payroll configuration fetched successfully",

        data:
            configuration

    });

};


// ============================================================
// UPDATE PAYROLL CONFIGURATION
//
// PUT /api/payroll/configuration/:branchId
//
// Body:
//
// {
//     "startDay": 1,
//     "endDay": 0,
//     "paymentDay": 5,
//     "enabled": true
// }
//
// ============================================================

const updatePayrollConfiguration = async (
    req,
    res
) => {

    const branchId =
        Number(
            req.params.branchId
        );


    if (
        !Number.isInteger(
            branchId
        ) ||
        branchId < 1
    ) {

        const error =
            new Error(
                "Invalid branch ID"
            );

        error.statusCode =
            400;

        throw error;
    }


    const configuration =
        await payrollService.updateConfiguration(
            branchId,
            req.user.companyId,
            req.body || {}
        );


    return res.status(200).json({

        success:
            true,

        message:
            "Payroll configuration updated successfully",

        data:
            configuration

    });

};


// ============================================================
// GET CURRENT PAYROLL PERIOD
//
// GET /api/payroll/period/:branchId/current
//
// Example:
//
// Configuration:
//
// startDay   = 1
// endDay     = 0
// paymentDay = 5
//
// Current period:
//
// 01-Sep-2026 → 30-Sep-2026
//
// Payment:
//
// 05-Oct-2026
// ============================================================

const getCurrentPayrollPeriod = async (
    req,
    res
) => {

    const branchId =
        Number(
            req.params.branchId
        );


    if (
        !Number.isInteger(
            branchId
        ) ||
        branchId < 1
    ) {

        const error =
            new Error(
                "Invalid branch ID"
            );

        error.statusCode =
            400;

        throw error;
    }


    const configuration =
        await payrollService.getPayrollConfiguration(
            branchId,
            req.user.companyId
        );


    const period =
        await payrollService.getCurrentPayrollPeriod(
            configuration
        );


    return res.status(200).json({

        success:
            true,

        message:
            "Current payroll period calculated successfully",

        data: {

            companyId:
                configuration.companyId,

            branchId:
                configuration.branchId,

            branchName:
                configuration.branchName,

            configuration: {

                startDay:
                    configuration.startDay,

                endDay:
                    configuration.endDay,

                paymentDay:
                    configuration.paymentDay,

                enabled:
                    configuration.enabled

            },

            payPeriodStart:
                period.periodStart,

            payPeriodEnd:
                period.periodEnd,

            paymentDate:
                period.scheduledPaymentDate

        }

    });

};


// ============================================================
// GET NEXT PAYROLL PERIOD
//
// GET /api/payroll/period/:branchId/next
//
// Used by the admin UI to preview the next payroll cycle.
// ============================================================

const getNextPayrollPeriod = async (
    req,
    res
) => {

    const branchId =
        Number(
            req.params.branchId
        );


    if (
        !Number.isInteger(
            branchId
        ) ||
        branchId < 1
    ) {

        const error =
            new Error(
                "Invalid branch ID"
            );

        error.statusCode =
            400;

        throw error;
    }


    const configuration =
        await payrollService.getPayrollConfiguration(
            branchId,
            req.user.companyId
        );


    const period =
        await payrollService.getNextPayrollPeriod(
            configuration
        );


    return res.status(200).json({

        success:
            true,

        message:
            "Next payroll period calculated successfully",

        data: {

            companyId:
                configuration.companyId,

            branchId:
                configuration.branchId,

            branchName:
                configuration.branchName,

            configuration: {

                startDay:
                    configuration.startDay,

                endDay:
                    configuration.endDay,

                paymentDay:
                    configuration.paymentDay,

                enabled:
                    configuration.enabled

            },

            payPeriodStart:
                period.periodStart,

            payPeriodEnd:
                period.periodEnd,

            paymentDate:
                period.scheduledPaymentDate

        }

    });

};


// ============================================================
// GENERATE PAYROLL FOR BRANCH
//
// POST /api/payroll/generate/branch/:branchId
//
// Body:
//
// {
//     "payPeriodStart": "2026-09-01",
//     "payPeriodEnd": "2026-09-30",
//     "paymentDate": "2026-10-05"
// }
//
// If the period is omitted, the current configured period
// is automatically calculated.
// ============================================================

const generatePayrollForBranch = async (
    req,
    res
) => {

    const branchId =
        Number(
            req.params.branchId
        );


    if (
        !Number.isInteger(
            branchId
        ) ||
        branchId < 1
    ) {

        const error =
            new Error(
                "Invalid branch ID"
            );

        error.statusCode =
            400;

        throw error;
    }


    const body =
        req.body || {};


    let period = {

        payPeriodStart:
            body.payPeriodStart,

        payPeriodEnd:
            body.payPeriodEnd,

        paymentDate:
            body.paymentDate

    };


    // ========================================================
    // Automatically determine current configured period
    // when dates were not supplied.
    // ========================================================

    if (
        !period.payPeriodStart ||
        !period.payPeriodEnd
    ) {

        const configuration =
            await payrollService.getPayrollConfiguration(
                branchId,
                req.user.companyId
            );


        if (
            !configuration.enabled
        ) {

            const error =
                new Error(
                    "Automatic payroll generation is disabled for this branch"
                );

            error.statusCode =
                400;

            throw error;
        }


        const configuredPeriod =
            await payrollService.getCurrentPayrollPeriod(
                configuration
            );


        period = {

            payPeriodStart:
                configuredPeriod.periodStart,

            payPeriodEnd:
                configuredPeriod.periodEnd,

            paymentDate:
                configuredPeriod.scheduledPaymentDate

        };

    }


    const result =
        await payrollService.generatePayrollForBranch(
            branchId,
            period.payPeriodStart,
            period.payPeriodEnd,
            req.user.companyId
        );


    return res.status(201).json({
        success: true,

        message:
            result.message ||
            "Branch payroll generation completed",

        data:
            result
    });

};


// ============================================================
// GENERATE CURRENT PAYROLL FOR BRANCH
//
// POST /api/payroll/generate/branch/:branchId/current
//
// This endpoint is used by the Admin Payroll page.
//
// Flow:
//
// Click Generate Current Payroll
//          ↓
// Get branch configuration
//          ↓
// Calculate current payroll period
//          ↓
// Generate payroll for active employees
//          ↓
// Create UNPAID payroll records
// ============================================================

const generateCurrentBranchPayroll = async (
    req,
    res
) => {

    const branchId =
        Number(
            req.params.branchId
        );


    if (
        !Number.isInteger(
            branchId
        ) ||
        branchId < 1
    ) {

        const error =
            new Error(
                "Invalid branch ID"
            );

        error.statusCode =
            400;

        throw error;
    }


    const configuration =
        await payrollService.getPayrollConfiguration(
            branchId,
            req.user.companyId
        );


    if (
        !configuration.enabled
    ) {

        const error =
            new Error(
                "Automatic payroll generation is disabled for this branch"
            );

        error.statusCode =
            400;

        throw error;
    }


    const period =
        await payrollService.getCurrentPayrollPeriod(
            configuration
        );


    const result =
        await payrollService.generatePayrollForBranch(
            branchId,
            period.periodStart,
            period.periodEnd,
            req.user.companyId
        );


    return res.status(201).json({

        success:
            true,

        message:
            "Current branch payroll generated successfully",

        data:
            result

    });

};


// ============================================================
// MARK PAYROLL AS PAID
//
// PATCH /api/payroll/:id/pay
//
// Business rules:
//
// 1. Payroll must exist.
// 2. Payroll must belong to admin's company.
// 3. Payroll must currently be UNPAID.
// 4. Current date must be on/after scheduled payment date.
// 5. Latest paid advances are calculated.
// 6. Advance deduction is finalized.
// 7. Net salary is finalized.
// 8. Status becomes PAID.
// 9. Actual paymentDate is stored.
// 10. Historical payroll remains locked.
// ============================================================

const markPayrollPaid = async (
    req,
    res
) => {

    const payrollId =
        Number(
            req.params.id
        );


    if (
        !Number.isInteger(
            payrollId
        ) ||
        payrollId < 1
    ) {

        const error =
            new Error(
                "Invalid payroll ID"
            );

        error.statusCode =
            400;

        throw error;
    }


    const payroll =
        await payrollService.markPayrollPaid(
            payrollId,
            req.user.companyId
        );


    return res.status(200).json({

        success:
            true,

        message:
            "Payroll paid successfully",

        data:
            payroll

    });

};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    // Payroll CRUD
    createPayroll,

    getPayroll,

    getPayrollById,

    getEmployeePayroll,

    getMyPayroll,

    updatePayroll,

    deletePayroll,


    // Payroll configuration
    getPayrollConfiguration,

    updatePayrollConfiguration,


    // Payroll periods
    getCurrentPayrollPeriod,

    getNextPayrollPeriod,


    // Payroll generation
    generatePayrollForBranch,

    generateCurrentBranchPayroll,


    // Payroll payment
    markPayrollPaid

};