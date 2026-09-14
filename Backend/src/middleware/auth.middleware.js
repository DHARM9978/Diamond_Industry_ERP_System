// ============================================================
// DIAMOND ERP - AUTHENTICATION MIDDLEWARE
// ============================================================

const jwt = require("jsonwebtoken");


// ============================================================
// AUTHENTICATE USER
// ============================================================

const authenticate = (
    req,
    res,
    next
) => {

    try {

        // ------------------------------------------------------
        // Get Authorization header
        // ------------------------------------------------------

        const authHeader =
            req.headers.authorization;


        if (!authHeader) {

            return res.status(401).json({
                success: false,
                message:
                    "Authentication token is required"
            });

        }


        // ------------------------------------------------------
        // Expected format:
        //
        // Bearer <token>
        // ------------------------------------------------------

        const parts =
            authHeader.trim().split(/\s+/);


        if (
            parts.length !== 2 ||
            parts[0] !== "Bearer" ||
            !parts[1]
        ) {

            return res.status(401).json({
                success: false,
                message:
                    "Invalid authorization format"
            });

        }


        const token =
            parts[1];


        // ------------------------------------------------------
        // Verify JWT secret
        // ------------------------------------------------------

        if (!process.env.JWT_SECRET) {

            const error =
                new Error(
                    "JWT_SECRET is not configured"
                );

            error.statusCode = 500;

            return next(error);

        }


        // ------------------------------------------------------
        // Verify JWT
        // ------------------------------------------------------

        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );


        // ------------------------------------------------------
        // Validate decoded token
        // ------------------------------------------------------

        if (
            !decoded ||
            typeof decoded !== "object"
        ) {

            return res.status(401).json({
                success: false,
                message:
                    "Invalid authentication token payload"
            });

        }


        // ------------------------------------------------------
        // Store authenticated user information
        // in the request object
        // ------------------------------------------------------

        req.user =
            decoded;


        // ------------------------------------------------------
        // Continue request
        // ------------------------------------------------------

        return next();

    } catch (error) {

        // ------------------------------------------------------
        // Token expired
        // ------------------------------------------------------

        if (
            error.name ===
            "TokenExpiredError"
        ) {

            return res.status(401).json({
                success: false,
                message:
                    "Authentication token has expired"
            });

        }


        // ------------------------------------------------------
        // Invalid token
        // ------------------------------------------------------

        if (
            error.name ===
            "JsonWebTokenError"
        ) {

            return res.status(401).json({
                success: false,
                message:
                    "Invalid authentication token"
            });

        }


        // ------------------------------------------------------
        // Other errors
        // ------------------------------------------------------

        return next(error);
    }
};


// ============================================================
// EXPORT
// ============================================================

module.exports =
    authenticate;