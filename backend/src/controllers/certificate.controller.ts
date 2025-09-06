import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as service from "../services/certificate.service";

const upload = multer({ dest: path.resolve(__dirname, "../../tmp_uploads") });

// POST /certificate/issue
export const issue = [
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: "file is required" });

      const { certID, ocrText, aiData, qrData, anomalyScore, issuer } = req.body;
      if (!certID) return res.status(400).json({ error: "certID is required" });

      // call service
      const result = await service.issueCertificate({
        certID,
        localFilePath: file.path,
        fileName: file.originalname,
        ocrText: ocrText || "",
        aiData: aiData || "",
        qrData: qrData || "",
        anomalyScore: anomalyScore ? Number(anomalyScore) : 10,
        issuer: issuer || null
      });

      // optional: remove temp file
      try { fs.unlinkSync(file.path); } catch {}

      res.json({ success: true, txHash: result.txHash });
    } catch (err: any) {
      console.error("Controller issue error:", err);
      res.status(500).json({ error: err.message });
    }
  }
];

// GET /certificate/:id/verify
export const verify = async (req: Request, res: Response) => {
  try {
    const certID = req.params.id;
    const result = await service.verifyCertificate(certID);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /certificate/:id
export const view = async (req: Request, res: Response) => {
  try {
    const certID = req.params.id;
    const data = await service.viewCertificate(certID);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// POST /certificate/:id/revoke
export const revoke = async (req: Request, res: Response) => {
  try {
    const certID = req.params.id;
    const result = await service.revokeCertificate(certID);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
