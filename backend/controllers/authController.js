import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

function createToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function sanitizeUser(user) {
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    phone: user.phone,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function registerUser(req, res) {
  try {
    const fullName = req.body?.fullName?.trim();
    const email = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password;
    const phone = req.body?.phone?.trim() ?? "";
    const requestedRole = req.body?.role;
    const role = requestedRole === "admin" ? "admin" : "user";

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "fullName, email, and password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters long.",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "User already exists with this email.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      fullName,
      email,
      passwordHash,
      phone,
      role,
    });

    const token = createToken(user._id.toString());

    return res.status(201).json({
      success: true,
      message: "User registered successfully.",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Register user failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Something went wrong while registering the user.",
    });
  }
}

export async function loginUser(req, res) {
  try {
    const email = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "email and password are required.",
      });
    }

    const user = await User.findOne({ email }).select("+passwordHash");

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password.",
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = createToken(user._id.toString());

    return res.json({
      success: true,
      message: "Login successful.",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Login user failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Something went wrong while logging in.",
    });
  }
}

export async function getCurrentUser(req, res) {
  return res.json({
    success: true,
    user: sanitizeUser(req.user),
  });
}
