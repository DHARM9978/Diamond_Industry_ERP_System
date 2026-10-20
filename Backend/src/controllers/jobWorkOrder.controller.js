
const jobWorkOrderService =
    require("../services/jobWorkOrder.service");

// ============================================================
// HELPERS
// ============================================================

function createControllerError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

// Company identity must come from authentication,
// not from a request body or query parameter.
function getCompanyId(req) {
    const companyId = Number(req?.user?.companyId);

    if (!Number.isInteger(companyId) || companyId < 1) {
        throw createControllerError(
            "Invalid company ID in authenticated user",
            401
        );
    }

    return companyId;
}

// ============================================================
// CREATE JOB WORK ORDER
//
// POST /api/job-work/orders
// ============================================================

const createJobWorkOrder = async (req, res) => {
    const companyId = getCompanyId(req);

    const adminId = req?.user?.adminId;

    if (
        adminId === undefined ||
        adminId === null ||
        adminId === ""
    ) {
        throw createControllerError(
            "Admin ID not found in authenticated user",
            401
        );
    }

    const order = await jobWorkOrderService.createJobWorkOrder(
        companyId,
        adminId,
        req.body || {}
    );

    return res.status(201).json({
        success: true,
        message: "Job work order created successfully",
        data: order
    });
};

// ============================================================
// GET ALL JOB WORK ORDERS
//
// GET /api/job-work/orders
//
// Optional query parameters:
//   search
//   status
//   orderMonth=YYYY-MM
// ============================================================

const getJobWorkOrders = async (req, res) => {
    const companyId = getCompanyId(req);

    const filters = {
        search: req.query.search,
        status: req.query.status,
        orderMonth: req.query.orderMonth
    };

    const orders = await jobWorkOrderService.getJobWorkOrders(
        companyId,
        filters
    );

    return res.status(200).json({
        success: true,
        message: "Job work orders fetched successfully",
        data: orders
    });
};

// ============================================================
// GET JOB WORK ORDER BY ID
//
// GET /api/job-work/orders/:jobWorkOrderId
// ============================================================

const getJobWorkOrderById = async (req, res) => {
    const companyId = getCompanyId(req);

    const order = await jobWorkOrderService.getJobWorkOrderById(
        companyId,
        req.params.jobWorkOrderId
    );

    return res.status(200).json({
        success: true,
        message: "Job work order fetched successfully",
        data: order
    });
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    createJobWorkOrder,
    getJobWorkOrders,
    getJobWorkOrderById
};
