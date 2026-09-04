const prisma = require("../config/database");


// ==================================================
// Get Company By ID
// ==================================================

const getCompanyById = async (companyId) => {
    const id = Number(companyId);

    if (!Number.isInteger(id)) {
        const error = new Error("Invalid company ID");
        error.statusCode = 400;
        throw error;
    }

    const company = await prisma.companies.findUnique({
        where: {
            company_id: id
        }
    });

    if (!company) {
        const error = new Error("Company not found");
        error.statusCode = 404;
        throw error;
    }

    return company;
};


// ==================================================
// Get All Companies
// ==================================================

const getAllCompanies = async () => {

    return await prisma.companies.findMany({
        orderBy: {
            company_id: "asc"
        }
    });
};


// ==================================================
// Create Company
// ==================================================

const createCompany = async (data) => {

    const {
        company_name,
        address,
        contact_email,
        contact_phone
    } = data;

    if (!company_name || !company_name.trim()) {
        const error = new Error(
            "Company name is required"
        );

        error.statusCode = 400;
        throw error;
    }

    const company =
        await prisma.companies.create({
            data: {
                company_name:
                    company_name.trim(),

                address:
                    address?.trim() || null,

                contact_email:
                    contact_email?.trim() || null,

                contact_phone:
                    contact_phone?.trim() || null,

                updated_at: new Date()
            }
        });

    return company;
};


// ==================================================
// Update Company
// ==================================================

const updateCompany = async (
    companyId,
    data
) => {

    const id = Number(companyId);

    if (!Number.isInteger(id)) {
        const error = new Error(
            "Invalid company ID"
        );

        error.statusCode = 400;
        throw error;
    }

    // ----------------------------------------------
    // Check company exists
    // ----------------------------------------------

    const existingCompany =
        await prisma.companies.findUnique({
            where: {
                company_id: id
            }
        });

    if (!existingCompany) {
        const error = new Error(
            "Company not found"
        );

        error.statusCode = 404;
        throw error;
    }

    // ----------------------------------------------
    // Extract allowed fields
    // ----------------------------------------------

    const {
        company_name,
        address,
        contact_email,
        contact_phone
    } = data;

    // ----------------------------------------------
    // Validate company name
    // ----------------------------------------------

    if (
        company_name !== undefined &&
        !String(company_name).trim()
    ) {
        const error = new Error(
            "Company name cannot be empty"
        );

        error.statusCode = 400;
        throw error;
    }

    // ----------------------------------------------
    // Build update object
    // ----------------------------------------------

    const updateData = {};

    if (company_name !== undefined) {
        updateData.company_name =
            String(company_name).trim();
    }

    if (address !== undefined) {
        updateData.address =
            address
                ? String(address).trim()
                : null;
    }

    if (contact_email !== undefined) {
        updateData.contact_email =
            contact_email
                ? String(contact_email).trim()
                : null;
    }

    if (contact_phone !== undefined) {
        updateData.contact_phone =
            contact_phone
                ? String(contact_phone).trim()
                : null;
    }

    /*
     * Your schema has updated_at as a required
     * DateTime field, so explicitly update it.
     */

    updateData.updated_at = new Date();

    // ----------------------------------------------
    // Update database
    // ----------------------------------------------

    const company =
        await prisma.companies.update({
            where: {
                company_id: id
            },

            data: updateData
        });

    return company;
};


// ==================================================
// Delete Company
// ==================================================

const deleteCompany = async (companyId) => {

    const id = Number(companyId);

    if (!Number.isInteger(id)) {
        const error = new Error(
            "Invalid company ID"
        );

        error.statusCode = 400;
        throw error;
    }

    const existingCompany =
        await prisma.companies.findUnique({
            where: {
                company_id: id
            }
        });

    if (!existingCompany) {
        const error = new Error(
            "Company not found"
        );

        error.statusCode = 404;
        throw error;
    }

    await prisma.companies.delete({
        where: {
            company_id: id
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