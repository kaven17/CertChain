import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import certificateRoutes from "./routes/certificate.routes";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// routes
app.use("/certificate", certificateRoutes);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Certify backend listening on http://localhost:${port}`);
});
