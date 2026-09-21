import apiClient from "./apiClient";
import API from "./apiRegistry";


// ============================================================
// RESPONSE HELPERS
// ============================================================

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
// AUTHENTICATION SERVICE
// ============================================================

export const authService = {

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


    me: async () => {

        const response =
            await apiClient.get(
                API.auth.me
            );

        return unwrap(response);
    },


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

    list: async () => {

        const response =
            await apiClient.get(
                API.companies.list
            );

        return unwrap(response);
    },


    get: async (id) => {

        const response =
            await apiClient.get(
                API.companies.get(id)
            );

        return unwrap(response);
    },


    create: async (data) => {

        const response =
            await apiClient.post(
                API.companies.create,
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
                API.companies.update(id),
                data
            );

        return unwrap(response);
    },


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
    // LIVE ATTENDANCE
    // --------------------------------------------------------

    live: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.attendance.live,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    get: async (id) => {

        const response =
            await apiClient.get(
                API.attendance.get(id)
            );

        return unwrap(response);
    },


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


    getPunch: async (id) => {

        const response =
            await apiClient.get(
                API.attendance.punch(id)
            );

        return unwrap(response);
    },


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


    get: async (id) => {

        const response =
            await apiClient.get(
                API.fingerprints.get(id)
            );

        return unwrap(response);
    },


    create: async (data) => {

        const response =
            await apiClient.post(
                API.fingerprints.create,
                data
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // ENROLLMENT STATUS
    // --------------------------------------------------------

    getEnrollmentStatus: async (
        enrollmentId
    ) => {

        const response =
            await apiClient.get(
                `/api/fingerprints/enrollment/${enrollmentId}/status`
            );

        return unwrap(response);
    },


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


    delete: async (id) => {

        const response =
            await apiClient.delete(
                API.fingerprints.delete(id)
            );

        return unwrap(response);
    },


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


    get: async (id) => {

        const response =
            await apiClient.get(
                API.leaveRequests.get(id)
            );

        return unwrap(response);
    },


    create: async (data) => {

        const response =
            await apiClient.post(
                API.leaveRequests.create,
                data
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // APPROVE LEAVE
    //
    // Existing:
    // approve(id)
    //
    // Partial:
    //
    // approve(id, {
    //     approvedStartDate: "...",
    //     approvedEndDate: "..."
    // })
    // --------------------------------------------------------

    approve: async (
        id,
        data = {}
    ) => {

        const response =
            await apiClient.put(
                API.leaveRequests.approve(id),
                data
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // REJECT LEAVE
    //
    // Existing:
    // reject(id)
    //
    // With rejection reason:
    //
    // reject(id, {
    //     rejectionReason: "..."
    // })
    // --------------------------------------------------------

    reject: async (
        id,
        data = {}
    ) => {

        const response =
            await apiClient.put(
                API.leaveRequests.reject(id),
                data
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // CANCEL LEAVE
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


    get: async (id) => {

        const response =
            await apiClient.get(
                API.advances.get(id)
            );

        return unwrap(response);
    },


    create: async (data) => {

        const response =
            await apiClient.post(
                API.advances.create,
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
                API.advances.update(id),
                data
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // ADVANCE STATUS
    //
    // Approve:
    //
    // updateStatus(id, "APPROVED", {
    //     approvedAmount: 1000
    // })
    //
    // Pay:
    //
    // updateStatus(id, "PAID", {
    //     paidAmount: 1500
    // })
    //
    // Reject:
    //
    // updateStatus(id, "REJECTED")
    // --------------------------------------------------------

    updateStatus: async (
        id,
        status,
        data = {}
    ) => {

        const response =
            await apiClient.patch(
                API.advances.updateStatus(id),
                {
                    status,
                    ...data,
                }
            );

        return unwrap(response);
    },


    delete: async (id) => {

        const response =
            await apiClient.delete(
                API.advances.delete(id)
            );

        return unwrap(response);
    },


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

    // --------------------------------------------------------
    // GET ALL PAYROLL
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // GET PAYROLL RECORD
    // --------------------------------------------------------

    get: async (id) => {

        const response =
            await apiClient.get(
                API.payroll.get(id)
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // CREATE SINGLE EMPLOYEE PAYROLL
    // --------------------------------------------------------

    create: async (
        data
    ) => {

        const response =
            await apiClient.post(
                API.payroll.create,
                data
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // UPDATE PAYROLL
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // DELETE PAYROLL
    // --------------------------------------------------------

    delete: async (
        id
    ) => {

        const response =
            await apiClient.delete(
                API.payroll.delete(id)
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // EMPLOYEE PAYROLL
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // MARK PAYROLL AS PAID
    //
    // PATCH /api/payroll/:id/pay
    //
    // Backend sets:
    // status = "PAID"
    // paymentDate = actual payment timestamp
    //
    // This method is for normal salary only.
    // Extra-work bonus payment uses bonusService.pay().
    // --------------------------------------------------------

    pay: async (
        id
    ) => {

        const response =
            await apiClient.patch(
                API.payroll.pay(id)
            );

        return unwrap(response);
    },


    // ========================================================
    // PAYROLL CONFIGURATION
    // ========================================================

    // --------------------------------------------------------
    // GET BRANCH PAYROLL CONFIGURATION
    //
    // GET /api/payroll/configuration/:branchId
    // --------------------------------------------------------

    getConfiguration: async (
        branchId
    ) => {

        const response =
            await apiClient.get(
                API.payroll.configuration(
                    branchId
                )
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // UPDATE BRANCH PAYROLL CONFIGURATION
    //
    // PUT /api/payroll/configuration/:branchId
    // --------------------------------------------------------

    updateConfiguration: async (
        branchId,
        data
    ) => {

        const response =
            await apiClient.put(
                API.payroll.updateConfiguration(
                    branchId
                ),
                data
            );

        return unwrap(response);
    },


    // ========================================================
    // PAYROLL PERIOD
    // ========================================================

    // --------------------------------------------------------
    // GET CURRENT PERIOD
    //
    // GET /api/payroll/period/:branchId/current
    // --------------------------------------------------------

    currentPeriod: async (
        branchId
    ) => {

        const response =
            await apiClient.get(
                API.payroll.currentPeriod(
                    branchId
                )
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // GET NEXT PERIOD
    //
    // GET /api/payroll/period/:branchId/next
    // --------------------------------------------------------

    nextPeriod: async (
        branchId
    ) => {

        const response =
            await apiClient.get(
                API.payroll.nextPeriod(
                    branchId
                )
            );

        return unwrap(response);
    },


    // ========================================================
    // AUTOMATIC PAYROLL GENERATION
    // ========================================================

    // --------------------------------------------------------
    // GENERATE PAYROLL FOR BRANCH
    //
    // POST /api/payroll/generate/branch/:branchId
    //
    // Optional body:
    //
    // {
    //     payPeriodStart: "2026-09-01",
    //     payPeriodEnd: "2026-09-30",
    //     paymentDate: "2026-10-05"
    // }
    //
    // When omitted, backend uses the configured period.
    // --------------------------------------------------------

    generateBranch: async (
        branchId,
        data = {}
    ) => {

        const response =
            await apiClient.post(
                API.payroll.generateBranch(
                    branchId
                ),
                data
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // GENERATE CURRENT BRANCH PAYROLL
    //
    // POST /api/payroll/generate/branch/:branchId/current
    //
    // Uses the currently configured payroll period.
    // --------------------------------------------------------

    generateCurrentBranch: async (
        branchId
    ) => {

        const response =
            await apiClient.post(
                API.payroll.generateCurrentBranch(
                    branchId
                )
            );

        return unwrap(response);
    },

};

// ============================================================
// BONUS SERVICE
//
// Bonus payments are managed separately from normal payroll.
// Extra-work records remain the source for bonus settlement.
// ============================================================

export const bonusService = {

    // --------------------------------------------------------
    // ADMIN - EXTRA WORK / BONUS RECORDS
    // --------------------------------------------------------

    extraWork: {

        // GET /api/bonuses/extra-work
        list: async (
            params = {}
        ) => {

            const response =
                await apiClient.get(
                    API.bonuses.extraWork.list,
                    {
                        params,
                    }
                );

            return unwrap(response);
        },


        // PATCH /api/bonuses/extra-work/:id/reject
        reject: async (
            id,
            data = {}
        ) => {

            const response =
                await apiClient.patch(
                    API.bonuses.extraWork.reject(id),
                    data
                );

            return unwrap(response);
        },

    },


    // --------------------------------------------------------
    // ADMIN - BONUS PAYMENT HISTORY
    // --------------------------------------------------------

    // GET /api/bonuses/history
    history: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.bonuses.history,
                {
                    params,
                }
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // ADMIN - PAY BONUS
    // --------------------------------------------------------

    // POST /api/bonuses/pay
    pay: async (
        data
    ) => {

        const response =
            await apiClient.post(
                API.bonuses.pay,
                data
            );

        return unwrap(response);
    },


    // --------------------------------------------------------
    // EMPLOYEE - MY BONUSES
    // --------------------------------------------------------

    // GET /api/me/bonuses
    myBonuses: async (
        params = {}
    ) => {

        const response =
            await apiClient.get(
                API.me.bonuses,
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
//
// Compatibility wrapper for existing pages.
// ============================================================

export const leaveService = {

    // --------------------------------------------------------
    // LEAVE TYPES
    // --------------------------------------------------------

    types: async (
        params = {}
    ) => {

        return leaveTypeService.list(
            params
        );
    },


    getType: async (
        id
    ) => {

        return leaveTypeService.get(
            id
        );
    },


    createType: async (
        data
    ) => {

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


    deleteType: async (
        id
    ) => {

        return leaveTypeService.delete(
            id
        );
    },


    // --------------------------------------------------------
    // LEAVE BALANCES
    // --------------------------------------------------------

    balances: async (
        params = {}
    ) => {

        return leaveBalanceService.list(
            params
        );
    },


    getBalance: async (
        id
    ) => {

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
    // LEAVE REQUESTS
    // --------------------------------------------------------

    requests: async (
        params = {}
    ) => {

        return leaveRequestService.list(
            params
        );
    },


    getRequest: async (
        id
    ) => {

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


    // --------------------------------------------------------
    // APPROVE
    // --------------------------------------------------------

    approve: async (
        id,
        data = {}
    ) => {

        return leaveRequestService.approve(
            id,
            data
        );
    },


    // --------------------------------------------------------
    // REJECT
    // --------------------------------------------------------

    reject: async (
        id,
        data = {}
    ) => {

        return leaveRequestService.reject(
            id,
            data
        );
    },


    // --------------------------------------------------------
    // CANCEL
    // --------------------------------------------------------

    cancel: async (
        id
    ) => {

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
    bonusService,
    reportService,
    selfService,
};