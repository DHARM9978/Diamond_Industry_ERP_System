const employeeService = require("../services/employee.service");


// ==========================================
// Get Employee
// ==========================================

const getEmployee = async (req, res) => {

    const employee =
        await employeeService.getEmployeeById(
            req.params.id,
            req.user.companyId
        );

    return res.status(200).json({
        success: true,
        message: "Employee fetched successfully",
        data: employee
    });
};


// ==========================================
// Get All Employees
// ==========================================

const getEmployees = async (req, res) => {

    const employees =
        await employeeService.getAllEmployees(
            req.user.companyId
        );

    return res.status(200).json({
        success: true,
        message: "Employees fetched successfully",
        data: employees
    });
};


// ==========================================
// Create Employee
// ==========================================

const createEmployee = async (req, res) => {

    const employee =
        await employeeService.createEmployee(
            req.body,
            req.user.companyId
        );

    return res.status(201).json({
        success: true,
        message: "Employee created successfully",
        data: employee
    });
};


// ==========================================
// Update Employee
// ==========================================

const updateEmployee = async (req, res) => {

    const employee =
        await employeeService.updateEmployee(
            req.params.id,
            req.body,
            req.user.companyId
        );

    return res.status(200).json({
        success: true,
        message: "Employee updated successfully",
        data: employee
    });
};


// ==========================================
// Delete Employee
// ==========================================

const deleteEmployee = async (req, res) => {

    await employeeService.deleteEmployee(
        req.params.id,
        req.user.companyId
    );

    return res.status(200).json({
        success: true,
        message: "Employee deleted successfully"
    });
};


module.exports = {
    getEmployee,
    getEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee
};