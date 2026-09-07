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
// Start Fingerprint Enrollment
// Admin -> creates pending device job
// ==========================================

const enrollFingerprint = async (req, res) => {
    const enrollment =
        await fingerprintService.startFingerprintEnrollment(
            req.body,
            req.user.companyId
        );

    return res.status(201).json({
        success: true,
        message: "Fingerprint enrollment request created successfully",
        data: enrollment
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
// Get Enrollment Status
// GET /api/fingerprints/enrollment/:id/status
// ==========================================

const getEnrollmentStatus = async (req, res) => {
    const enrollment =
        await fingerprintService.getEnrollmentStatus(
            req.params.id,
            req.user.companyId
        );

    return res.status(200).json({
        success: true,
        message: "Fingerprint enrollment status fetched successfully",
        data: enrollment
    });
};


// ==========================================
// DEVICE: Append enrollment log
// ==========================================

const reportEnrollmentLog = async (req, res) => {
    const result =
        await fingerprintService.appendEnrollmentLog(
            req.body,
            req.device.companyId
        );

    return res.status(200).json({
        success: true,
        message: "Fingerprint enrollment log received successfully",
        data: result
    });
};


// ==========================================
// DEVICE: Get pending enrollment
// ==========================================

const getPendingEnrollment = async (req, res) => {
    const enrollment =
        await fingerprintService.getPendingEnrollment(
            req.device.companyId
        );

    return res.status(200).json({
        success: true,
        message: enrollment
            ? "Pending fingerprint enrollment fetched successfully"
            : "No pending fingerprint enrollment",
        data: enrollment
    });
};

// ==========================================
// DEVICE: Report enrollment result
// ==========================================

const reportEnrollmentResult = async (req, res) => {
    const enrollment =
        await fingerprintService.reportEnrollmentResult(
            req.body,
            req.device.companyId
        );

    return res.status(200).json({
        success: true,
        message: "Fingerprint enrollment result processed successfully",
        data: enrollment
    });
};

// ==========================================
// DEVICE: Legacy direct enrollment
// Kept for compatibility.
// This endpoint should only be used if a physical
// device already knows the slot.
// ==========================================

const enrollFingerprintFromDevice = async (req, res) => {
    const fingerprint =
        await fingerprintService.enrollFingerprintFromDevice(
            req.body,
            req.device.companyId
        );

    return res.status(201).json({
        success: true,
        message: "Fingerprint enrolled successfully from device",
        data: fingerprint
    });
};

module.exports = {
    getFingerprint,
    getFingerprints,
    enrollFingerprint,
    getEnrollmentStatus,
    updateFingerprint,
    deleteFingerprint,
    getPendingEnrollment,
    reportEnrollmentResult,
    reportEnrollmentLog,
    enrollFingerprintFromDevice
};
