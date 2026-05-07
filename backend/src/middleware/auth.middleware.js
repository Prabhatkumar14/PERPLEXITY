import jwt from "jsonwebtoken";
import userModel from "../models/user.models.js";

export const authUser = async (req, res, next) => {
    let token;

    if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
        console.log("No token found in request");
        return res.status(401).json({
            message: "Not authorized, please login first",
            success: false,
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await userModel.findById(decoded.id).select("-password");

        if (!user) {
            console.log("User not found for token id:", decoded.id);
            return res.status(401).json({
                message: "Not authorized, user account no longer exists",
                success: false,
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("Auth middleware error:", error.message);
        res.status(401).json({
            message: "Session expired, please login again",
            success: false,
            err: error.message
        });
    }
};
