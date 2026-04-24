import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const VALID_DOMAINS = ["criminal", "civil", "corporate", "tax"];
const VALID_ROLES = ["admin", "user", "lawyer"];

function createToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      domain: user.domain || null,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );
}

function sanitizeUser(user) {
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    domain: user.domain || null,
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
    const requestedDomain = req.body?.domain?.trim()?.toLowerCase() ?? "";
    const role = VALID_ROLES.includes(requestedRole) ? requestedRole : "user";
    const domain = role === "lawyer" ? requestedDomain : null;

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

    if (role === "lawyer" && !VALID_DOMAINS.includes(domain)) {
      return res.status(400).json({
        success: false,
        error: "A valid legal domain is required for lawyer accounts.",
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
      domain,
    });

    const token = createToken(user);

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

    const token = createToken(user);

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

export async function updateProfile(req, res) {
  try {
    const fullName = req.body?.fullName?.trim();
    const phone = req.body?.phone?.trim();
    const domain = req.body?.domain?.trim()?.toLowerCase();

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found.",
      });
    }

    if (fullName) user.fullName = fullName;
    if (phone !== undefined) user.phone = phone;

    if (user.role === "lawyer" && domain) {
      if (VALID_DOMAINS.includes(domain)) {
        user.domain = domain;
      } else {
        return res.status(400).json({
          success: false,
          error: "Invalid legal domain.",
        });
      }
    }

    await user.save();

    return res.json({
      success: true,
      message: "Profile updated successfully.",
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Update profile failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Something went wrong while updating the profile.",
    });
  }
}
