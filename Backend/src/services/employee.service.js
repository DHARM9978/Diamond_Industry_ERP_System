const bcrypt = require("bcrypt");

const prisma = require("../config/database");


// ==========================================
// Salary Helpers
// ==========================================

const toPositiveNumber = (value, fieldName) => {
    const numberValue = Number(value);

    if (
        value === undefined ||
        value === null ||
        value === "" ||
        !Number.isFinite(numberValue) ||
        numberValue <= 0
    ) {
        const error = new Error(
            `${fieldName} must be greater than 0`
        );

        error.statusCode = 400;

        throw error;
    }

    return numberValue;
};


const calculateHourlyRate = (
    baseSalary,
    monthlyExpectedHours
) => {
    const salary = toPositiveNumber(
        baseSalary,
        "Base salary"
    );

    const expectedHours = toPositiveNumber(
        monthlyExpectedHours,
        "Monthly expected hours"
    );

    return Number(
        (salary / expectedHours).toFixed(2)
    );
};


// ==========================================
// Get Employee By ID
// ==========================================

const getEmployeeById = async (
    employeeId,
    companyId
) => {
    const employee =
        await prisma.employee.findFirst({
            where: {
                employeeId: Number(employeeId),
                companyId: Number(companyId)
            },

            include: {
                branch: true,
                department: true,
                manager: true
            }
        });

    if (!employee) {
        const error = new Error(
            "Employee not found"
        );

        error.statusCode = 404;

        throw error;
    }

    // Never return password hash
    const {
        passwordHash,
        ...safeEmployee
    } = employee;

    return safeEmployee;
};


// ==========================================
// Get All Employees
// ==========================================

const getAllEmployees = async (
    companyId
) => {
    const employees =
        await prisma.employee.findMany({
            where: {
                companyId: Number(companyId)
            },

            include: {
                branch: true,
                department: true,
                manager: true
            },

            orderBy: {
                employeeId: "asc"
            }
        });

    // Remove password hashes
    return employees.map((employee) => {
        const {
            passwordHash,
            ...safeEmployee
        } = employee;

        return safeEmployee;
    });
};


// ==========================================
// Create Employee
// ==========================================

