import mongoose from "mongoose";

export async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("Missing environment variable: MONGODB_URI");
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected successfully.");
}
