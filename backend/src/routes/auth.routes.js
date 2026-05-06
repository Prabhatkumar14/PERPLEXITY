import { Router } from "express";
import { register, verifyEmail, login, getMe, resendVerificationEmail, logout } from "../controllers/auth.controller.js";
import { registerValidator, loginValidator } from "../validators/auth.validator.js";
import { authUser } from "../middleware/auth.middleware.js";

const authRouter = Router();

/**
 * @route POST /api/auth/register
 */
authRouter.post("/register", registerValidator, register);

/**
 * @route POST /api/auth/login
 */
authRouter.post("/login", loginValidator, login);

/**
 * @route GET /api/auth/get-me
 */
authRouter.get('/get-me', authUser, getMe);

/**
 * @route GET /api/auth/verify-email
 */
authRouter.get('/verify-email', verifyEmail);

/**
 * @route POST /api/auth/resend-verification
 */
authRouter.post('/resend-verification', resendVerificationEmail);

/**
 * @route GET /api/auth/logout
 */
authRouter.get('/logout', logout);

export default authRouter;