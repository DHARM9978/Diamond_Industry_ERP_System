const prisma = require("../config/database");


// ============================================================
// ATTENDANCE OFFICE CLOSING TIME SETTING
// ============================================================

const OFFICE_CLOSE_SETTING_KEY =
    "ATTENDANCE_OFFICE_CLOSE_TIME";


const DEFAULT_OFFICE_CLOSE_TIME =
    "22:00";


const OFFICE_CLOSE_TIME_PATTERN =
    /^\d{2}:\d{2}$/;


// ============================================================
// VALIDATE OFFICE CLOSING TIME
// ============================================================

const validateOfficeCloseTime = (
    value
) => {

    if (
        typeof value !== "string" ||
        !OFFICE_CLOSE_TIME_PATTERN.test(value)
    ) {
        const error = new Error(
            "Office closing time must use HH:mm format"
        );

        error.statusCode = 400;
        throw error;
    }


    const [hour, minute] =
        value.split(":").map(Number);


    if (
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59
    ) {
        const error = new Error(
            "Office closing time contains an invalid value"
        );

        error.statusCode = 400;
        throw error;
    }


    return value;
};


// ============================================================
// NORMALIZE COMPANY ID
// ============================================================

const normalizeCompanyId = (
    companyId
) => {

    const numericCompanyId =
        Number(companyId);


    if (
        !Number.isInteger(numericCompanyId) ||
        numericCompanyId < 1
    ) {
        const error = new Error(
            "Invalid company ID"
        );

        error.statusCode = 400;
        throw error;
    }


    return numericCompanyId;
};


// ============================================================
// GET OFFICE CLOSING TIME
// ============================================================

const getOfficeCloseTime = async (
    companyId
) => {

    const numericCompanyId =
        normalizeCompanyId(companyId);


    const setting =
        await prisma.setting.findUnique({
            where: {
                companyId_key: {
                    companyId:
                        numericCompanyId,
                    key:
                        OFFICE_CLOSE_SETTING_KEY
                }
            },
            select: {
                settingId: true,
                companyId: true,
                key: true,
                value: true
            }
        });


    return {
        configured:
            Boolean(setting?.value),

        key:
            OFFICE_CLOSE_SETTING_KEY,

        value:
            setting?.value ||
            DEFAULT_OFFICE_CLOSE_TIME
    };
};


// ============================================================
// SAVE OFFICE CLOSING TIME
// ============================================================

const saveOfficeCloseTime = async (
    companyId,
    value
) => {

    const numericCompanyId =
        normalizeCompanyId(companyId);


    const normalizedValue =
        validateOfficeCloseTime(value);


    const setting =
        await prisma.setting.upsert({
            where: {
                companyId_key: {
                    companyId:
                        numericCompanyId,
                    key:
                        OFFICE_CLOSE_SETTING_KEY
                }
            },

            update: {
                value:
                    normalizedValue
            },

            create: {
                companyId:
                    numericCompanyId,
                key:
                    OFFICE_CLOSE_SETTING_KEY,
                value:
                    normalizedValue
            },

            select: {
                settingId: true,
                companyId: true,
                key: true,
                value: true
            }
        });


    return {
        settingId:
            setting.settingId,

        companyId:
            setting.companyId,

        key:
            setting.key,

        value:
            setting.value
    };
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    OFFICE_CLOSE_SETTING_KEY,
    DEFAULT_OFFICE_CLOSE_TIME,
    validateOfficeCloseTime,
    getOfficeCloseTime,
    saveOfficeCloseTime
};
