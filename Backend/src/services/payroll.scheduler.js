const prisma = require("../config/database");

const payrollService =
    require("./payroll.service");


// ============================================================
// PAYROLL SCHEDULER
// ============================================================
//
// Purpose:
//
// Automatically prepare the CURRENT payroll period for every
// enabled branch.
//
// Flow:
//
// Scheduler
//    ↓
// Find company branches
//    ↓
// Read payroll configuration
//    ↓
// Determine the CURRENT payroll period
//    ↓
// Generate payroll for that branch
//
// Important:
//
// - Uses the existing payroll.service calculation.
// - Does NOT create duplicate payroll.
// - Does NOT modify employee salary.
// - Does NOT touch attendance records.
// - Errors for one branch do not stop other branches.
// - Current payroll remains UNPAID until an admin pays it.
// - Running every hour allows the current payroll to exist
//   while advances are being paid during the period.
// ============================================================


// ============================================================
// CONFIGURATION
// ============================================================

const SCHEDULER_INTERVAL =
    60 * 60 * 1000; // 1 hour

let schedulerStarted = false;

let schedulerTimer = null;

let schedulerRunning = false;


// ============================================================
// DATE HELPERS
// ============================================================

const startOfDay = (
    date
) => {

    const value =
        new Date(date);

    value.setHours(
        0,
        0,
        0,
        0
    );

    return value;
};


const endOfDay = (
    date
) => {

    const value =
        new Date(date);

    value.setHours(
        23,
        59,
        59,
        999
    );

    return value;
};


const formatDate = (
    date
) => {

    const value =
        new Date(date);

    const year =
        value.getFullYear();

    const month =
        String(
            value.getMonth() + 1
        ).padStart(
            2,
            "0"
        );

    const day =
        String(
            value.getDate()
        ).padStart(
            2,
            "0"
        );

    return `${year}-${month}-${day}`;
};


// ============================================================
// GET ALL COMPANY BRANCHES
// ============================================================

const getCompanyBranches =
    async () => {

        return await prisma.branch.findMany({

            where: {
                companyId: {
                    gt: 0
                }
            },

            select: {
                branchId: true,
                companyId: true,
                branchName: true
            },

            orderBy: {
                branchId: "asc"
            }
        });
    };


// ============================================================
// GENERATE CURRENT PAYROLL FOR ONE BRANCH
// ============================================================

const processBranch =
    async (
        branch
    ) => {

        const branchId =
            Number(
                branch.branchId
            );

        const companyId =
            Number(
                branch.companyId
            );


        // ------------------------------------------------------
        // Validate branch ID
        // ------------------------------------------------------

        if (
            !Number.isInteger(
                branchId
            ) ||
            branchId <= 0
        ) {

            return {
                branchId,
                companyId,
                skipped: true,
                reason:
                    "Invalid branch ID"
            };
        }


        // ------------------------------------------------------
        // Validate company ID
        // ------------------------------------------------------

        if (
            !Number.isInteger(
                companyId
            ) ||
            companyId <= 0
        ) {

            return {
                branchId,
                companyId,
                skipped: true,
                reason:
                    "Invalid company ID"
            };
        }


        // ------------------------------------------------------
        // Load payroll configuration
        // ------------------------------------------------------

        const configuration =
            await payrollService
                .getPayrollConfiguration(
                    branchId,
                    companyId
                );


        // ------------------------------------------------------
        // Check whether payroll automation is enabled
        // ------------------------------------------------------

        if (
            configuration?.enabled === false
        ) {

            return {
                branchId,
                companyId,
                branchName:
                    branch.branchName,
                skipped: true,
                reason:
                    "Payroll automation is disabled"
            };
        }


        // ------------------------------------------------------
        // Determine the CURRENT payroll period.
        //
        // The current payroll must exist while the period is
        // still running so advances can continuously reduce
        // the employee's pending amount.
        //
        // Example:
        //
        // Salary = ₹30,000
        //
        // Advance 1 = ₹2,000
        // Pending    = ₹28,000
        //
        // Advance 2 = ₹5,000
        // Pending    = ₹23,000
        //
        // The payroll record itself remains UNPAID until the
        // configured payment date is reached.
        // ------------------------------------------------------

        const referenceDate =
            new Date();


    const period =
        await payrollService
            .getCurrentPayrollPeriod(
                configuration,
                referenceDate
            );

        console.log(
    "[DEBUG Payroll Period]",
    {
        configuration,
        period,
        periodStart:
            period?.periodStart,
        periodEnd:
            period?.periodEnd,
        scheduledPaymentDate:
            period?.scheduledPaymentDate
    }
);


        if (
            !period
        ) {

            return {
                branchId,
                companyId,
                branchName:
                    branch.branchName,
                skipped: true,
                reason:
                    "Payroll period could not be determined"
            };
        }


        // ------------------------------------------------------
        // Generate current payroll
        // ------------------------------------------------------
        //
        // Existing payroll for the same employee and period
        // is skipped by payroll.service.
        //
        // Therefore the scheduler can safely run every hour
        // without creating duplicate payroll records.
        // ------------------------------------------------------

        const result =
            await payrollService
                .generatePayrollForBranch(
                    branchId,
                    period.periodStart,
                    period.periodEnd,
                    companyId
                );


        return {
            branchId,
            companyId,
            branchName:
                branch.branchName,

            payPeriodStart:
                formatDate(
                    period.periodStart
                ),

            payPeriodEnd:
                formatDate(
                    period.periodEnd
                ),

            paymentDate:
                formatDate(
                    period.scheduledPaymentDate
                ),

            result
        };
    };


