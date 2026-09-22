const publicHolidayService =
    require("../services/public-holiday.service");


// ============================================================
// CREATE PUBLIC HOLIDAY
// ============================================================
//
// POST /api/holidays
//
// Body:
//
// {
//     "branchId": 1,
//     "holidayDate": "2026-10-02",
//     "holidayName": "Gandhi Jayanti",
//     "dailyWorkingHours": 8,
//     "isPaid": true
// }
//
// ============================================================

const createPublicHoliday = async (
    req,
    res
) => {

    const result =
        await publicHolidayService.createPublicHoliday(
            req.body || {},
            req.user.companyId
        );


    return res.status(201).json({

        success:
            true,

        message:
            "Public holiday created successfully",

        data:
            result
    });
};


// ============================================================
// GET ALL PUBLIC HOLIDAYS
// ============================================================
//
// GET /api/holidays
//
// Optional query parameters:
//
// ?year=2026
// ?branchId=1
// ?fromDate=2026-01-01
// ?toDate=2026-12-31
// ?isPaid=true
//
// ============================================================

const getPublicHolidays = async (
    req,
    res
) => {

    const result =
        await publicHolidayService.getPublicHolidays(
            req.user.companyId,
            req.query || {}
        );


    return res.status(200).json({

        success:
            true,

        message:
            "Public holidays fetched successfully",

        data:
            result
    });
};


// ============================================================
// GET PUBLIC HOLIDAY BY ID
// ============================================================
//
// GET /api/holidays/:id
//
// ============================================================

const getPublicHolidayById = async (
    req,
    res
) => {

    const result =
        await publicHolidayService.getPublicHolidayById(
            req.params.id,
            req.user.companyId
        );


    return res.status(200).json({

        success:
            true,

        message:
            "Public holiday fetched successfully",

        data:
            result
    });
};


// ============================================================
// UPDATE PUBLIC HOLIDAY
// ============================================================
//
// PUT /api/holidays/:id
//
// Body can contain:
//
// {
//     "branchId": 2,
//     "holidayDate": "2026-10-03",
//     "holidayName": "Updated Holiday",
//     "dailyWorkingHours": 8,
//     "isPaid": false
// }
//
// All fields are optional.
//
// ============================================================

const updatePublicHoliday = async (
    req,
    res
) => {

    const result =
        await publicHolidayService.updatePublicHoliday(
            req.params.id,
            req.body || {},
            req.user.companyId
        );


    return res.status(200).json({

        success:
            true,

        message:
            "Public holiday updated successfully",

        data:
            result
    });
};


// ============================================================
// DELETE PUBLIC HOLIDAY
// ============================================================
//
// DELETE /api/holidays/:id
//
// ============================================================

const deletePublicHoliday = async (
    req,
    res
) => {

    const result =
        await publicHolidayService.deletePublicHoliday(
            req.params.id,
            req.user.companyId
        );


    return res.status(200).json({

        success:
            true,

        message:
            "Public holiday deleted successfully",

        data:
            result
    });
};


// ============================================================
// GET PUBLIC HOLIDAY CALENDAR
// ============================================================
//
// GET /api/holidays/calendar
//
// Optional:
//
// ?year=2026
// ?branchId=1
//
// ============================================================

const getPublicHolidayCalendar = async (
    req,
    res
) => {

    const result =
        await publicHolidayService.getPublicHolidayCalendar(
            req.user.companyId,
            req.query || {}
        );


    return res.status(200).json({

        success:
            true,

        message:
            "Public holiday calendar fetched successfully",

        data:
            result
    });
};


// ============================================================
// CHECK PUBLIC HOLIDAY
// ============================================================
//
// GET /api/holidays/check
//
// Query:
//
// ?date=2026-10-02&branchId=1
//
// ============================================================

const checkPublicHoliday = async (
    req,
    res
) => {

    const result =
        await publicHolidayService.checkPublicHoliday(
            req.query?.date,
            req.query?.branchId,
            req.user.companyId
        );


    return res.status(200).json({

        success:
            true,

        message:
            "Public holiday status checked successfully",

        data:
            result
    });
};


// ============================================================
// GET MY PUBLIC HOLIDAYS
// ============================================================
//
// This endpoint is intended for the logged-in employee.
//
// GET /api/holidays/my
//
// Optional:
//
// ?year=2026
// ?fromDate=2026-01-01
// ?toDate=2026-12-31
//
// The service determines the employee's branch itself.
// ============================================================

const getMyPublicHolidays = async (
    req,
    res
) => {

    const employeeId =
        req.user.employeeId;


    const result =
        await publicHolidayService.getEmployeePublicHolidays(
            employeeId,
            req.user.companyId,
            req.query || {}
        );


    return res.status(200).json({

        success:
            true,

        message:
            "Employee public holidays fetched successfully",

        data:
            result
    });
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    createPublicHoliday,

    getPublicHolidays,

    getPublicHolidayById,

    updatePublicHoliday,

    deletePublicHoliday,

    getPublicHolidayCalendar,

    checkPublicHoliday,

    getMyPublicHolidays
};