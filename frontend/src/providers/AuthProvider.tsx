import { useAuth } from "@clerk/clerk-react"
import { useState, useEffect } from "react"
import { axiosInstance } from "../lib/axios"
import { Loader } from "lucide-react"

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const { getToken, isLoaded } = useAuth()
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!isLoaded) return

       const interceptor = axiosInstance.interceptors.request.use(async (config) => {
    try {
        const token = await getToken()

        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
    } catch (error) {
        console.error("Failed to get token:", error)
    }
    return config
})

        setLoading(false)

        return () => axiosInstance.interceptors.request.eject(interceptor)
    }, [isLoaded, getToken])

    if (loading || !isLoaded) {
        return (
            <div className="h-screen w-full bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center">
                <Loader className="size-8 text-indigo-300/80 animate-spin" />
            </div>
        )
    }

    return <>{children}</>
}

export default AuthProvider