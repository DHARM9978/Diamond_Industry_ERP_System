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
// ==========================================

const getAllDepartments = async (
    companyId
) => {

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


    // ==========================================
    // Verify Branch
    // ==========================================

    const branch =
        await prisma.branch.findFirst({

            where: {
                branchId: Number(branchId),
                companyId: Number(companyId)
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
    // ==========================================

    let manager = null;


    if (
        managerId !== undefined &&
        managerId !== null &&
        managerId !== ""
    ) {

        manager =
            await prisma.employee.findFirst({

                where: {
                    employeeId: Number(managerId),
                    companyId: Number(companyId)
                }

            });


        if (!manager) {

            const error =
                new Error(
                    "Manager not found in your company"
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
                    Number(branchId),

                companyId:
                    Number(companyId),

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


    // ==========================================
    // Validate Branch
    // ==========================================

    if (branchId !== undefined) {

        const branch =
            await prisma.branch.findFirst({

                where: {

                    branchId:
                        Number(branchId),

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


    // ==========================================
    // Validate Manager
    // ==========================================

    if (
        managerId !== undefined &&
        managerId !== null &&
        managerId !== ""
    ) {

        const manager =
            await prisma.employee.findFirst({

                where: {

                    employeeId:
                        Number(managerId),

                    companyId:
                        company

                }

            });


        if (!manager) {

            const error =
                new Error(
                    "Manager not found in your company"
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
                        Number(branchId)

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