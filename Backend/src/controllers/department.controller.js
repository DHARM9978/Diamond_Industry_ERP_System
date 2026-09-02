const departmentService = require("../services/department.service");


// ==========================================
// Get Department
// ==========================================

const getDepartment = async (req, res) => {

    const department =
        await departmentService.getDepartmentById(
            req.params.id,
            req.user.companyId
        );

    return res.status(200).json({
        success: true,
        message: "Department fetched successfully",
        data: department
    });
};


// ==========================================
// Get All Departments
// ==========================================

const getDepartments = async (req, res) => {

    const departments =
        await departmentService.getAllDepartments(
            req.user.companyId
        );

    return res.status(200).json({
        success: true,
        message: "Departments fetched successfully",
        data: departments
    });
};


// ==========================================
// Create Department
// ==========================================

const createDepartment = async (req, res) => {

    const department =
        await departmentService.createDepartment(
            req.body,
            req.user.companyId
        );

    return res.status(201).json({
        success: true,
        message: "Department created successfully",
        data: department
    });
};


// ==========================================
// Update Department
// ==========================================

const updateDepartment = async (req, res) => {

    const department =
        await departmentService.updateDepartment(
            req.params.id,
            req.body,
            req.user.companyId
        );

    return res.status(200).json({
        success: true,
        message: "Department updated successfully",
        data: department
    });
};


// ==========================================
// Delete Department
// ==========================================

const deleteDepartment = async (req, res) => {

    await departmentService.deleteDepartment(
        req.params.id,
        req.user.companyId
    );

    return res.status(200).json({
        success: true,
        message: "Department deleted successfully"
    });
};


module.exports = {
    getDepartment,
    getDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment
};