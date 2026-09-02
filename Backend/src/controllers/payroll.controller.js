const payrollService =
    require("../services/payroll.service");


// ==========================================
// Create Payroll
// POST /api/payroll
// ==========================================

const createPayroll = async (req, res) => {

    const payroll =
        await payrollService.createPayroll(
            req.body,
            req.user.companyId
        );

    return res.status(201).json({

        success: true,

        message:
            "Payroll created successfully",

        data: payroll
    });
};


// ==========================================
// Get All Payroll
// GET /api/payroll
// ==========================================

const getPayroll = async (req, res) => {

    const payrolls =
        await payrollService.getAllPayroll(
            req.user.companyId
        );

    return res.status(200).json({

        success: true,

        message:
            "Payroll records fetched successfully",

        data: payrolls
    });
};


// ==========================================
// Get Payroll By ID
// GET /api/payroll/:id
// ==========================================

const getPayrollById = async (req, res) => {

    const payroll =
        await payrollService.getPayrollById(
            req.params.id,
            req.user.companyId
        );

    return res.status(200).json({

        success: true,

        message:
            "Payroll record fetched successfully",

        data: payroll
    });
};


// ==========================================
// Get Employee Payroll
// GET /api/payroll/employee/:employeeId
// ==========================================

const getEmployeePayroll = async (req, res) => {

    const payrolls =
        await payrollService.getEmployeePayroll(
            req.params.employeeId,
            req.user.companyId
        );

    return res.status(200).json({

        success: true,

        message:
            "Employee payroll records fetched successfully",

        data: payrolls
    });
};


// ==========================================
// Update Payroll
// PUT /api/payroll/:id
// ==========================================

const updatePayroll = async (req, res) => {

    const payroll =
        await payrollService.updatePayroll(
            req.params.id,
            req.body,
            req.user.companyId
        );

    return res.status(200).json({

        success: true,

        message:
            "Payroll updated successfully",

        data: payroll
    });
};


// ==========================================
// Delete Payroll
// DELETE /api/payroll/:id
// ==========================================

const deletePayroll = async (req, res) => {

    await payrollService.deletePayroll(
        req.params.id,
        req.user.companyId
    );

    return res.status(200).json({

        success: true,

        message:
            "Payroll deleted successfully"
    });
};


module.exports = {

    createPayroll,
    getPayroll,
    getPayrollById,
    getEmployeePayroll,
    updatePayroll,
    deletePayroll
};