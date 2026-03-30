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
    sources: {
      type: [sourceSchema],
      default: [],
    },
    askedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const userChatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    chats: {
      type: [chatItemSchema],
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
