import mongoose from "mongoose";

const LEGAL_DOMAINS = ["criminal", "civil", "corporate", "tax"];

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "user", "lawyer"],
      default: "user",
    },
    domain: {
      type: String,
      enum: LEGAL_DOMAINS,
      default: null,
      required: function requireDomainForLawyer() {
        return this.role === "lawyer";
      },
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    documentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
      },
    ],
  },
  {
    timestamps: true,
  },
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
