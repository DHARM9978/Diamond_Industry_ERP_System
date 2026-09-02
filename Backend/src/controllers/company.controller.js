const companyService = require("../services/company.service");


// ==========================================
// Get Company
// ==========================================

const getCompany = async (req, res) => {

    const company = await companyService.getCompanyById(
        req.params.id
    );

    return res.status(200).json({
        success: true,
        message: "Company fetched successfully",
        data: company
    });
};


// ==========================================
// Get All Companies
// ==========================================

const getCompanies = async (req, res) => {

    const companies = await companyService.getAllCompanies();

    return res.status(200).json({
        success: true,
        message: "Companies fetched successfully",
        data: companies
    });
};


// ==========================================
// Create Company
// ==========================================

const createCompany = async (req, res) => {

    const company = await companyService.createCompany(
        req.body
    );

    return res.status(201).json({
        success: true,
        message: "Company created successfully",
        data: company
    });
};


// ==========================================
// Update Company
// ==========================================

const updateCompany = async (req, res) => {

    const company = await companyService.updateCompany(
        req.params.id,
        req.body
    );

    return res.status(200).json({
        success: true,
        message: "Company updated successfully",
        data: company
    });
};


// ==========================================
// Delete Company
// ==========================================

const deleteCompany = async (req, res) => {

    await companyService.deleteCompany(
        req.params.id
    );

    return res.status(200).json({
        success: true,
        message: "Company deleted successfully"
    });
};


module.exports = {
    getCompany,
    getCompanies,
    createCompany,
    updateCompany,
    deleteCompany
};