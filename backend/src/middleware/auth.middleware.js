import { clerkClient } from "@clerk/express";

export const protectRoute = async (req, res, next) => {
    const { userId } = req.auth()
    console.log('userId:', userId)
    if (!userId) {
        return res.status(401).json({ message: "Unauthorized - No userId" })
    }
    next()
}

export const requireAdmin = async (req, res, next) => {
    try {
        const currentUser = await clerkClient.users.getUser(req.auth.userId);
        const adminEmail = process.env.ADMIN_EMAIL;
        const isAdmin = adminEmail === currentUser.primaryEmailAddress?.emailAddress;

        if (!isAdmin) {
            return res.status(403).json({ message: "Forbidden - Admin access required" });   
        }

        next();
    } catch (err) {
        console.error("Error in requireAdmin:", err);
        next(err);
    }
}