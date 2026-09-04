import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback
} from "react";

import { authService } from "@/services/apiServices";

const AuthContext = createContext(null);


export function AuthProvider({ children }) {

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);


    // ==========================================
    // Restore Existing Login Session
    // ==========================================

    useEffect(() => {

        try {

            const token = localStorage.getItem("erp_token");
            const storedUser = localStorage.getItem("erp_user");

            if (token && storedUser) {

                const parsedUser = JSON.parse(storedUser);

                setUser(parsedUser);
            }

        } catch (error) {

            console.error(
                "Failed to restore authentication session:",
                error
            );

            localStorage.removeItem("erp_token");
            localStorage.removeItem("erp_user");

            setUser(null);

        } finally {

            setLoading(false);

        }

    }, []);


    // ==========================================
    // Login
    // ==========================================

    const login = useCallback(
        async (identifier, password) => {

            if (!identifier || !password) {

                throw new Error(
                    "Username/email and password are required."
                );

            }


            try {

                /*
                 * We have ONE login screen.
                 *
                 * The identifier can be:
                 *
                 * Admin:
                 *     email
                 *
                 * Employee:
                 *     employee ID / identifier
                 *
                 * We first try the admin login endpoint.
                 *
                 * If that fails, we try the employee login
                 * endpoint.
                 */

                let data = null;


                // ==========================================
                // Try Admin Login
                // ==========================================

                try {

                    data = await authService.adminLogin(
                        identifier,
                        password
                    );

                } catch (adminError) {

                    /*
                     * Admin login failed.
                     * Try employee login.
                     */

                    data = await authService.employeeLogin(
                        identifier,
                        password
                    );

                }


                // ==========================================
                // Validate Backend Response
                // ==========================================

                if (!data) {

                    throw new Error(
                        "Invalid response received from server."
                    );

                }


                if (!data.token) {

                    throw new Error(
                        "Authentication token was not returned by the server."
                    );

                }


                  // ==========================================
                  // Validate Backend Response
                  // ==========================================

                  if (!data) {

                      throw new Error(
                          "Invalid response received from server."
                      );

                  }

                  if (!data.token) {

                      throw new Error(
                          "Authentication token was not returned by the server."
                      );

                  }


                  // ==========================================
                  // Get User From Backend Response
                  // ==========================================

                  let authenticatedUser = null;


                  // Admin login response
                  if (data.admin) {

                      authenticatedUser = {
                          ...data.admin,
                          role: "admin",
                      };

                  }


                  // Employee login response
                  else if (data.employee) {

                      authenticatedUser = {
                          ...data.employee,
                          role: "employee",
                      };

                  }


                  // Neither admin nor employee returned
                  else {

                      throw new Error(
                          "User information was not returned by the server."
                      );

                  }


                  // ==========================================
                  // Save Authentication
                  // ==========================================

                  localStorage.setItem(
                      "erp_token",
                      data.token
                  );

                  localStorage.setItem(
                      "erp_user",
                      JSON.stringify(authenticatedUser)
                  );


                  // ==========================================
                  // Update React State
                  // ==========================================

                  setUser(authenticatedUser);


                  return authenticatedUser;


                // ==========================================
                // Save Authentication
                // ==========================================

                localStorage.setItem(
                    "erp_token",
                    data.token
                );

                localStorage.setItem(
                    "erp_user",
                    JSON.stringify(data.user)
                );


                // ==========================================
                // Update React State
                // ==========================================

                setUser(data.user);


                return data.user;

            } catch (error) {

                console.error(
                    "Login failed:",
                    error
                );


                throw new Error(
                    error?.message ||
                    "Invalid credentials. Please try again."
                );

            }

        },
        []
    );


    // ==========================================
    // Logout
    // ==========================================

    const logout = useCallback(
        async () => {

            /*
             * There is currently no need to call a backend
             * logout endpoint unless your backend provides one.
             *
             * JWT authentication is stateless, so removing
             * the token locally is enough for the frontend.
             */

            localStorage.removeItem("erp_token");
            localStorage.removeItem("erp_user");

            setUser(null);

        },
        []
    );


    // ==========================================
    // Authentication State
    // ==========================================

    const value = {

        user,

        loading,

        login,

        logout,

        isAdmin:
            user?.role === "admin",

        isEmployee:
            user?.role === "employee",

        isAuthenticated:
            Boolean(user),

    };


    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );

}


// ==========================================
// useAuth Hook
// ==========================================

export function useAuth() {

    const ctx = useContext(AuthContext);

    if (!ctx) {

        throw new Error(
            "useAuth must be used within AuthProvider"
        );

    }

    return ctx;

}
