import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Authorization token is required.",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "User not found for this token.",
      });
    }

    if (
      decoded.role
      && decoded.role === user.role
      && (decoded.domain ?? null) === (user.domain ?? null)
    ) {
      user.role = decoded.role;
      user.domain = decoded.domain ?? null;
    }

    req.user = user;
    return next();
  } catch (_error) {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired token.",
    });
  }
}

export function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: "Admin access only.",
    });
  }

  return next();
}
