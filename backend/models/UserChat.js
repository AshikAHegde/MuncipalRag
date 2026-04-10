import mongoose from "mongoose";

const sourceSchema = new mongoose.Schema(
  {
    page: {
      type: String,
      default: "N/A",
      trim: true,
    },
    section: {
      type: String,
      default: "",
      trim: true,
    },
    text: {
      type: String,
      default: "",
      trim: true,
    },
    score: {
      type: Number,
      default: null,
    },
    source: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false },
);

const chatItemSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ["chat", "compliance_review"],
      default: "chat",
      trim: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
    },
    language: {
      type: String,
      enum: ["en", "hi", "mr"],
      default: "en",
      trim: true,
    },
    sources: {
      type: [sourceSchema],
      default: [],
    },
    review: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    askedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const chatSessionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    mode: {
      type: String,
      enum: ["chat", "compliance_review"],
      default: "chat",
      trim: true,
    },
    language: {
      type: String,
      enum: ["en", "hi", "mr"],
      default: "en",
      trim: true,
    },
    conversations: {
      type: [chatItemSchema],
      default: [],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastAskedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const userChatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    chatSessions: {
      type: [chatSessionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

const UserChat =
  mongoose.models.UserChat || mongoose.model("UserChat", userChatSchema);

export default UserChat;
