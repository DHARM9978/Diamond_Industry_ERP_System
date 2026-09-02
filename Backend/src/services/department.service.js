const prisma = require("../config/database");


// ==========================================
// Get Department By ID
// ==========================================

const getDepartmentById = async (departmentId, companyId) => {

    const department = await prisma.department.findFirst({
        where: {
            departmentId: Number(departmentId),
            companyId: Number(companyId)
        },
        include: {
            branch: true,
            manager: true
        }
    });

    if (!department) {
        const error = new Error("Department not found");
        error.statusCode = 404;
        throw error;
    }

    return department;
};


// ==========================================
// Get All Departments
// ==========================================

const getAllDepartments = async (companyId) => {

    return await prisma.department.findMany({
        where: {
            companyId: Number(companyId)
        },
        include: {
            branch: true,
            manager: true
        },
        orderBy: {
            departmentId: "asc"
        }
    });
};


// ==========================================
// Create Department
// ==========================================

const createDepartment = async (data, companyId) => {

    const {
        departmentName,
        branchId
    } = data;

    if (!departmentName) {
        const error = new Error("Department name is required");
        error.statusCode = 400;
        throw error;
    }

    if (!branchId) {
        const error = new Error("Branch ID is required");
        error.statusCode = 400;
        throw error;
    }

    // Make sure the branch belongs
    // to the authenticated company.

    const branch = await prisma.branch.findFirst({
        where: {
            branchId: Number(branchId),
            companyId: Number(companyId)
        }
    });

    if (!branch) {
        const error = new Error(
            "Branch not found in your company"
        );

        error.statusCode = 404;
        throw error;
    }

    const department = await prisma.department.create({
        data: {
            departmentName,
            branchId: Number(branchId),
            companyId: Number(companyId)
        }
    });

    return department;
};


// ==========================================
// Update Department
// ==========================================

const updateDepartment = async (
    departmentId,
    data,
    companyId
) => {

    const id = Number(departmentId);
    const company = Number(companyId);

    const existingDepartment =
        await prisma.department.findFirst({
            where: {
                departmentId: id,
                companyId: company
            }
        });

    if (!existingDepartment) {
        const error = new Error("Department not found");
        error.statusCode = 404;
        throw error;
    }

    const {
        departmentName,
        branchId
    } = data;

    // If branch is being changed,
    // verify that it belongs to the company.

    if (branchId !== undefined) {

        const branch = await prisma.branch.findFirst({
            where: {
                branchId: Number(branchId),
                companyId: company
            }
        });

        if (!branch) {
            const error = new Error(
                "Branch not found in your company"
            );

            error.statusCode = 404;
            throw error;
        }
    }

    const department = await prisma.department.update({
        where: {
            departmentId: id
        },
        data: {
            ...(departmentName !== undefined && {
                departmentName
            }),

            ...(branchId !== undefined && {
                branchId: Number(branchId)
            })
        }
    });

    return department;
};


// ==========================================
// Delete Department
// ==========================================

const deleteDepartment = async (
    departmentId,
    companyId
) => {

    const id = Number(departmentId);
    const company = Number(companyId);

    const existingDepartment =
        await prisma.department.findFirst({
            where: {
                departmentId: id,
                companyId: company
            }
        });

    if (!existingDepartment) {
        const error = new Error("Department not found");
        error.statusCode = 404;
        throw error;
    }

    await prisma.department.delete({
        where: {
            departmentId: id
        }
    });

    return true;
};


module.exports = {
    getDepartmentById,
    getAllDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment
};