import cors from "cors";
import express from "express";
import fs from "fs/promises";
import { PORT, UPLOAD_DIR, validateEnvironment } from "./config/appConfig.js";
import { connectDatabase } from "./config/db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import queryRoutes from "./routes/queryRoutes.js";

validateEnvironment();
await connectDatabase();
await fs.mkdir(UPLOAD_DIR, { recursive: true });

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "Backend is running." });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/query", queryRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
