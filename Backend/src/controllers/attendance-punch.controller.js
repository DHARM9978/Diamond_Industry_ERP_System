const attendanceService =
    require("../services/attendance.service");


// ==========================================
// Process Attendance Punch
// ==========================================
//
// This controller intentionally stays thin.
// The attendance service owns fingerprint validation,
// IN/OUT determination, raw punch creation and attendance
// resolution. The controller only passes the authenticated
// device context and request payload to the service.
//
// eventId is optional for the existing single-punch/test API,
// but when supplied by a device/client it enables idempotent
// retries through the AttendancePunch(deviceId, eventId)
// unique constraint.
// ==========================================

const processPunch = async (req, res) => {

    const result =
        await attendanceService.processDevicePunch({

            device:
                req.device,

            sensorSlot:
                req.body.sensorSlot,

            eventId:
                req.body.eventId
        });


    const isDuplicate =
        result.duplicate === true;


    return res.status(201).json({

        success: true,

        message:
            isDuplicate
                ? "Attendance punch was already processed"
                : result.punch.punchType === "IN"
                    ? "Check-in recorded successfully"
                    : "Check-out recorded successfully",

        data: {

            duplicate:
                isDuplicate,

            punch: {

                punchId:
                    result.punch.punchId.toString(),

                punchType:
                    result.punch.punchType,

                punchedAt:
                    result.punch.punchedAt,

                eventId:
                    result.punch.eventId || null,

                employee:
                    result.punch.employee,

                device:
                    result.punch.device
            },

            attendance:
                result.attendance
        }
    });
};


module.exports = {
    processPunch
};