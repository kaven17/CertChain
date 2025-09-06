import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { OCRService } from '../ocr';
import { AIService } from '../ai';
import { VCService } from '../vc';
import { BlockchainService } from '../blockchain';
import { DatabaseService } from '../database';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Initialize services
const ocrService = new OCRService();
const aiService = new AIService();
const dbService = new DatabaseService();

// Initialize blockchain service (will be configured via env vars)
let blockchainService: BlockchainService | null = null;

if (process.env.RPC_URL && process.env.PRIVATE_KEY_DEV && process.env.CONTRACT_ADDRESS) {
  try {
    const contractABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../abi/CertifyChain.json'), 'utf8'));
    blockchainService = new BlockchainService({
      rpcUrl: process.env.RPC_URL,
      privateKey: process.env.PRIVATE_KEY_DEV,
      contractAddress: process.env.CONTRACT_ADDRESS,
      contractABI: contractABI
    });
  } catch (error) {
    console.warn('⚠️  Blockchain service not initialized:', error);
  }
}

// Initialize VC service
const vcService = new VCService(
  process.env.VC_PRIVATE_KEY || 'default-dev-key',
  process.env.ISSUER_ID || 'did:example:issuer123',
  process.env.ISSUER_NAME || 'CertifyChain Educational Institution'
);

