const MAX_LOGS_PER_ENROLLMENT = 100;

const enrollmentLogs = new Map();

const createEntry = (message) => ({
    timestamp: new Date().toISOString(),
    message: String(message)
});

const initialize = (enrollmentId, message = null) => {
    const id = Number(enrollmentId);

    if (!id) {
        return;
    }

    enrollmentLogs.set(id, {
        logs: message ? [createEntry(message)] : []
    });
};

const append = (enrollmentId, message) => {
    const id = Number(enrollmentId);

    if (!id || !message) {
        return;
    }

    const entry =
        enrollmentLogs.get(id) || {
            logs: []
        };

    entry.logs.push(
        createEntry(message)
    );

    if (
        entry.logs.length >
        MAX_LOGS_PER_ENROLLMENT
    ) {
        entry.logs.splice(
            0,
            entry.logs.length -
                MAX_LOGS_PER_ENROLLMENT
        );
    }

    enrollmentLogs.set(
        id,
        entry
    );
};

const get = (enrollmentId) => {
    const id = Number(enrollmentId);

    return (
        enrollmentLogs.get(id)?.logs ||
        []
    );
};

const remove = (enrollmentId) => {
    enrollmentLogs.delete(
        Number(enrollmentId)
    );
};

module.exports = {
    initialize,
    append,
    get,
    remove
};