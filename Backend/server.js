// ============================================================
// DIAMOND ERP - BACKEND SERVER
// ============================================================

const app = require("./src/app");

const {
    startPayrollScheduler
} = require("./src/services/payroll.scheduler");


// ============================================================
// PORT
// ============================================================

const PORT =
    process.env.PORT || 5000;


// ============================================================
// START EXPRESS SERVER
// ============================================================

const server =
    app.listen(
        PORT,
        "0.0.0.0",
        () => {

            console.log();
            console.log(
                "============================================================"
            );

            console.log(
                "Diamond ERP Backend"
            );

            console.log(
                `Server running on 0.0.0.0:${PORT}`
            );

            console.log(
                "============================================================"
            );

            console.log();

            // --------------------------------------------------
            // Start automatic payroll scheduler
            // --------------------------------------------------

            startPayrollScheduler();

        }
    );


// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

const shutdown = (
    signal
) => {

    console.log();
    console.log(
        `[Server] ${signal} received. Shutting down...`
    );


    server.close(
        () => {

            console.log(
                "[Server] HTTP server closed."
            );

            process.exit(0);

        }
    );


    // ----------------------------------------------------------
    // Safety timeout
    // ----------------------------------------------------------

    setTimeout(
        () => {

            console.error(
                "[Server] Forced shutdown after timeout."
            );

            process.exit(1);

        },
        10000
    ).unref();

};


// ============================================================
// PROCESS SIGNALS
// ============================================================

process.on(
    "SIGINT",
    () => {
        shutdown("SIGINT");
    }
);


process.on(
    "SIGTERM",
    () => {
        shutdown("SIGTERM");
    }
);


// ============================================================
// UNHANDLED ERRORS
// ============================================================

process.on(
    "unhandledRejection",
    (error) => {

        console.error(
            "[Server] Unhandled promise rejection:",
            error
        );

    }
);


process.on(
    "uncaughtException",
    (error) => {

        console.error(
            "[Server] Uncaught exception:",
            error
        );

    }
);