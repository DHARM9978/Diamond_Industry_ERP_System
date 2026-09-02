const advanceService =
    require("../services/advance.service");


// ==========================================
// Create Advance
// POST /api/advances
// ==========================================

const createAdvance = async (req, res) => {

    const advance =
        await advanceService.createAdvance(
            req.body,
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
// PATCH /api/advances/:id/status
// ==========================================

// ==========================================
// Update Advance Status
// PATCH /api/advances/:id/status
// ==========================================

const updateAdvanceStatus = async (req, res) => {

    const {
        status
    } = req.body;


    const advance =
        await advanceService.updateAdvanceStatus(
            req.params.id,
            status,
            req.user.adminId,
            req.user.companyId
        );


    return res.status(200).json({

        success: true,

        message:
            "Advance status updated successfully",

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


module.exports = {

    createAdvance,
    getAdvances,
    getAdvanceById,
    getEmployeeAdvances,
    updateAdvanceStatus,
    deleteAdvance
};