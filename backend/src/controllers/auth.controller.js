import userModel from "../models/user.models.js";
import jwt from "jsonwebtoken";
import sendEmail from "../services/sendemail.js";

/**
 * @desc Register a new user
 * @route POST /api/auth/register
 * @access Public
 * @body { username, email, password }
 */
export async function register(req, res) {
    const { username, email, password } = req.body;

    const existingUser = await userModel.findOne({ email });

    // Helper to generate and save OTP
    const setupOTP = async (user) => {
        const otp = Math.floor(100000 + Math.random() * 900000);
        user.otp = otp;
        user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await user.save();
        return otp;
    };

    if (existingUser) {
        if (!existingUser.isVerified) {
            // User exists but not verified, let's update and resend OTP
            existingUser.username = username;
            existingUser.password = password; 
            const otp = await setupOTP(existingUser);

            try {
                await sendEmail({
                    to: email,
                    subject: "Verify your email - SeekrX",
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                            <h2 style="color: #00d2ff; text-align: center;">Welcome back to SeekrX!</h2>
                            <p>You previously started registration but didn't verify your email. Here is your new OTP:</p>
                            <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 30px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
                                ${otp}
                            </div>
                            <p>This code will expire in 10 minutes.</p>
                            <p>If you didn't request this, you can safely ignore this email.</p>
                            <hr style="border: 0; border-top: 1px solid #eee;" />
                            <p style="font-size: 12px; color: #888; text-align: center;">The SeekrX Team</p>
                        </div>
                    `
                });
                return res.status(200).json({
                    message: "Account already exists but was not verified. A new OTP has been sent to your email.",
                    success: true,
                    needsVerification: true
                });
            } catch (err) {
                return res.status(500).json({
                    message: "Account exists but verification email failed to send. Please check your email configuration.",
                    success: false,
                    err: err.message
                });
            }
        } else {
            return res.status(400).json({
                message: "User with this email already exists",
                success: false,
                err: "User already exists"
            });
        }
    }

    // New user creation
    try {
        const user = await userModel.create({ username, email, password });
        const otp = await setupOTP(user);

        await sendEmail({
            to: email,
            subject: "Welcome to SeekrX! Verify your email",
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #00d2ff; text-align: center;">Welcome to SeekrX!</h2>
                    <p>Thank you for joining us. Please use the following OTP to verify your email address:</p>
                    <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 30px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p>This code will expire in 10 minutes.</p>
                    <hr style="border: 0; border-top: 1px solid #eee;" />
                    <p style="font-size: 12px; color: #888; text-align: center;">The SeekrX Team</p>
                </div>
            `
        });

        res.status(201).json({
            message: "User registered successfully. Please check your email for the OTP.",
            success: true,
            needsVerification: true,
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    } catch (err) {
        // If email failed, delete user to allow retry
        await userModel.deleteOne({ email });
        res.status(500).json({
            message: "Registration failed because verification email could not be sent. Please try again.",
            success: false,
            err: err.message
        });
    }
}

/**
 * @desc Login user and return JWT token
 * @route POST /api/auth/login
 * @access Public
 * @body { email, password }
 */
export async function login(req, res) {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email });

    if (!user) {
        return res.status(400).json({
            message: "Invalid email or password",
            success: false,
            err: "User not found"
        });
    }

    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
        return res.status(400).json({
            message: "Invalid email or password",
            success: false,
            err: "Incorrect password"
        });
    }

    if (!user.isVerified) {
        return res.status(400).json({
            message: "Please verify your email before logging in",
            success: false,
            err: "Email not verified"
        });
    }

    const token = jwt.sign({
        id: user._id,
        username: user.username,
    }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.cookie("token", token, {
        httpOnly: true,
        secure: true, // Required for SameSite=None
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(200).json({
        message: "Login successful",
        success: true,
        user: {
            id: user._id,
            username: user.username,
            email: user.email
        }
    });
}

/**
 * @desc Get current logged in user's details
 * @route GET /api/auth/get-me
 * @access Private
 */
export async function getMe(req, res) {
    const userId = req.user.id;

    const user = await userModel.findById(userId).select("-password");

    if (!user) {
        return res.status(404).json({
            message: "User not found",
            success: false,
            err: "User not found"
        });
    }

    res.status(200).json({
        message: "User details fetched successfully",
        success: true,
        user
    });
}

/**
 * @desc Verify user's email address
 * @route GET /api/auth/verify-email
 * @access Public
 * @query { token }
 */
export async function verifyEmail(req, res) {
    const { token, otp, email } = req.query;

    try {
        let userEmail = email;

        // Support for old token link
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userEmail = decoded.email;
        }

        const user = await userModel.findOne({ email: userEmail });

        if (!user) {
            return res.status(400).json({ message: "User not found", success: false });
        }

        // If OTP is provided (new way)
        if (otp) {
            if (user.otp !== parseInt(otp)) {
                return res.status(400).json({ message: "Invalid OTP", success: false });
            }
            if (new Date() > user.otpExpiry) {
                return res.status(400).json({ message: "OTP expired", success: false });
            }
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        if (req.headers.accept && req.headers.accept.includes('text/html')) {
            const html = `
                <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: #00d2ff;">Email Verified Successfully!</h1>
                    <p>Your email has been verified. You can now log in to your account.</p>
                    <a href="${process.env.CORS_ORIGIN || 'https://seekrx.vercel.app'}/login" style="display: inline-block; padding: 10px 20px; background: #00d2ff; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">Go to Login</a>
                </div>
            `;
            return res.send(html);
        }

        return res.status(200).json({ message: "Email verified successfully", success: true });
    } catch (err) {
        return res.status(400).json({
            message: "Verification failed",
            success: false,
            err: err.message
        });
    }
}

/**
 * @desc Verify OTP
 * @route POST /api/auth/verify-otp
 * @access Public
 * @body { email, otp }
 */
export async function verifyOTP(req, res) {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required", success: false });
    }

    try {
        const user = await userModel.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found", success: false });
        }

        if (user.isVerified) {
            return res.status(200).json({ message: "User is already verified", success: true });
        }

        if (user.otp !== parseInt(otp)) {
            return res.status(400).json({ message: "Invalid OTP", success: false });
        }

        if (new Date() > user.otpExpiry) {
            return res.status(400).json({ message: "OTP has expired. Please request a new one.", success: false });
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        res.status(200).json({ message: "Email verified successfully! You can now login.", success: true });
    } catch (err) {
        res.status(500).json({ message: "Server error during verification", success: false, err: err.message });
    }
}

/**
 * @desc Resend verification email
 * @route POST /api/auth/resend-verification
 * @access Public
 * @body { email }
 */
export async function resendVerificationEmail(req, res) {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ message: "Email is required", success: false });
    }

    try {
        const user = await userModel.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found", success: false });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: "User is already verified", success: false });
        }

        const otp = Math.floor(100000 + Math.random() * 900000);
        user.otp = otp;
        user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await user.save();

        await sendEmail({
            to: email,
            subject: "Verify your email for SeekrX!",
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #00d2ff; text-align: center;">Verify your email</h2>
                    <p>Hi ${user.username},</p>
                    <p>You requested to resend your verification code. Please use the following OTP:</p>
                    <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 30px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p>This code will expire in 10 minutes.</p>
                    <hr style="border: 0; border-top: 1px solid #eee;" />
                    <p style="font-size: 12px; color: #888; text-align: center;">The SeekrX Team</p>
                </div>
            `
        });

        res.status(200).json({ message: "Verification OTP resent successfully. Please check your inbox.", success: true });
    } catch (err) {
        res.status(500).json({ message: "Error sending email", success: false, err: err.message });
    }
}

/**
 * @desc Logout user and clear cookie
 * @route GET /api/auth/logout
 * @access Public
 */
export async function logout(req, res) {
    res.cookie("token", "", {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        expires: new Date(0)
    });
    
    res.status(200).json({
        message: "Logged out successfully",
        success: true
    });
}