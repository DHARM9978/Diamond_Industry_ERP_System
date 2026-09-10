const advanceService =
    require("../services/advance.service");


// ==========================================
// Create Advance
// POST /api/advances
// ==========================================

const createAdvance = async (req, res) => {

    const advance =
        await advanceService.createAdvance(
            req.body || {},
            req.user.companyId
        );

    return res.status(201).json({

        success: true,

        message:
            "Advance payment created successfully",

        data: advance

    });
};


// ==========================================
// Get All Advances
// GET /api/advances
// ==========================================

const getAdvances = async (req, res) => {

    const advances =
        await advanceService.getAllAdvances(
            req.user.companyId
        );

    return res.status(200).json({

        success: true,

        message:
            "Advance payments fetched successfully",

        data: advances

    });
};


// ==========================================
// Get Advance By ID
// GET /api/advances/:id
// ==========================================

const getAdvanceById = async (req, res) => {

    const advance =
        await advanceService.getAdvanceById(
            req.params.id,
            req.user.companyId
        );

    return res.status(200).json({

        success: true,

        message:
            "Advance payment fetched successfully",

        data: advance

    });
};


// ==========================================
// Get Employee Advances
// GET /api/advances/employee/:employeeId
// ==========================================

const getEmployeeAdvances = async (req, res) => {

    const advances =
        await advanceService.getEmployeeAdvances(
            req.params.employeeId,
            req.user.companyId
        );

    return res.status(200).json({

        success: true,

        message:
            "Employee advance payments fetched successfully",

        data: advances

    });
};


// ==========================================
// Update Advance Status
//
// PATCH /api/advances/:id/status
//
// Body examples:
//
// APPROVE:
// {
//   "status": "APPROVED",
//   "approvedAmount": 1000
// }
//
// PAY:
// {
//   "status": "PAID",
//   "paidAmount": 1500
// }
//
// REJECT:
// {
//   "status": "REJECTED"
// }
// ==========================================

const updateAdvanceStatus = async (req, res) => {

    const body =
        req.body || {};

    const {
        status,
        approvedAmount,
        paidAmount
    } = body;


    const advance =
        await advanceService.updateAdvanceStatus(
            req.params.id,
            status,
            req.user.adminId,
            req.user.companyId,
            {
                approvedAmount,
                paidAmount
            }
        );


    let message =
        "Advance status updated successfully";


    if (String(status).toUpperCase() === "APPROVED") {

        message =
            "Advance approved successfully";

    } else if (
        String(status).toUpperCase() === "PAID"
    ) {

        message =
            "Advance payment recorded successfully";

    } else if (
        String(status).toUpperCase() === "REJECTED"
    ) {

        message =
            "Advance rejected successfully";
    }


    return res.status(200).json({

        success: true,

        message,

        data: advance

    });
};


// ==========================================
// Delete Advance
// DELETE /api/advances/:id
// ==========================================

const deleteAdvance = async (req, res) => {

    await advanceService.deleteAdvance(
        req.params.id,
        req.user.companyId
    );

    return res.status(200).json({

        success: true,

        message:
            "Advance payment deleted successfully"

    });
};


// ==========================================
// Export Controller
// ==========================================

module.exports = {

    createAdvance,
    getAdvances,
    getAdvanceById,
    getEmployeeAdvances,
    updateAdvanceStatus,
    deleteAdvance

};