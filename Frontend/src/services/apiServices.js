import apiClient from "./apiClient";
import API from "./apiRegistry";


// ============================================================
// RESPONSE HELPERS
// ============================================================

/*
 * Backend response format:
 *
 * {
 *   success: true,
 *   message: "...",
 *   data: [...]
 * }
 *
 * This helper returns only:
 *
 * [...]
 *
 * or:
 *
 * {...}
 */

const unwrap = (response) => {

    return (
        response?.data?.data ??
        response?.data ??
        response
    );

};


// ============================================================
// ERROR HELPER
// ============================================================

const getApiError = (error) => {

    return (
        error?.response?.data?.message ||
        error?.message ||
        "Something went wrong"
    );

};


// ============================================================
// AUTHENTICATION
// ============================================================

export const authService = {

    // --------------------------------------------------------
    // Admin Login
    // --------------------------------------------------------

    adminLogin: async (
        email,
        password
    ) => {

        try {

            const response =
                await apiClient.post(
                    API.auth.adminLogin,
                    {
                        email,
                        password,
                    }
                );

            return unwrap(response);

        } catch (error) {

            console.error(
                "Admin login failed:",
                getApiError(error)
            );

            throw error;
        }
    },


    // --------------------------------------------------------
    // Employee Login
    // --------------------------------------------------------

    employeeLogin: async (
        email,
        password
    ) => {

        try {

            const response =
                await apiClient.post(
                    API.auth.employeeLogin,
                    {
                        email,
                        password,
                    }
                );

            return unwrap(response);

        } catch (error) {

            console.error(
                "Employee login failed:",
                getApiError(error)
            );

            throw error;
        }
    },


    // --------------------------------------------------------
    // Current User
    // --------------------------------------------------------

    me: async () => {

        const response =
            await apiClient.get(
                API.auth.me
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // Admin Test
    // --------------------------------------------------------

    adminTest: async () => {

        const response =
            await apiClient.get(
                API.auth.adminTest
            );

        return unwrap(response);
    },

};


// ============================================================
// COMPANY SERVICE
// ============================================================

export const companyService = {

    // --------------------------------------------------------
    // GET ALL COMPANIES
    // GET /api/companies
    // --------------------------------------------------------

    list: async () => {

        const response =
            await apiClient.get(
                API.companies.list
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // GET COMPANY
    // GET /api/companies/:id
    // --------------------------------------------------------

    get: async (id) => {

        const response =
            await apiClient.get(
                API.companies.get(id)
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // CREATE COMPANY
    // POST /api/companies
    // --------------------------------------------------------

    create: async (data) => {

        const response =
            await apiClient.post(
                API.companies.create,
                data
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // UPDATE COMPANY
    // PUT /api/companies/:id
    // --------------------------------------------------------

    update: async (
        id,
        data
    ) => {

        const response =
            await apiClient.put(
                API.companies.update(id),
                data
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // DELETE COMPANY
    // DELETE /api/companies/:id
    // --------------------------------------------------------

    delete: async (id) => {

        const response =
            await apiClient.delete(
                API.companies.delete(id)
            );

        return unwrap(response);
    },

};


// ============================================================
// EMPLOYEE SERVICE
// ============================================================

export const employeeService = {

    list: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.employees.list,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    get: async (id) => {

        const response =
            await apiClient.get(
                API.employees.get(id)
            );

        return unwrap(response);
    },


    create: async (data) => {

        const response =
            await apiClient.post(
                API.employees.create,
                data
            );

        return unwrap(response);
    },


    update: async (
        id,
        data
    ) => {

        const response =
            await apiClient.put(
                API.employees.update(id),
                data
            );

        return unwrap(response);
    },


    delete: async (id) => {

        const response =
            await apiClient.delete(
                API.employees.delete(id)
            );

        return unwrap(response);
    },

};


// ============================================================
// BRANCH SERVICE
// ============================================================

export const branchService = {

    list: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.branches.list,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    get: async (id) => {

        const response =
            await apiClient.get(
                API.branches.get(id)
            );

        return unwrap(response);
    },


    create: async (data) => {

        const response =
            await apiClient.post(
                API.branches.create,
                data
            );

        return unwrap(response);
    },


    update: async (
        id,
        data
    ) => {

        const response =
            await apiClient.put(
                API.branches.update(id),
                data
            );

        return unwrap(response);
    },


    delete: async (id) => {

        const response =
            await apiClient.delete(
                API.branches.delete(id)
            );

        return unwrap(response);
    },

};


// ============================================================
// DEPARTMENT SERVICE
// ============================================================

export const departmentService = {

    list: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.departments.list,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    get: async (id) => {

        const response =
            await apiClient.get(
                API.departments.get(id)
            );

        return unwrap(response);
    },


    create: async (data) => {

        const response =
            await apiClient.post(
                API.departments.create,
                data
            );

        return unwrap(response);
    },


    update: async (
        id,
        data
    ) => {

        const response =
            await apiClient.put(
                API.departments.update(id),
                data
            );

        return unwrap(response);
    },


    delete: async (id) => {

        const response =
            await apiClient.delete(
                API.departments.delete(id)
            );

        return unwrap(response);
    },

};


// ============================================================
// ATTENDANCE SERVICE
// ============================================================

export const attendanceService = {

    // --------------------------------------------------------
    // GET /api/attendance
    // --------------------------------------------------------

    list: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.attendance.list,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // GET /api/attendance/:id
    // --------------------------------------------------------

    get: async (id) => {

        const response =
            await apiClient.get(
                API.attendance.get(id)
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // GET /api/attendance/punches
    // --------------------------------------------------------

    punches: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.attendance.punches,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // GET /api/attendance/punches/:id
    // --------------------------------------------------------

    getPunch: async (id) => {

        const response =
            await apiClient.get(
                API.attendance.punch(id)
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // GET employee attendance
    // --------------------------------------------------------

    employee: async (
        employeeId,
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.attendance.employee(
                    employeeId
                ),
                {
                    params,
                }
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // Employee punch history
    // --------------------------------------------------------

    employeePunches: async (
        employeeId,
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.attendance.employeePunches(
                    employeeId
                ),
                {
                    params,
                }
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // Employee attendance summary
    // --------------------------------------------------------

    employeeSummary: async (
        employeeId,
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.attendance.employeeSummary(
                    employeeId
                ),
                {
                    params,
                }
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // Daily attendance summary
    // --------------------------------------------------------

    summary: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.attendance.summary,
                {
                    params,
                }
            );

        return unwrap(response);
    },

};


// ============================================================
// FINGERPRINT SERVICE
// ============================================================

export const fingerprintService = {

    // --------------------------------------------------------
    // GET /api/fingerprints
    // --------------------------------------------------------

    list: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.fingerprints.list,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // GET /api/fingerprints/:id
    // --------------------------------------------------------

    get: async (id) => {

        const response =
            await apiClient.get(
                API.fingerprints.get(id)
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // POST /api/fingerprints
    // --------------------------------------------------------

    create: async (data) => {

        const response =
            await apiClient.post(
                API.fingerprints.create,
                data
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // GET /api/fingerprints/enrollment/:id/status
    // --------------------------------------------------------
    getEnrollmentStatus: async (enrollmentId) => {
        const response =
            await apiClient.get(
                `/api/fingerprints/enrollment/${enrollmentId}/status`
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // PUT /api/fingerprints/:id
    // --------------------------------------------------------

    update: async (
        id,
        data
    ) => {

        const response =
            await apiClient.put(
                API.fingerprints.update(id),
                data
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // DELETE /api/fingerprints/:id
    // --------------------------------------------------------

    delete: async (id) => {

        const response =
            await apiClient.delete(
                API.fingerprints.delete(id)
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // Employee fingerprints
    // --------------------------------------------------------

    employee: async (
        employeeId,
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.fingerprints.employee(
                    employeeId
                ),
                {
                    params,
                }
            );

        return unwrap(response);
    },

};


// ============================================================
// DEVICE SERVICE
// ============================================================

export const deviceService = {

    list: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.devices.list,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    get: async (id) => {

        const response =
            await apiClient.get(
                API.devices.get(id)
            );

        return unwrap(response);
    },


    create: async (data) => {

        const response =
            await apiClient.post(
                API.devices.create,
                data
            );

        return unwrap(response);
    },


    update: async (
        id,
        data
    ) => {

        const response =
            await apiClient.put(
                API.devices.update(id),
                data
            );

        return unwrap(response);
    },


    delete: async (id) => {

        const response =
            await apiClient.delete(
                API.devices.delete(id)
            );

        return unwrap(response);
    },

};


// ============================================================
// DEVICE ENROLLMENT SERVICE
// ============================================================

export const deviceEnrollmentService = {

    // --------------------------------------------------------
    // POST /api/device/fingerprint-enroll
    // --------------------------------------------------------

    fingerprintEnroll: async (
        data
    ) => {

        const response =
            await apiClient.post(
                API.device.fingerprintEnroll,
                data
            );

        return unwrap(response);
    },

};


// ============================================================
// LEAVE TYPE SERVICE
// ============================================================

export const leaveTypeService = {

    list: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.leaveTypes.list,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    get: async (id) => {

        const response =
            await apiClient.get(
                API.leaveTypes.get(id)
            );

        return unwrap(response);
    },


    create: async (data) => {

        const response =
            await apiClient.post(
                API.leaveTypes.create,
                data
            );

        return unwrap(response);
    },


    update: async (
        id,
        data
    ) => {

        const response =
            await apiClient.put(
                API.leaveTypes.update(id),
                data
            );

        return unwrap(response);
    },


    delete: async (id) => {

        const response =
            await apiClient.delete(
                API.leaveTypes.delete(id)
            );

        return unwrap(response);
    },

};


// ============================================================
// LEAVE BALANCE SERVICE
// ============================================================

export const leaveBalanceService = {

    list: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.leaveBalances.list,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    get: async (id) => {

        const response =
            await apiClient.get(
                API.leaveBalances.get(id)
            );

        return unwrap(response);
    },


    create: async (data) => {

        const response =
            await apiClient.post(
                API.leaveBalances.create,
                data
            );

        return unwrap(response);
    },


    update: async (
        id,
        data
    ) => {

        const response =
            await apiClient.put(
                API.leaveBalances.update(id),
                data
            );

        return unwrap(response);
    },

};


// ============================================================
// LEAVE REQUEST SERVICE
// ============================================================

export const leaveRequestService = {

    // --------------------------------------------------------
    // GET /api/leave-requests
    // --------------------------------------------------------

    list: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.leaveRequests.list,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // GET /api/leave-requests/:id
    // --------------------------------------------------------

    get: async (id) => {

        const response =
            await apiClient.get(
                API.leaveRequests.get(id)
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // POST /api/leave-requests
    // --------------------------------------------------------

    create: async (data) => {

        const response =
            await apiClient.post(
                API.leaveRequests.create,
                data
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // PUT /api/leave-requests/:id/approve
    // --------------------------------------------------------

    approve: async (id) => {

        const response =
            await apiClient.put(
                API.leaveRequests.approve(id)
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // PUT /api/leave-requests/:id/reject
    // --------------------------------------------------------

    reject: async (id) => {

        const response =
            await apiClient.put(
                API.leaveRequests.reject(id)
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // PUT /api/leave-requests/:id/cancel
    // --------------------------------------------------------

    cancel: async (id) => {

        const response =
            await apiClient.put(
                API.leaveRequests.cancel(id)
            );

        return unwrap(response);
    },

};


// ============================================================
// ADVANCE SERVICE
// ============================================================

export const advanceService = {

    // --------------------------------------------------------
    // GET /api/advances
    // --------------------------------------------------------

    list: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.advances.list,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // GET /api/advances/:id
    // --------------------------------------------------------

    get: async (id) => {

        const response =
            await apiClient.get(
                API.advances.get(id)
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // POST /api/advances
    // --------------------------------------------------------

    create: async (data) => {

        const response =
            await apiClient.post(
                API.advances.create,
                data
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // PUT /api/advances/:id
    // --------------------------------------------------------

    update: async (
        id,
        data
    ) => {

        const response =
            await apiClient.put(
                API.advances.update(id),
                data
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // PATCH /api/advances/:id/status
    // --------------------------------------------------------

    updateStatus: async (
        id,
        status
    ) => {

        const response =
            await apiClient.patch(
                API.advances.updateStatus(id),
                {
                    status,
                }
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // DELETE /api/advances/:id
    // --------------------------------------------------------

    delete: async (id) => {

        const response =
            await apiClient.delete(
                API.advances.delete(id)
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // Employee advances
    // --------------------------------------------------------

    employee: async (
        employeeId,
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.advances.employee(
                    employeeId
                ),
                {
                    params,
                }
            );

        return unwrap(response);
    },

};


// ============================================================
// PAYROLL SERVICE
// ============================================================

export const payrollService = {

    list: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.payroll.list,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    get: async (id) => {

        const response =
            await apiClient.get(
                API.payroll.get(id)
            );

        return unwrap(response);
    },


    create: async (data) => {

        const response =
            await apiClient.post(
                API.payroll.create,
                data
            );

        return unwrap(response);
    },


    update: async (
        id,
        data
    ) => {

        const response =
            await apiClient.put(
                API.payroll.update(id),
                data
            );

        return unwrap(response);
    },


    employee: async (
        employeeId,
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.payroll.employee(
                    employeeId
                ),
                {
                    params,
                }
            );

        return unwrap(response);
    },

};


// ============================================================
// REPORT SERVICE
// ============================================================

export const reportService = {

    dashboard: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.reports.dashboard,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    attendance: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.reports.attendance,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    employees: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.reports.employees,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    payroll: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.reports.payroll,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    advances: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.reports.advances,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    leaves: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.reports.leaves,
                {
                    params,
                }
            );

        return unwrap(response);
    },

};


// ============================================================
// EMPLOYEE SELF SERVICE
// ============================================================

export const selfService = {

    profile: async () => {

        const response =
            await apiClient.get(
                API.me.profile
            );

        return unwrap(response);
    },


    attendance: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.me.attendance,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    attendanceSummary: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.me.attendanceSummary,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    payroll: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.me.payroll,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    advances: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.me.advances,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    createAdvance: async (
        data
    ) => {

        const response =
            await apiClient.post(
                API.me.createAdvance,
                data
            );

        return unwrap(response);
    },

};


// ============================================================
// COMBINED LEAVE SERVICE
// ============================================================
//
// This keeps compatibility with pages that use:
//
// leaveService.types()
// leaveService.balances()
// leaveService.requests()
// leaveService.approve()
//
// ============================================================

export const leaveService = {

    // --------------------------------------------------------
    // Leave Types
    // --------------------------------------------------------

    types: async (
        params = {}
    ) => {

        return leaveTypeService.list(
            params
        );
    },


    getType: async (id) => {

        return leaveTypeService.get(
            id
        );
    },


    createType: async (data) => {

        return leaveTypeService.create(
            data
        );
    },


    updateType: async (
        id,
        data
    ) => {

        return leaveTypeService.update(
            id,
            data
        );
    },


    deleteType: async (id) => {

        return leaveTypeService.delete(
            id
        );
    },


    // --------------------------------------------------------
    // Leave Balances
    // --------------------------------------------------------

    balances: async (
        params = {}
    ) => {

        return leaveBalanceService.list(
            params
        );
    },


    getBalance: async (id) => {

        return leaveBalanceService.get(
            id
        );
    },


    createBalance: async (
        data
    ) => {

        return leaveBalanceService.create(
            data
        );
    },


    updateBalance: async (
        id,
        data
    ) => {

        return leaveBalanceService.update(
            id,
            data
        );
    },


    // --------------------------------------------------------
    // Leave Requests
    // --------------------------------------------------------

    requests: async (
        params = {}
    ) => {

        return leaveRequestService.list(
            params
        );
    },


    getRequest: async (id) => {

        return leaveRequestService.get(
            id
        );
    },


    createRequest: async (
        data
    ) => {

        return leaveRequestService.create(
            data
        );
    },


    approve: async (id) => {

        return leaveRequestService.approve(
            id
        );
    },


    reject: async (id) => {

        return leaveRequestService.reject(
            id
        );
    },


    cancel: async (id) => {

        return leaveRequestService.cancel(
            id
        );
    },

};


// ============================================================
// DEFAULT EXPORT
// ============================================================

export default {

    authService,

    companyService,

    employeeService,

    branchService,

    departmentService,

    attendanceService,

    fingerprintService,

    deviceService,

    deviceEnrollmentService,

    leaveService,

    leaveTypeService,

    leaveBalanceService,

    leaveRequestService,

    advanceService,

    payrollService,

    reportService,

    selfService,

};