// ============================================================
// Diamond ERP - API Registry
// ============================================================
//
// Backend:
// Node.js + Express + Prisma + MySQL
//
// Frontend:
// React + Vite
//
// Backend Base URL is configured inside apiClient.js
//
// All paths below are relative to the API base URL.
// ============================================================


const API = {

    // ========================================================
    // AUTHENTICATION
    // ========================================================

    auth: {

        // Admin login
        adminLogin: "/api/auth/login",

        // Employee login
        employeeLogin: "/api/auth/employee/login",

        // Current authenticated user
        me: "/api/auth/me",

        // Admin authorization test
        adminTest: "/api/auth/admin-test",

    },


    // ========================================================
    // COMPANIES
    // ========================================================

    companies: {

        // GET /api/companies
        list: "/api/companies",

        // GET /api/companies/:id
        get: (id) =>
            `/api/companies/${id}`,

        // POST /api/companies
        create: "/api/companies",

        // PUT /api/companies/:id
        update: (id) =>
            `/api/companies/${id}`,

        // DELETE /api/companies/:id
        delete: (id) =>
            `/api/companies/${id}`,

    },


    // ========================================================
    // BRANCHES
    // ========================================================

    branches: {

        // GET /api/branches
        list: "/api/branches",

        // GET /api/branches/:id
        get: (id) =>
            `/api/branches/${id}`,

        // POST /api/branches
        create: "/api/branches",

        // PUT /api/branches/:id
        update: (id) =>
            `/api/branches/${id}`,

        // DELETE /api/branches/:id
        delete: (id) =>
            `/api/branches/${id}`,

    },


    // ========================================================
    // DEPARTMENTS
    // ========================================================

    departments: {

        // GET /api/departments
        list: "/api/departments",

        // GET /api/departments/:id
        get: (id) =>
            `/api/departments/${id}`,

        // POST /api/departments
        create: "/api/departments",

        // PUT /api/departments/:id
        update: (id) =>
            `/api/departments/${id}`,

        // DELETE /api/departments/:id
        delete: (id) =>
            `/api/departments/${id}`,

    },


    // ========================================================
    // EMPLOYEES
    // ========================================================

    employees: {

        // GET /api/employees
        list: "/api/employees",

        // GET /api/employees/:id
        get: (id) =>
            `/api/employees/${id}`,

        // POST /api/employees
        create: "/api/employees",

        // PUT /api/employees/:id
        update: (id) =>
            `/api/employees/${id}`,

        // DELETE /api/employees/:id
        delete: (id) =>
            `/api/employees/${id}`,

    },


    // ========================================================
    // ATTENDANCE
    // ========================================================

    attendance: {

        // GET /api/attendance
        list: "/api/attendance",

        // GET /api/attendance/:id
        get: (id) =>
            `/api/attendance/${id}`,

        // GET /api/attendance/punches
        punches: "/api/attendance/punches",

        // GET /api/attendance/punches/:id
        punch: (id) =>
            `/api/attendance/punches/${id}`,

        // GET /api/attendance/employee/:employeeId
        employee: (employeeId) =>
            `/api/attendance/employee/${employeeId}`,

        // GET /api/attendance/employee/:employeeId/punches
        employeePunches: (employeeId) =>
            `/api/attendance/employee/${employeeId}/punches`,

        // GET /api/attendance/employee/:employeeId/summary
        employeeSummary: (employeeId) =>
            `/api/attendance/employee/${employeeId}/summary`,

        // GET /api/attendance/summary
        summary: "/api/attendance/summary",

    },


    // ========================================================
    // FINGERPRINTS
    // ========================================================

    fingerprints: {

        // GET /api/fingerprints
        list: "/api/fingerprints",

        // GET /api/fingerprints/:id
        get: (id) =>
            `/api/fingerprints/${id}`,

        // POST /api/fingerprints
        create: "/api/fingerprints",

        // PUT /api/fingerprints/:id
        update: (id) =>
            `/api/fingerprints/${id}`,

        // DELETE /api/fingerprints/:id
        delete: (id) =>
            `/api/fingerprints/${id}`,

        // Employee fingerprints
        // GET /api/fingerprints/employee/:employeeId
        employee: (employeeId) =>
            `/api/fingerprints/employee/${employeeId}`,

    },


    // ========================================================
    // DEVICES
    // ========================================================

    devices: {

        // GET /api/devices
        list: "/api/devices",

        // GET /api/devices/:id
        get: (id) =>
            `/api/devices/${id}`,

        // POST /api/devices
        create: "/api/devices",

        // PUT /api/devices/:id
        update: (id) =>
            `/api/devices/${id}`,

        // DELETE /api/devices/:id
        delete: (id) =>
            `/api/devices/${id}`,

    },


    // ========================================================
    // DEVICE / FINGERPRINT ENROLLMENT
    // ========================================================

    device: {

        // POST /api/device/fingerprint-enroll
        fingerprintEnroll:
            "/api/device/fingerprint-enroll",

    },


    // ========================================================
    // LEAVE TYPES
    // ========================================================

    leaveTypes: {

        // GET /api/leave-types
        list: "/api/leave-types",

        // GET /api/leave-types/:id
        get: (id) =>
            `/api/leave-types/${id}`,

        // POST /api/leave-types
        create: "/api/leave-types",

        // PUT /api/leave-types/:id
        update: (id) =>
            `/api/leave-types/${id}`,

        // DELETE /api/leave-types/:id
        delete: (id) =>
            `/api/leave-types/${id}`,

    },


    // ========================================================
    // LEAVE BALANCES
    // ========================================================

    leaveBalances: {

        // GET /api/leave-balances
        list: "/api/leave-balances",

        // GET /api/leave-balances/:id
        get: (id) =>
            `/api/leave-balances/${id}`,

        // POST /api/leave-balances
        create: "/api/leave-balances",

        // PUT /api/leave-balances/:id
        update: (id) =>
            `/api/leave-balances/${id}`,

    },


    // ========================================================
    // LEAVE REQUESTS
    // ========================================================

    leaveRequests: {

        // GET /api/leave-requests
        list: "/api/leave-requests",

        // GET /api/leave-requests/:id
        get: (id) =>
            `/api/leave-requests/${id}`,

        // POST /api/leave-requests
        create: "/api/leave-requests",

        // PUT /api/leave-requests/:id/approve
        approve: (id) =>
            `/api/leave-requests/${id}/approve`,

        // PUT /api/leave-requests/:id/reject
        reject: (id) =>
            `/api/leave-requests/${id}/reject`,

        // PUT /api/leave-requests/:id/cancel
        cancel: (id) =>
            `/api/leave-requests/${id}/cancel`,

    },


    // ========================================================
    // ADVANCES
    // ========================================================

    advances: {

        // GET /api/advances
        list: "/api/advances",

        // GET /api/advances/:id
        get: (id) =>
            `/api/advances/${id}`,

        // POST /api/advances
        create: "/api/advances",

        // PUT /api/advances/:id
        update: (id) =>
            `/api/advances/${id}`,

        // PATCH /api/advances/:id/status
        updateStatus: (id) =>
            `/api/advances/${id}/status`,

        // DELETE /api/advances/:id
        delete: (id) =>
            `/api/advances/${id}`,

        // GET /api/advances/employee/:employeeId
        employee: (employeeId) =>
            `/api/advances/employee/${employeeId}`,

    },


    // ========================================================
    // PAYROLL
    // ========================================================

    payroll: {

        // Admin payroll list
        // GET /api/payroll
        list: "/api/payroll",

        // GET /api/payroll/:id
        get: (id) =>
            `/api/payroll/${id}`,

        // POST /api/payroll
        create: "/api/payroll",

        // PUT /api/payroll/:id
        update: (id) =>
            `/api/payroll/${id}`,

        // GET /api/payroll/employee/:employeeId
        employee: (employeeId) =>
            `/api/payroll/employee/${employeeId}`,

    },


    // ========================================================
    // REPORTS
    // ========================================================

    reports: {

        // GET /api/reports/dashboard
        dashboard:
            "/api/reports/dashboard",

        // GET /api/reports/attendance
        attendance:
            "/api/reports/attendance",

        // GET /api/reports/employees
        employees:
            "/api/reports/employees",

        // GET /api/reports/payroll
        payroll:
            "/api/reports/payroll",

        // GET /api/reports/advances
        advances:
            "/api/reports/advances",

        // GET /api/reports/leaves
        leaves:
            "/api/reports/leaves",

    },


    // ========================================================
    // EMPLOYEE SELF SERVICE
    // ========================================================

    me: {

        // GET /api/me/profile
        profile:
            "/api/me/profile",

        // GET /api/me/attendance
        attendance:
            "/api/me/attendance",

        // GET /api/me/attendance/summary
        attendanceSummary:
            "/api/me/attendance/summary",

        // GET /api/me/payroll
        payroll:
            "/api/me/payroll",

        // GET /api/me/advances
        advances:
            "/api/me/advances",

        // POST /api/me/advances
        createAdvance:
            "/api/me/advances",

    },

};


// ============================================================
// EXPORT
// ============================================================

export default API;