const prisma = require("../config/database");


// ==========================================
// Get Department By ID
// ==========================================

const getDepartmentById = async (
    departmentId,
    companyId
) => {

    const department =
        await prisma.department.findFirst({

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

        const error =
            new Error("Department not found");

        error.statusCode = 404;

        throw error;

    }


    return department;

};



// ==========================================
// Get All Departments
//
// Optional branchId:
// GET /api/departments
// GET /api/departments?branchId=1
// ==========================================

const getAllDepartments = async (
    companyId,
    branchId
) => {

    const company =
        Number(companyId);


    // ============================================================
    // BUILD WHERE CONDITION
    // ============================================================

    const where = {
        companyId: company
    };


    // ============================================================
    // BRANCH FILTER
    //
    // If branchId is provided, return only departments
    // belonging to that branch.
    // ============================================================

    if (
        branchId !== undefined &&
        branchId !== null &&
        branchId !== ""
    ) {

        const branch =
            Number(branchId);


        if (
            !Number.isInteger(branch) ||
            branch < 1
        ) {

            const error =
                new Error("Invalid Branch ID");

            error.statusCode = 400;

            throw error;

        }


        // --------------------------------------------------------
        // Verify branch belongs to the company
        // --------------------------------------------------------

        const existingBranch =
            await prisma.branch.findFirst({

                where: {
                    branchId: branch,
                    companyId: company
                }

            });


        if (!existingBranch) {

            const error =
                new Error(
                    "Branch not found in your company"
                );

            error.statusCode = 404;

            throw error;

        }


        where.branchId = branch;

    }


    // ============================================================
    // FETCH DEPARTMENTS
    // ============================================================

    return await prisma.department.findMany({

        where,

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

const createDepartment = async (
    data,
    companyId
) => {

    const {
        departmentName,
        branchId,
        managerId
    } = data;


    // ==========================================
    // Validate Department Name
    // ==========================================

    if (!departmentName) {

        const error =
            new Error(
                "Department name is required"
            );

        error.statusCode = 400;

        throw error;

    }


    // ==========================================
    // Validate Branch
    // ==========================================

    if (!branchId) {

        const error =
            new Error(
                "Branch ID is required"
            );

        error.statusCode = 400;

        throw error;

    }


    const branchNumber =
        Number(branchId);

    const companyNumber =
        Number(companyId);


    if (
        !Number.isInteger(branchNumber) ||
        branchNumber < 1
    ) {

        const error =
            new Error(
                "Invalid Branch ID"
            );

        error.statusCode = 400;

        throw error;

    }


    // ==========================================
    // Verify Branch
    // ==========================================

    const branch =
        await prisma.branch.findFirst({

            where: {
                branchId: branchNumber,
                companyId: companyNumber
            }

        });


    if (!branch) {

        const error =
            new Error(
                "Branch not found in your company"
            );

        error.statusCode = 404;

        throw error;

    }


    // ==========================================
    // Validate Manager
    //
    // Manager must belong to:
    // 1. Same company
    // 2. Same branch
    // ==========================================

    let manager = null;


    if (
        managerId !== undefined &&
        managerId !== null &&
        managerId !== ""
    ) {

        const managerNumber =
            Number(managerId);


        if (
            !Number.isInteger(managerNumber) ||
            managerNumber < 1
        ) {

            const error =
                new Error(
                    "Invalid Manager ID"
                );

            error.statusCode = 400;

            throw error;

        }


        manager =
            await prisma.employee.findFirst({

                where: {

                    employeeId:
                        managerNumber,

                    companyId:
                        companyNumber,

                    branchId:
                        branchNumber

                }

            });


        if (!manager) {

            const error =
                new Error(
                    "Manager not found in the selected branch"
                );

            error.statusCode = 404;

            throw error;

        }

    }


    // ==========================================
    // Create Department
    // ==========================================

    const department =
        await prisma.department.create({

            data: {

                departmentName,

                branchId:
                    branchNumber,

                companyId:
                    companyNumber,

                managerId:
                    manager
                        ? Number(managerId)
                        : null

            },

            include: {

                branch: true,

                manager: true

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

    const id =
        Number(departmentId);

    const company =
        Number(companyId);


    // ==========================================
    // Validate Department ID
    // ==========================================

    if (
        !Number.isInteger(id) ||
        id < 1
    ) {

        const error =
            new Error(
                "Invalid Department ID"
            );

        error.statusCode = 400;

        throw error;

    }


    // ==========================================
    // Find Existing Department
    // ==========================================

    const existingDepartment =
        await prisma.department.findFirst({

            where: {

                departmentId: id,

                companyId: company

            }

        });


    if (!existingDepartment) {

        const error =
            new Error(
                "Department not found"
            );

        error.statusCode = 404;

        throw error;

    }


    const {
        departmentName,
        branchId,
        managerId
    } = data;


    // ============================================================
    // DETERMINE EFFECTIVE BRANCH
    //
    // If branchId is supplied, use it.
    // Otherwise keep the existing department branch.
    // ============================================================

    const effectiveBranchId =
        branchId !== undefined &&
        branchId !== null &&
        branchId !== ""
            ? Number(branchId)
            : Number(existingDepartment.branchId);


    // ==========================================
    // Validate Effective Branch ID
    // ==========================================

    if (
        !Number.isInteger(effectiveBranchId) ||
        effectiveBranchId < 1
    ) {

        const error =
            new Error(
                "Invalid Branch ID"
            );

        error.statusCode = 400;

        throw error;

    }


    // ==========================================
    // Validate Branch
    // ==========================================

    if (
        branchId !== undefined
    ) {

        const branch =
            await prisma.branch.findFirst({

                where: {

                    branchId:
                        effectiveBranchId,

                    companyId:
                        company

                }

            });


        if (!branch) {

            const error =
                new Error(
                    "Branch not found in your company"
                );

            error.statusCode = 404;

            throw error;

        }

    }


    // ============================================================
    // Validate Manager
    //
    // Manager must belong to:
    // 1. Same company
    // 2. Effective department branch
    // ============================================================

    if (
        managerId !== undefined &&
        managerId !== null &&
        managerId !== ""
    ) {

        const managerNumber =
            Number(managerId);


        if (
            !Number.isInteger(managerNumber) ||
            managerNumber < 1
        ) {

            const error =
                new Error(
                    "Invalid Manager ID"
                );

            error.statusCode = 400;

            throw error;

        }


        const manager =
            await prisma.employee.findFirst({

                where: {

                    employeeId:
                        managerNumber,

                    companyId:
                        company,

                    branchId:
                        effectiveBranchId

                }

            });


        if (!manager) {

            const error =
                new Error(
                    "Manager not found in the selected branch"
                );

            error.statusCode = 404;

            throw error;

        }

    }


    // ==========================================
    // Update Department
    // ==========================================

    const department =
        await prisma.department.update({

            where: {

                departmentId: id

            },

            data: {

                ...(departmentName !== undefined && {

                    departmentName

                }),


                ...(branchId !== undefined && {

                    branchId:
                        effectiveBranchId

                }),


                ...(managerId !== undefined && {

                    managerId:
                        managerId === null ||
                        managerId === ""
                            ? null
                            : Number(managerId)

                })

            },

            include: {

                branch: true,

                manager: true

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

    const id =
        Number(departmentId);

    const company =
        Number(companyId);


    // ==========================================
    // Validate Department ID
    // ==========================================

    if (
        !Number.isInteger(id) ||
        id < 1
    ) {

        const error =
            new Error(
                "Invalid Department ID"
            );

        error.statusCode = 400;

        throw error;

    }


    // ==========================================
    // Find Existing Department
    // ==========================================

    const existingDepartment =
        await prisma.department.findFirst({

            where: {

                departmentId: id,

                companyId: company

            }

        });


    if (!existingDepartment) {

        const error =
            new Error(
                "Department not found"
            );

        error.statusCode = 404;

        throw error;

    }


    // ==========================================
    // Delete
    // ==========================================

    await prisma.department.delete({

        where: {

            departmentId: id

        }

    });


    return true;

};



// ==========================================
// EXPORT
// ==========================================

module.exports = {

    getDepartmentById,

    getAllDepartments,

    createDepartment,

    updateDepartment,

    deleteDepartment

};