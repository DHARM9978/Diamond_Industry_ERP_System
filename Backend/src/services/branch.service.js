const prisma = require("../config/database");


// ==========================================
// Get Branch By ID
// ==========================================

const getBranchById = async (branchId, companyId) => {

    const branch = await prisma.branch.findFirst({
        where: {
            branchId: Number(branchId),
            companyId: Number(companyId)
        }
    });

    if (!branch) {
        const error = new Error("Branch not found");
        error.statusCode = 404;
        throw error;
    }

    return branch;
};


// ==========================================
// Get All Branches
// ==========================================

const getAllBranches = async (companyId) => {

    return await prisma.branch.findMany({
        where: {
            companyId: Number(companyId)
        },
        orderBy: {
            branchId: "asc"
        }
    });
};


// ==========================================
// Create Branch
// ==========================================

const createBranch = async (data, companyId) => {

    const {
        branchName,
        location
    } = data;

    if (!branchName) {
        const error = new Error("Branch name is required");
        error.statusCode = 400;
        throw error;
    }

    const branch = await prisma.branch.create({
        data: {
            branchName,
            location,
            companyId: Number(companyId)
        }
    });

    return branch;
};


// ==========================================
// Update Branch
// ==========================================

const updateBranch = async (branchId, data, companyId) => {

    const id = Number(branchId);
    const company = Number(companyId);

    const existingBranch = await prisma.branch.findFirst({
        where: {
            branchId: id,
            companyId: company
        }
    });

    if (!existingBranch) {
        const error = new Error("Branch not found");
        error.statusCode = 404;
        throw error;
    }

    const {
        branchName,
        location
    } = data;

    const branch = await prisma.branch.update({
        where: {
            branchId: id
        },
        data: {
            ...(branchName !== undefined && { branchName }),
            ...(location !== undefined && { location })
        }
    });

    return branch;
};


// ==========================================
// Delete Branch
// ==========================================

const deleteBranch = async (branchId, companyId) => {

    const id = Number(branchId);
    const company = Number(companyId);

    const existingBranch = await prisma.branch.findFirst({
        where: {
            branchId: id,
            companyId: company
        }
    });

    if (!existingBranch) {
        const error = new Error("Branch not found");
        error.statusCode = 404;
        throw error;
    }

    await prisma.branch.delete({
        where: {
            branchId: id
        }
    });

    return true;
};


module.exports = {
    getBranchById,
    getAllBranches,
    createBranch,
    updateBranch,
    deleteBranch
};