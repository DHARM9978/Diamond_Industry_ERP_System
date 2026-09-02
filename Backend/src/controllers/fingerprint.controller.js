const fingerprintService =
    require("../services/fingerprint.service");


// ==========================================
// Get Fingerprint
// ==========================================

const getFingerprint = async (req, res) => {

    const fingerprint =
        await fingerprintService.getFingerprintById(
            req.params.id,
            req.user.companyId
        );

    return res.status(200).json({
        success: true,
        message: "Fingerprint fetched successfully",
        data: fingerprint
    });
};


// ==========================================
// Get All Fingerprints
// ==========================================

const getFingerprints = async (req, res) => {

    const fingerprints =
        await fingerprintService.getAllFingerprints(
            req.user.companyId
        );

    return res.status(200).json({
        success: true,
        message: "Fingerprints fetched successfully",
        data: fingerprints
    });
};


// ==========================================
// Enroll Fingerprint
// ==========================================

const enrollFingerprint = async (req, res) => {

    const fingerprint =
        await fingerprintService.enrollFingerprint(
            req.body,
            req.user.companyId
        );

    return res.status(201).json({
        success: true,
        message: "Fingerprint enrolled successfully",
        data: fingerprint
    });
};

// ==========================================
// Update Fingerprint
// ==========================================

const updateFingerprint = async (req, res) => {

    const fingerprint =
        await fingerprintService.updateFingerprint(
            req.params.id,
            req.body,
            req.user.companyId
        );

    return res.status(200).json({
        success: true,
        message: "Fingerprint updated successfully",
        data: fingerprint
    });
};


// ==========================================
// Delete Fingerprint
// ==========================================

const deleteFingerprint = async (req, res) => {

    await fingerprintService.deleteFingerprint(
        req.params.id,
        req.user.companyId
    );

    return res.status(200).json({
        success: true,
        message: "Fingerprint deleted successfully"
    });
};

// ==========================================
// Add New  Fingerprint
// ==========================================

const enrollFingerprintFromDevice = async (
    req,
    res
) => {

    const fingerprint =
        await fingerprintService.enrollFingerprintFromDevice(

            req.body,

            req.device.companyId
        );


    return res.status(201).json({

        success: true,

        message:
            "Fingerprint enrolled successfully from device",

        data:
            fingerprint
    });
};


module.exports = {
    getFingerprint,
    getFingerprints,
    enrollFingerprint,
    updateFingerprint,
    deleteFingerprint,
    enrollFingerprintFromDevice
};