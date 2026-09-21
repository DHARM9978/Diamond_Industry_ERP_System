const bonusService =
    require("../services/bonus.service");


// ============================================================
// GET EXTRA WORK / BONUS ELIGIBILITY RECORDS
//
// GET /api/bonuses/extra-work
//
// Optional query parameters are passed to the bonus service.
//
// Examples:
//
// GET /api/bonuses/extra-work
// GET /api/bonuses/extra-work?employeeId=12
// GET /api/bonuses/extra-work?status=ACCUMULATED
//
// ============================================================

const getExtraWorkRecords = async (
    req,
    res
) => {

    const records =
        await bonusService.getExtraWorkRecords(
            req.user.companyId,
            req.query || {}
        );


    return res.status(200).json({

        success:
            true,

        message:
            "Extra-work records fetched successfully",

        data:
            records

    });

};


// ============================================================
// GET BONUS / EXTRA-WORK SETTLEMENT HISTORY
//
// GET /api/bonuses/history
//
// Optional query parameters:
//
// employeeId
//
// ============================================================

const getBonusHistory = async (
    req,
    res
) => {

    const history =
        await bonusService.getBonusHistory(
            req.user.companyId,
            req.query || {}
        );


    return res.status(200).json({

        success:
            true,

        message:
            "Bonus settlement history fetched successfully",

        data:
            history

    });

};


// ============================================================
// SETTLE EXTRA WORK / PAY BONUS
//
// POST /api/bonuses/pay
//
// Body:
//
// {
//     "employeeId": 12,
//     "payrollId": 73,
//     "incentiveAmount": 2000
// }
//
// payrollId is optional.
//
// IMPORTANT:
//
// This operation settles the accumulated extra hours and
// records the associated incentive/bonus payment.
//
// It does NOT:
//
// - mark Payroll as PAID
// - modify Payroll.status
// - modify Payroll.paymentDate
// - change normal salary
//
// ============================================================

const settleExtraWork = async (
    req,
    res
) => {

    const employeeId =
        Number(
            req.body?.employeeId
        );


    if (
        !Number.isInteger(
            employeeId
        ) ||
        employeeId < 1
    ) {

        const error =
            new Error(
                "Invalid employee ID"
            );

        error.statusCode =
            400;

        throw error;
    }


    const incentiveAmount =
        req.body?.incentiveAmount ??
        0;


    const payrollId =
        req.body?.payrollId ??
        null;


    const settlement =
        await bonusService.settleExtraWork(
            employeeId,
            req.user.companyId,
            incentiveAmount,
            payrollId
        );


    return res.status(200).json({

        success:
            true,

        message:
            "Extra-work bonus settled successfully",

        data:
            settlement

    });

};


// ============================================================
// REJECT EXTRA WORK
//
// PATCH /api/bonuses/extra-work/:id/reject
//
// Rejection does not delete the extra-work record.
//
// The historical record is preserved and marked as rejected.
//
// ============================================================

const rejectExtraWork = async (
    req,
    res
) => {

    const extraWorkId =
        Number(
            req.params.id
        );


    if (
        !Number.isInteger(
            extraWorkId
        ) ||
        extraWorkId < 1
    ) {

        const error =
            new Error(
                "Invalid extra-work ID"
            );

        error.statusCode =
            400;

        throw error;
    }


    const record =
        await bonusService.rejectExtraWork(
            extraWorkId,
            req.user.companyId
        );


    return res.status(200).json({

        success:
            true,

        message:
            "Extra-work record rejected successfully",

        data:
            record

    });

};


// ============================================================
// GET MY BONUSES
//
// GET /api/me/bonuses
//
// Employee-facing endpoint.
//
// The employee ID MUST come from the authenticated user context.
// It is intentionally not accepted from the frontend request.
//
// ============================================================

const getMyBonuses = async (
    req,
    res
) => {

    const employeeId =
        Number(
            req.user.employeeId
        );


    if (
        !Number.isInteger(
            employeeId
        ) ||
        employeeId < 1
    ) {

        const error =
            new Error(
                "Employee ID is not available for the authenticated user"
            );

        error.statusCode =
            400;

        throw error;
    }


    const bonuses =
        await bonusService.getEmployeeBonuses(
            employeeId,
            req.user.companyId
        );


    return res.status(200).json({

        success:
            true,

        message:
            "My bonus records fetched successfully",

        data:
            bonuses

    });

};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    getExtraWorkRecords,

    getBonusHistory,

    settleExtraWork,

    rejectExtraWork,

    getMyBonuses

};