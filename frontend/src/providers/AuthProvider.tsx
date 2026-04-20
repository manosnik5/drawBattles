import { useAuth0 } from "@auth0/auth0-react";
import { useEffect } from "react";
import { axiosInstance } from "../lib/axios";
import { Loader } from "lucide-react";

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const { getAccessTokenSilently, isAuthenticated, isLoading } = useAuth0();

    useEffect(() => {
        const interceptor = axiosInstance.interceptors.request.use(
            async (config) => {
                if (isAuthenticated) {
                    try {
                        const token = await getAccessTokenSilently({
                            authorizationParams: {
                                audience: import.meta.env.VITE_AUTH0_AUDIENCE,
                            },
                        });

                        config.headers.Authorization = `Bearer ${token}`;
                    } catch (error) {
                        console.error("Token error:", error);
                    }
                }

                return config;
            }
        );

        return () => {
            axiosInstance.interceptors.request.eject(interceptor);
        };
    }, [isAuthenticated, getAccessTokenSilently]);

    if (isLoading) {
        return (
            <div className="h-screen w-full flex items-center justify-center">
                <Loader className="size-8 animate-spin" />
            </div>
        );
    }

    return <>{children}</>;
};

export default AuthProvider;