const createEmployee = async (
    data,
    companyId
) => {
    const {
        firstName,
        lastName,
        gender,
        email,
        phone,
        hireDate,
        role,

        // New salary inputs
        baseSalary,
        monthlyExpectedHours,

        branchId,
        departmentId,
        managerId,
        status
    } = data;


    // ======================================
    // Required fields
    // ======================================

    if (!firstName) {
        const error = new Error(
            "First name is required"
        );

        error.statusCode = 400;

        throw error;
    }

    if (!lastName) {
        const error = new Error(
            "Last name is required"
        );

        error.statusCode = 400;

        throw error;
    }

    if (!email) {
        const error = new Error(
            "Email is required"
        );

        error.statusCode = 400;

        throw error;
    }

    if (!role) {
        const error = new Error(
            "Role is required"
        );

        error.statusCode = 400;

        throw error;
    }

    if (!branchId) {
        const error = new Error(
            "Branch ID is required"
        );

        error.statusCode = 400;

        throw error;
    }


    // ======================================
    // Salary Configuration
    // ======================================

    const finalBaseSalary =
        toPositiveNumber(
            baseSalary,
            "Base salary"
        );

    const finalMonthlyExpectedHours =
        toPositiveNumber(
            monthlyExpectedHours,
            "Monthly expected hours"
        );

    const salaryRatePerHour =
        calculateHourlyRate(
            finalBaseSalary,
            finalMonthlyExpectedHours
        );


    // ======================================
    // Check duplicate email
    // ======================================

    const existingEmployee =
        await prisma.employee.findUnique({
            where: {
                email
            }
        });

    if (existingEmployee) {
        const error = new Error(
            "An employee with this email already exists"
        );

        error.statusCode = 409;

        throw error;
    }


    // ======================================
    // Verify branch
    // ======================================

    const branch =
        await prisma.branch.findFirst({
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


    // ======================================
    // Verify department
    // ======================================

    if (
        departmentId !== undefined &&
        departmentId !== null
    ) {
        const department =
            await prisma.department.findFirst({
                where: {
                    departmentId:
                        Number(departmentId),

                    companyId:
                        Number(companyId),

                    branchId:
                        Number(branchId)
                }
            });

        if (!department) {
            const error = new Error(
                "Department does not belong to the selected branch"
            );

            error.statusCode = 400;

            throw error;
        }
    }


    // ======================================
    // Verify manager
    // ======================================

    if (
        managerId !== undefined &&
        managerId !== null
    ) {
        const manager =
            await prisma.employee.findFirst({
                where: {
                    employeeId:
                        Number(managerId),

                    companyId:
                        Number(companyId)
                }
            });

        if (!manager) {
            const error = new Error(
                "Manager not found in your company"
            );

            error.statusCode = 404;

            throw error;
        }
    }


    // ======================================
    // Generate initial password
    // ======================================

    const defaultPassword =
        process.env.DEFAULT_EMPLOYEE_PASSWORD ||
        "Employee@123";

    const passwordHash =
        await bcrypt.hash(
            defaultPassword,
            12
        );


    // ======================================
    // Create employee
    // ======================================

    const employee =
        await prisma.employee.create({
            data: {
                firstName,
                lastName,
                gender,
                email,
                phone,

                hireDate: hireDate
                    ? new Date(hireDate)
                    : null,

                role,

                // Salary configuration
                baseSalary:
                    finalBaseSalary,

                monthlyExpectedHours:
                    finalMonthlyExpectedHours,

                // Automatically calculated
                salaryRatePerHour,

                companyId:
                    Number(companyId),

                branchId:
                    Number(branchId),

                departmentId:
                    departmentId !== undefined &&
                    departmentId !== null
                        ? Number(departmentId)
                        : null,

                managerId:
                    managerId !== undefined &&
                    managerId !== null
                        ? Number(managerId)
                        : null,

                status:
                    status || "ACTIVE",

                passwordHash
            }
        });


    // ======================================
    // Remove password hash from response
    // ======================================

    const {
        passwordHash:
            ignoredPasswordHash,
        ...safeEmployee
    } = employee;


    return {
        ...safeEmployee,

        // Temporary response for development.
        // Remove this in production.
        defaultPassword
    };
};


// ==========================================
// Update Employee
// ==========================================

const updateEmployee = async (
    employeeId,
    data,
    companyId
) => {
    const id =
        Number(employeeId);

    const company =
        Number(companyId);


    // ======================================
    // Find employee
    // ======================================

    const existingEmployee =
        await prisma.employee.findFirst({
            where: {
                employeeId: id,
                companyId: company
            }
        });

    if (!existingEmployee) {
        const error = new Error(
            "Employee not found"
        );

        error.statusCode = 404;

        throw error;
    }


    const {
        firstName,
        lastName,
        gender,
        email,
        phone,
        hireDate,
        role,

        // New salary fields
        baseSalary,
        monthlyExpectedHours,

        branchId,
        departmentId,
        managerId,
        status
    } = data;


    // ======================================
    // Email uniqueness
    // ======================================

    if (
        email !== undefined &&
        email !== existingEmployee.email
    ) {
        const emailExists =
            await prisma.employee.findUnique({
                where: {
                    email
                }
            });

        if (emailExists) {
            const error = new Error(
                "An employee with this email already exists"
            );

            error.statusCode = 409;

            throw error;
        }
    }


    // ======================================
    // Salary update handling
    // ======================================

    const salaryUpdateRequested =
        baseSalary !== undefined ||
        monthlyExpectedHours !== undefined;


    let calculatedBaseSalary =
        existingEmployee.baseSalary;

    let calculatedMonthlyExpectedHours =
        existingEmployee.monthlyExpectedHours;

    let calculatedSalaryRatePerHour =
        existingEmployee.salaryRatePerHour;


    if (salaryUpdateRequested) {

        // Both values are required when
        // changing salary configuration.
        if (
            baseSalary === undefined ||
            monthlyExpectedHours === undefined
        ) {
            const error = new Error(
                "Base salary and monthly expected hours are both required when updating salary"
            );

            error.statusCode = 400;

            throw error;
        }


        calculatedBaseSalary =
            toPositiveNumber(
                baseSalary,
                "Base salary"
            );


        calculatedMonthlyExpectedHours =
            toPositiveNumber(
                monthlyExpectedHours,
                "Monthly expected hours"
            );


        calculatedSalaryRatePerHour =
            calculateHourlyRate(
                calculatedBaseSalary,
                calculatedMonthlyExpectedHours
            );
    }


    // ======================================
    // Determine branch
    // ======================================

    const finalBranchId =
        branchId !== undefined
            ? Number(branchId)
            : existingEmployee.branchId;


    // ======================================
    // Verify branch
    // ======================================

    if (
        branchId !== undefined
    ) {
        const branch =
            await prisma.branch.findFirst({
                where: {
                    branchId:
                        finalBranchId,

                    companyId:
                        company
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


    // ======================================
    // Verify department
    // ======================================

    if (
        departmentId !== undefined &&
        departmentId !== null
    ) {
        const department =
            await prisma.department.findFirst({
                where: {
                    departmentId:
                        Number(departmentId),

                    companyId:
                        company,

                    branchId:
                        finalBranchId
                }
            });

        if (!department) {
            const error = new Error(
                "Department does not belong to the selected branch"
            );

            error.statusCode = 400;

            throw error;
        }
    }


    // ======================================
    // Verify manager
    // ======================================

    if (
        managerId !== undefined &&
        managerId !== null
    ) {
        if (
            Number(managerId) === id
        ) {
            const error = new Error(
                "Employee cannot be their own manager"
            );

            error.statusCode = 400;

            throw error;
        }


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
            const error = new Error(
                "Manager not found in your company"
            );

            error.statusCode = 404;

            throw error;
        }
    }


    // ======================================
    // Update employee
    // ======================================

    const employee =
        await prisma.employee.update({
            where: {
                employeeId: id
            },

            data: {
                ...(firstName !== undefined && {
                    firstName
                }),

                ...(lastName !== undefined && {
                    lastName
                }),

                ...(gender !== undefined && {
                    gender
                }),

                ...(email !== undefined && {
                    email
                }),

                ...(phone !== undefined && {
                    phone
                }),

                ...(hireDate !== undefined && {
                    hireDate: hireDate
                        ? new Date(hireDate)
                        : null
                }),

                ...(role !== undefined && {
                    role
                }),

                // Salary values
                ...(salaryUpdateRequested && {
                    baseSalary:
                        calculatedBaseSalary,

                    monthlyExpectedHours:
                        calculatedMonthlyExpectedHours,

                    salaryRatePerHour:
                        calculatedSalaryRatePerHour
                }),

                ...(branchId !== undefined && {
                    branchId:
                        finalBranchId
                }),

                ...(departmentId !== undefined && {
                    departmentId:
                        departmentId === null
                            ? null
                            : Number(departmentId)
                }),

                ...(managerId !== undefined && {
                    managerId:
                        managerId === null
                            ? null
                            : Number(managerId)
                }),

                ...(status !== undefined && {
                    status
                })
            }
        });


    // ======================================
    // Remove password hash
    // ======================================

    const {
        passwordHash,
        ...safeEmployee
    } = employee;


    return safeEmployee;
};


// ==========================================
// Deactivate Employee
// ==========================================

const deleteEmployee = async (
    employeeId,
    companyId
) => {
    const id =
        Number(employeeId);

    const company =
        Number(companyId);


    // ======================================
    // Find employee
    // ======================================

    const employee =
        await prisma.employee.findFirst({
            where: {
                employeeId: id,
                companyId: company
            }
        });

    if (!employee) {
        const error = new Error(
            "Employee not found"
        );

        error.statusCode = 404;

        throw error;
    }


    // ======================================
    // Already inactive
    // ======================================

    if (
        employee.status === "INACTIVE"
    ) {
        const error = new Error(
            "Employee is already inactive"
        );

        error.statusCode = 400;

        throw error;
    }


    // ======================================
    // Deactivate instead of deleting
    // ======================================

    const updatedEmployee =
        await prisma.employee.update({
            where: {
                employeeId: id
            },

            data: {
                status: "INACTIVE"
            }
        });


    // ======================================
    // Remove password hash
    // ======================================

    const {
        passwordHash,
        ...safeEmployee
    } = updatedEmployee;


    return safeEmployee;
};


// ==========================================
// EXPORT
// ==========================================

module.exports = {
    getEmployeeById,
    getAllEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee
};