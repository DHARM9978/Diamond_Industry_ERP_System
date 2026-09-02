const attendanceService =
    require("../services/attendance.service");


// ==========================================
// Process Attendance Punch
// ==========================================

const processPunch = async (req, res) => {

    const result =
        await attendanceService.processDevicePunch({

            device:
                req.device,

            sensorSlot:
                req.body.sensorSlot
        });


    return res.status(201).json({

        success: true,

        message:
            result.punch.punchType === "IN"
                ? "Check-in recorded successfully"
                : "Check-out recorded successfully",

        data: {

            punch: {

                punchId:
                    result.punch.punchId.toString(),

                punchType:
                    result.punch.punchType,

                punchedAt:
                    result.punch.punchedAt,

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