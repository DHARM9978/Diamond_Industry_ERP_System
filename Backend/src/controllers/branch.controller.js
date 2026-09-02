const branchService = require("../services/branch.service");


// ==========================================
// Get Branch
// ==========================================

const getBranch = async (req, res) => {

    const branch = await branchService.getBranchById(
        req.params.id,
        req.user.companyId
    );

    return res.status(200).json({
        success: true,
        message: "Branch fetched successfully",
        data: branch
    });
};


// ==========================================
// Get All Branches
// ==========================================

const getBranches = async (req, res) => {

    const branches = await branchService.getAllBranches(
        req.user.companyId
    );

    return res.status(200).json({
        success: true,
        message: "Branches fetched successfully",
        data: branches
    });
};


// ==========================================
// Create Branch
// ==========================================

const createBranch = async (req, res) => {

    const branch = await branchService.createBranch(
        req.body,
        req.user.companyId
    );

    return res.status(201).json({
        success: true,
        message: "Branch created successfully",
        data: branch
    });
};


// ==========================================
// Update Branch
// ==========================================

const updateBranch = async (req, res) => {

    const branch = await branchService.updateBranch(
        req.params.id,
        req.body,
        req.user.companyId
    );

    return res.status(200).json({
        success: true,
        message: "Branch updated successfully",
        data: branch
    });
};


// ==========================================
// Delete Branch
// ==========================================

const deleteBranch = async (req, res) => {

    await branchService.deleteBranch(
        req.params.id,
        req.user.companyId
    );

    return res.status(200).json({
        success: true,
        message: "Branch deleted successfully"
    });
};


module.exports = {
    getBranch,
    getBranches,
    createBranch,
    updateBranch,
    deleteBranch
};