// POST /api/issue - Issue a new certificate
router.post('/issue', upload.single('certificate'), async (req, res) => {
  try {
    const { studentName, walletAddress } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Certificate file is required' });
    }

    if (!studentName || !walletAddress) {
      return res.status(400).json({ error: 'Student name and wallet address are required' });
    }

    // Generate unique certificate ID
    const certID = crypto.randomUUID();
    const filePath = file.path;

    // Step 1: OCR processing
    console.log('🔍 Processing OCR for certificate:', certID);
    const ocrResult = await ocrService.extractText(filePath);
    const extractedInfo = ocrService.extractCertificateInfo(ocrResult);

    if (!ocrService.validateOCRQuality(ocrResult)) {
      return res.status(400).json({
        error: 'OCR quality too low',
        confidence: ocrResult.confidence,
        minRequired: 80
      });
    }

    // Step 2: AI anomaly detection
    console.log('🤖 Running AI anomaly detection for certificate:', certID);
    const submission = {
      studentName,
      walletAddress,
      timestamp: new Date(),
      ocrResult,
      extractedInfo
    };

    const anomalyResult = await aiService.detectAnomalies(submission);

    // Step 3: Create file hash
    const fileBuffer = fs.readFileSync(filePath);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const ocrHash = crypto.createHash('sha256').update(ocrResult.text).digest('hex');

    // Step 4: Create Verifiable Credential
    const achievement = {
      name: extractedInfo.course || 'Certificate',
      description: `Certificate issued to ${studentName}`,
      institution: extractedInfo.institution || 'Unknown Institution',
      grade: extractedInfo.grade,
      issueDate: extractedInfo.issueDate
    };

    const vc = vcService.createVC(
      studentName,
      walletAddress,
      ocrResult,
      extractedInfo,
      anomalyResult.anomalyScore,
      anomalyResult.flags,
      achievement
    );

    const signedVC = vcService.signVC(vc);
    const vcHash = vcService.createVCHash(vc);
    const aiHash = crypto.createHash('sha256').update(JSON.stringify(anomalyResult)).digest('hex');

    // Step 5: Store on blockchain (if available)
    let txHash = '';
    if (blockchainService) {
      console.log('⛓️  Storing certificate on blockchain:', certID);
      const blockchainResult = await blockchainService.issueCertificate(
        certID,
        fileHash,
        ocrHash,
        aiHash,
        vcHash, // Using VC hash as QR hash
        anomalyResult.anomalyScore,
        JSON.stringify({ ocrConfidence: ocrResult.confidence, flags: anomalyResult.flags })
      );

      if (blockchainResult.success) {
        txHash = blockchainResult.txHash!;
      } else {
        console.error('Blockchain storage failed:', blockchainResult.error);
        return res.status(500).json({
          error: 'Failed to store certificate on blockchain',
          details: blockchainResult.error
        });
      }
    }

    // Step 6: Store in database
    console.log('💾 Storing certificate in database:', certID);
    await dbService.storeCertificate({
      id: certID,
      studentName,
      walletAddress,
      fileHash,
      ocrText: ocrResult.text,
      ocrHash,
      aiHash,
      vcJson: signedVC,
      anomalyScore: anomalyResult.anomalyScore,
      flags: JSON.stringify(anomalyResult.flags),
      txHash,
      contractAddress: process.env.CONTRACT_ADDRESS || ''
    });

    // Clean up uploaded file after processing
    fs.unlinkSync(filePath);

    console.log('✅ Certificate issued successfully:', certID);
    res.json({
      id: certID,
      txHash,
      vcJson: vc, // Return unsigned VC for display
      anomalyScore: anomalyResult.anomalyScore,
      flags: anomalyResult.flags,
      extractedInfo,
      ocrConfidence: ocrResult.confidence
    });

  } catch (error) {
    console.error('Error issuing certificate:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Failed to issue certificate',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/verify/:id - Verify a certificate
router.get('/verify/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get certificate from database
    const certificate = await dbService.getCertificate(id);
    if (!certificate) {
      return res.status(404).json({
        error: 'Certificate not found',
        verified: false
      });
    }

    let blockchainValid = false;
    let blockchainData = null;

    // Verify on blockchain if available
    if (blockchainService) {
      const blockchainResult = await blockchainService.verifyCertificate(id);
      if (blockchainResult.success && blockchainResult.exists) {
        blockchainValid = blockchainResult.valid || false;
        blockchainData = blockchainResult.certificateData;
      }
    }

    // Check if hashes match
    const hashesMatch = blockchainData ? 
      blockchainData.fileHash === certificate.fileHash &&
      blockchainData.ocrHash === certificate.ocrHash &&
      blockchainData.aiHash === certificate.aiHash : true;

    const verified = hashesMatch && (blockchainService ? blockchainValid : true);
    const anomalyFlagged = certificate.anomalyScore >= 50;

    // Update verification status in database
    await dbService.updateVerificationStatus(id, verified);

    res.json({
      verified,
      anomaly: anomalyFlagged,
      anomalyScore: certificate.anomalyScore,
      flags: JSON.parse(certificate.flags || '[]'),
      blockchain: {
        valid: blockchainValid,
        data: blockchainData
      },
      certificate: {
        id: certificate.id,
        studentName: certificate.studentName,
        timestamp: certificate.timestamp,
        txHash: certificate.txHash
      }
    });

  } catch (error) {
    console.error('Error verifying certificate:', error);
    res.status(500).json({
      error: 'Failed to verify certificate',
      verified: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/view/:id - View certificate details
router.get('/view/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get certificate from database
    const certificate = await dbService.getCertificate(id);
    if (!certificate) {
      return res.status(404).json({
        error: 'Certificate not found'
      });
    }

    // Get VC from signed JWT
    const vc = vcService.extractVCFromJWT(certificate.vcJson);

    // Get blockchain data if available
    let blockchainData = null;
    if (blockchainService) {
      const blockchainResult = await blockchainService.getCertificateDetails(id);
      if (blockchainResult.success && blockchainResult.exists) {
        blockchainData = blockchainResult.data;
      }
    }

    res.json({
      certificate: {
        id: certificate.id,
        studentName: certificate.studentName,
        walletAddress: certificate.walletAddress,
        timestamp: certificate.timestamp,
        verified: certificate.verified,
        anomalyScore: certificate.anomalyScore,
        flags: JSON.parse(certificate.flags || '[]'),
        txHash: certificate.txHash
      },
      ocrText: certificate.ocrText,
      vcJson: vc,
      blockchain: blockchainData
    });

  } catch (error) {
    console.error('Error viewing certificate:', error);
    res.status(500).json({
      error: 'Failed to view certificate',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/certificates/:walletAddress - Get certificates by wallet
router.get('/certificates/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const certificates = await dbService.getCertificatesByWallet(walletAddress);

    res.json({
      certificates: certificates.map(cert => ({
        id: cert.id,
        studentName: cert.studentName,
        timestamp: cert.timestamp,
        verified: cert.verified,
        anomalyScore: cert.anomalyScore,
        txHash: cert.txHash
      }))
    });

  } catch (error) {
    console.error('Error getting certificates by wallet:', error);
    res.status(500).json({
      error: 'Failed to get certificates',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;