import { supabase } from "../integrations/supabaseClient";
import { contract } from "../config/blockchain";
import { sha256Hex, toBytes32 } from "../utils/crypto";
import fs from "fs";
import path from "path";

/**
 * Upload file to Supabase storage and compute file hash (sha256).
 * filePath is local path (multer saved)
 */
export async function uploadFileAndComputeHash(localPath: string, destFilename: string) {
  const buffer = fs.readFileSync(localPath);
  const fileHash = sha256Hex(buffer);

  // upload to Supabase storage
  const bucket = process.env.SUPABASE_BUCKET || "certificates";
  const data = await supabase.storage.from(bucket).upload(destFilename, buffer, {
    contentType: "application/octet-stream",
    upsert: false
  });

  if (data.error) throw data.error;

  // get public URL (optionally)
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(destFilename);

  return { fileHash, publicUrl: urlData.publicUrl, localPath };
}

/**
 * Issue certificate on chain and store record in Supabase
 * params:
 *  - certID
 *  - localFilePath
 *  - ocrText
 *  - aiData (stringifiable)
 *  - qrData (stringifiable)
 *  - anomalyScore (number 0-255)
 *  - issuer (string wallet) - optional
 */
export async function issueCertificate(params: {
  certID: string;
  localFilePath: string;
  fileName: string;
  ocrText: string;
  aiData?: string;
  qrData?: string;
  anomalyScore?: number;
  issuer?: string;
}) {
  const {
    certID,
    localFilePath,
    fileName,
    ocrText,
    aiData = "",
    qrData = "",
    anomalyScore = 10,
    issuer = null,
  } = params;

  // 1) upload file and compute file hash
  const destFilename = `certificates/${certID}/${fileName}`;
  const { fileHash, publicUrl } = await uploadFileAndComputeHash(localFilePath, destFilename);

  // 2) compute other hashes (ocr, ai, qr)
  const ocrHash = sha256Hex(Buffer.from(ocrText || ""));
  const aiHash = sha256Hex(Buffer.from(aiData || ""));
  const qrHash = sha256Hex(Buffer.from(qrData || ""));

  // convert to bytes32
  const fileHash32 = toBytes32(fileHash);
  const ocrHash32 = toBytes32(ocrHash);
  const aiHash32 = toBytes32(aiHash);
  const qrHash32 = toBytes32(qrHash);

  // clamp anomaly score to 0-255
  const score = Math.max(0, Math.min(255, Math.floor(anomalyScore)));

  // 3) call smart contract addCertificate (server wallet must have ISSUER_ROLE)
  const tx = await contract.addCertificate(
    certID,
    fileHash32,
    ocrHash32,
    aiHash32,
    qrHash32,
    score,
    publicUrl || ""
  );
  const receipt = await tx.wait();

  // 4) insert DB records into Supabase
  // certificates table (assumes your schema matches)
  const insertCert = await supabase
    .from("certificates")
    .insert([
      {
        cert_id: certID,
        file_name: fileName,
        file_hash: fileHash,
        ocr_hash: ocrHash,
        ai_hash: aiHash,
        qr_hash: qrHash,
        anomaly_score: score,
        metadata_uri: publicUrl || null,
        tx_hash: receipt.transactionHash ?? receipt.hash,
        status: "verified"
      }
    ]);

  if (insertCert.error) {
    // Not fatal to chain tx, but report error
    console.error("Supabase insert error:", insertCert.error);
  }

  // store OCR text
  await supabase.from("certificate_ocr").insert([
    { certificate_id: insertCert.data?.[0]?.id || null, ocr_text: ocrText, confidence_score: null }
  ]);

  // store VC JSON if needed
  const vcJson = {
    id: certID,
    issuer,
    fileHash,
    ocrHash,
    aiHash,
    qrHash,
    anomalyScore: score,
    metadataURI: publicUrl
  };

  await supabase.from("certificate_vc").insert([{ certificate_id: insertCert.data?.[0]?.id || null, vc_json: vcJson }]);

  return { txHash: receipt.transactionHash ?? receipt.hash, receipt };
}

/**
 * Verify certificate: returns on-chain verification result + on-chain view data
 */
export async function verifyCertificate(certID: string) {
  // Call contract.verifyCertificate (may require proper role in contract, but we can call view)
  // If your contract's verifyCertificate is non-view and requires VERIFIER_ROLE, server wallet must have that role.
  let valid = false;
  try {
    const resp = await contract.verifyCertificate(certID);
    // could return boolean, or a tx; attempt to interpret
    if (typeof resp === "boolean") valid = resp;
    else if (resp && typeof resp.wait === "function") {
      const receipt = await resp.wait();
      const event = receipt.events?.find((e: any) => e.event === "CertificateVerified");
      if (event) valid = !!event.args?.[2];
    }
  } catch (err) {
    console.error("verifyCertificate error:", err);
    // fallthrough
  }

  // fetch viewCertificate
  const view = await contract.viewCertificate(certID);
  // tuple per contract: fileHash, ocrHash, aiHash, qrHash, anomalyScore, issuer, timestamp, corrections[], status, metadataURI
  return {
    valid,
    onChain: {
      fileHash: view[0],
      ocrHash: view[1],
      aiHash: view[2],
      qrHash: view[3],
      anomalyScore: Number(view[4]),
      issuer: String(view[5]),
      timestamp: Number(view[6]),
      corrections: Array.isArray(view[7]) ? view[7] : [],
      status: Number(view[8]) === 1 ? "Revoked" : "Active",
      metadataURI: String(view[9])
    }
  };
}

/**
 * viewCertificate (read-only wrapper)
 */
export async function viewCertificate(certID: string) {
  const view = await contract.viewCertificate(certID);
  return {
    fileHash: view[0],
    ocrHash: view[1],
    aiHash: view[2],
    qrHash: view[3],
    anomalyScore: Number(view[4]),
    issuer: String(view[5]),
    timestamp: Number(view[6]),
    corrections: Array.isArray(view[7]) ? view[7] : [],
    status: Number(view[8]) === 1 ? "Revoked" : "Active",
    metadataURI: String(view[9])
  };
}

/**
 * revokeCertificate (admin only)
 */
export async function revokeCertificate(certID: string) {
  const tx = await contract.revokeCertificate(certID);
  const receipt = await tx.wait();
  // Update status in Supabase (if present)
  await supabase.from("certificates").update({ status: "revoked", tx_hash: receipt.transactionHash ?? receipt.hash }).eq("cert_id", certID);
  return { txHash: receipt.transactionHash ?? receipt.hash, receipt };
}
