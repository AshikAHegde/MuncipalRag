import mongoose from "mongoose";

const LEGAL_DOMAINS = ["criminal", "civil", "corporate", "tax"];

const documentSchema = new mongoose.Schema(
  {
    docId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    domain: {
      type: String,
      enum: LEGAL_DOMAINS,
      required: true,
      index: true,
    },
    section: {
      type: String,
      default: "",
      trim: true,
    },
    keywords: {
      type: [String],
      default: [],
    },
    mimeType: {
      type: String,
      required: true,
      default: "application/pdf",
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    storageKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    pages: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["uploaded", "processing", "processed", "failed"],
      default: "uploaded",
      index: true,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    processingError: {
      type: String,
      default: "",
      trim: true,
    },
    pineconeNamespace: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

const Document =
  mongoose.models.Document || mongoose.model("Document", documentSchema);

export default Document;
