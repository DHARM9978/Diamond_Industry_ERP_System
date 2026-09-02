const prisma = require("../config/database");


// ==========================================
// Get Company By ID
// ==========================================

const getCompanyById = async (companyId) => {

    const company = await prisma.company.findUnique({
        where: {
            companyId: Number(companyId)
        }
    });

    if (!company) {
        const error = new Error("Company not found");
        error.statusCode = 404;
        throw error;
    }

    return company;
};


// ==========================================
// Get All Companies
// ==========================================

const getAllCompanies = async () => {

    return await prisma.company.findMany({
        orderBy: {
            companyId: "asc"
        }
    });
};


// ==========================================
// Create Company
// ==========================================

const createCompany = async (data) => {

    const {
        companyName,
        address,
        contactEmail,
        contactPhone
    } = data;

    if (!companyName) {
        const error = new Error("Company name is required");
        error.statusCode = 400;
        throw error;
    }

    const company = await prisma.company.create({
        data: {
            companyName,
            address,
            contactEmail,
            contactPhone
        }
    });

    return company;
};


// ==========================================
// Update Company
// ==========================================

const updateCompany = async (companyId, data) => {

    const id = Number(companyId);

    const existingCompany = await prisma.company.findUnique({
        where: {
            companyId: id
        }
    });

    if (!existingCompany) {
        const error = new Error("Company not found");
        error.statusCode = 404;
        throw error;
    }

    const company = await prisma.company.update({
        where: {
            companyId: id
        },
        data
    });

    return company;
};


// ==========================================
// Delete Company
// ==========================================

const deleteCompany = async (companyId) => {

    const id = Number(companyId);

    const existingCompany = await prisma.company.findUnique({
        where: {
            companyId: id
        }
    });

    if (!existingCompany) {
        const error = new Error("Company not found");
        error.statusCode = 404;
        throw error;
    }

    await prisma.company.delete({
        where: {
            companyId: id
        }
    });

    return true;
};


module.exports = {
    getCompanyById,
    getAllCompanies,
    createCompany,
    updateCompany,
    deleteCompany
};