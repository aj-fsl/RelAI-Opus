import express from "express";
import dotenv from "dotenv";
import userRoutes from "./routes/userRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import cors from "cors"
import { syncStatus } from "./jobs/statusSync.js";

dotenv.config();

const app = express();
app.use(express.json());

// Enable CORS for all origins
app.use(cors());

setInterval(() => {
    console.log("Syncing Statuses")
    syncStatus()
}, 30000)

app.use("/api/users", userRoutes);
app.use("/jobs", jobRoutes);

export default app;