// ============================================================
// RUN SCHEDULER ONCE
// ============================================================

const runPayrollScheduler =
    async () => {

        // ------------------------------------------------------
        // Prevent overlapping scheduler runs
        // ------------------------------------------------------

        if (
            schedulerRunning
        ) {

            console.log(
                "[Payroll Scheduler] Previous run is still in progress. Skipping this cycle."
            );

            return;
        }


        schedulerRunning = true;


        const startedAt =
            new Date();


        console.log();

        console.log(
            "============================================================"
        );

        console.log(
            "[Payroll Scheduler] Starting payroll check"
        );

        console.log(
            `[Payroll Scheduler] ${startedAt.toISOString()}`
        );

        console.log(
            "============================================================"
        );


        try {

            // --------------------------------------------------
            // Load branches
            // --------------------------------------------------

            const branches =
                await getCompanyBranches();


            if (
                branches.length === 0
            ) {

                console.log(
                    "[Payroll Scheduler] No branches found."
                );

                return;
            }


            // --------------------------------------------------
            // Process branches independently
            // --------------------------------------------------

            const results = [];


            for (
                const branch
                of branches
            ) {

                try {

                    const result =
                        await processBranch(
                            branch
                        );


                    results.push(
                        result
                    );


                    // --------------------------------------------------
                    // Log skipped branch
                    // --------------------------------------------------

                    if (
                        result?.skipped
                    ) {

                        console.log(
                            `[Payroll Scheduler] Branch ${result.branchId} skipped: ${result.reason}`
                        );

                    } else {

                        // --------------------------------------------------
                        // Log processed branch
                        // --------------------------------------------------

                        const generated =
                            result?.result ||
                            {};


                        console.log(
                            `[Payroll Scheduler] Branch ${result.branchId} processed.`
                        );


                        console.log(
                            `[Payroll Scheduler] Period: ${result.payPeriodStart} → ${result.payPeriodEnd}`
                        );


                        console.log(
                            `[Payroll Scheduler] Payment Date: ${result.paymentDate}`
                        );


                        console.log(
                            `[Payroll Scheduler] Created: ${generated.created ?? 0}, Skipped: ${generated.skipped ?? 0}, Failed: ${generated.failed ?? 0}`
                        );
                    }

                } catch (
                    branchError
                ) {

                    // --------------------------------------------------
                    // Branch failure should not stop other branches
                    // --------------------------------------------------

                    console.error(
                        `[Payroll Scheduler] Branch ${branch.branchId} failed:`,
                        branchError
                    );


                    results.push({

                        branchId:
                            branch.branchId,

                        companyId:
                            branch.companyId,

                        branchName:
                            branch.branchName,

                        failed: true,

                        message:
                            branchError.message ||
                            "Branch payroll generation failed"

                    });

                }

            }


            // --------------------------------------------------
            // Summary
            // --------------------------------------------------

            const completed =
                results.filter(
                    (item) =>
                        !item.skipped &&
                        !item.failed
                ).length;


            const skipped =
                results.filter(
                    (item) =>
                        item.skipped
                ).length;


            const failed =
                results.filter(
                    (item) =>
                        item.failed
                ).length;


            console.log();

            console.log(
                "[Payroll Scheduler] Run completed."
            );


            console.log(
                `[Payroll Scheduler] Branches processed: ${completed}`
            );


            console.log(
                `[Payroll Scheduler] Branches skipped: ${skipped}`
            );


            console.log(
                `[Payroll Scheduler] Branches failed: ${failed}`
            );


        } catch (
            error
        ) {

            console.error(
                "[Payroll Scheduler] Global scheduler error:",
                error
            );

        } finally {

            // --------------------------------------------------
            // Always release scheduler lock
            // --------------------------------------------------

            schedulerRunning = false;

        }
    };


// ============================================================
// START SCHEDULER
// ============================================================

const startPayrollScheduler =
    () => {

        // ------------------------------------------------------
        // Prevent multiple scheduler instances
        // ------------------------------------------------------

        if (
            schedulerStarted
        ) {

            console.log(
                "[Payroll Scheduler] Scheduler already started."
            );

            return schedulerTimer;
        }


        schedulerStarted = true;


        console.log();

        console.log(
            "============================================================"
        );

        console.log(
            "[Payroll Scheduler] Scheduler started"
        );

        console.log(
            "[Payroll Scheduler] Check interval: 1 hour"
        );

        console.log(
            "============================================================"
        );


        // ------------------------------------------------------
        // Run once when backend starts
        // ------------------------------------------------------

        runPayrollScheduler()
            .catch(
                (error) => {

                    console.error(
                        "[Payroll Scheduler] Initial run failed:",
                        error
                    );

                }
            );


        // ------------------------------------------------------
        // Continue every hour
        // ------------------------------------------------------

        schedulerTimer =
            setInterval(
                () => {

                    runPayrollScheduler()
                        .catch(
                            (error) => {

                                console.error(
                                    "[Payroll Scheduler] Scheduled run failed:",
                                    error
                                );

                            }
                        );

                },
                SCHEDULER_INTERVAL
            );


        return schedulerTimer;
    };


// ============================================================
// STOP SCHEDULER
// ============================================================

const stopPayrollScheduler =
    () => {

        if (
            schedulerTimer
        ) {

            clearInterval(
                schedulerTimer
            );

            schedulerTimer =
                null;
        }


        schedulerStarted =
            false;


        console.log(
            "[Payroll Scheduler] Scheduler stopped."
        );
    };


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    startPayrollScheduler,

    stopPayrollScheduler,

    runPayrollScheduler

};