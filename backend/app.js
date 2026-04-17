import cors from "cors";
import express from "express";
import { PORT, validateEnvironment } from "./config/appConfig.js";
import { connectDatabase } from "./config/db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import queryRoutes from "./routes/queryRoutes.js";
import speechRoutes from "./routes/speechRoutes.js";

validateEnvironment();
await connectDatabase();

const app = express();

app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "Backend is running." });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/query", queryRoutes);
app.use("/api/speech", speechRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
