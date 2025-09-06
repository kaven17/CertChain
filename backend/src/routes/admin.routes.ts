import { Router, Request, Response } from 'express';
import { DatabaseService } from '../database';
import { OCRService } from '../ocr';
import { EnhancedAIService, CertificateSubmission } from '../enhanced-ai';
import { QRCodeService } from '../qrcode-service';
import { VCService } from '../vc';
import multer from 'multer';
import csv from 'csv-parser';
import crypto from 'crypto';
import { Readable } from 'stream';

const router = Router();
const db = new DatabaseService();
const ocrService = new OCRService();
const aiService = new EnhancedAIService();
const qrCodeService = new QRCodeService();
const vcService = new VCService();

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// GET /api/admin/analytics - Get system analytics
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const analytics = await db.getAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/admin/audit-logs - Get audit logs
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const certificateId = req.query.certificateId as string;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const logs = await db.getAuditLog(certificateId, limit);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// POST /api/admin/bulk-upload - Bulk upload certificates from CSV
router.post('/bulk-upload', upload.single('csvFile'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    const issuerWallet = req.body.issuerWallet;
    if (!issuerWallet) {
      return res.status(400).json({ error: 'Issuer wallet address is required' });
    }

    // Parse CSV data
    const csvData: any[] = [];
    const csvStream = Readable.from(req.file.buffer.toString());
    
    await new Promise((resolve, reject) => {
      csvStream
        .pipe(csv())
        .on('data', (data) => csvData.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    if (csvData.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty or invalid' });
    }

    // Process certificates in batches
    const certificates = [];
    const errors: string[] = [];
    let processed = 0;

    for (const row of csvData) {
      try {
        processed++;
        
        // Validate required fields
        if (!row.studentName || !row.walletAddress) {
          errors.push(`Row ${processed}: Missing required fields (studentName, walletAddress)`);
          continue;
        }

        // Generate certificate data
        const certificateId = crypto.randomUUID();
        const timestamp = new Date();
        
        // Create synthetic OCR result for bulk data
        const syntheticOCRText = `
          CERTIFICATE OF COMPLETION
          Student Name: ${row.studentName}
          Roll Number: ${row.rollNumber || 'N/A'}
          Course: ${row.course || 'General Course'}
          Grade: ${row.grade || 'Pass'}
          Issue Date: ${row.issueDate || timestamp.toDateString()}
          Certificate Type: ${row.certificateType || 'ACADEMIC'}
        `.trim();

        const ocrResult = {
          text: syntheticOCRText,
          confidence: 95, // High confidence for structured data
          words: [],
          lines: [],
          paragraphs: [],
          blocks: []
        };

        // Extract information
        const extractedInfo = {
          studentName: row.studentName,
          rollNumber: row.rollNumber || null,
          institution: row.institutionName || 'Bulk Upload Institution',
          course: row.course || null,
          grade: row.grade || null,
          issueDate: row.issueDate || null,
          certificateID: certificateId
        };

        // Generate hashes
        const fileHash = crypto.createHash('sha256').update(`bulk_${certificateId}_${timestamp.toISOString()}`).digest('hex');
        const ocrHash = crypto.createHash('sha256').update(syntheticOCRText).digest('hex');

        // Create certificate submission for AI analysis
        const submission: CertificateSubmission = {
          studentName: row.studentName,
          rollNumber: row.rollNumber,
          walletAddress: row.walletAddress,
          issuerWallet,
          timestamp,
          ocrResult,
          extractedInfo,
          fileHash
        };

        // Run AI analysis
        const aiAnalysis = await aiService.detectAnomalies(submission);

        // Generate Verifiable Credential
        const vcData = {
          studentName: row.studentName,
          rollNumber: row.rollNumber,
          course: row.course,
          grade: row.grade,
          institution: row.institutionName || 'Bulk Upload Institution',
          issueDate: row.issueDate || timestamp.toDateString(),
          certificateId: certificateId,
          issuerWallet
        };

        const vc = vcService.createVerifiableCredential(vcData, fileHash);

        // Generate QR code
        const qrData = qrCodeService.generateQRData(certificateId);
        const qrCodeDataURL = await qrCodeService.generateQRCode(qrData);

        // Create certificate object
        const certificate = {
          id: certificateId,
          studentName: row.studentName,
          rollNumber: row.rollNumber || undefined,
          walletAddress: row.walletAddress,
          issuerWallet,
          fileHash,
          ocrText: syntheticOCRText,
          ocrHash,
          aiHash: aiAnalysis.aiHash,
          vcJson: JSON.stringify(vc),
          anomalyScore: aiAnalysis.anomalyScore,
          trustIndex: aiAnalysis.trustIndex,
          riskLevel: aiAnalysis.riskLevel,
          flags: JSON.stringify(aiAnalysis.flags),
          txHash: '', // Will be updated when blockchain is deployed
          contractAddress: process.env.CONTRACT_ADDRESS || '',
          qrCodeData: qrCodeDataURL,
          institutionName: row.institutionName || undefined,
          courseName: row.course || undefined,
          grade: row.grade || undefined,
          issueDate: row.issueDate || undefined,
          certificateType: row.certificateType || 'ACADEMIC',
          status: 'ACTIVE' as const
        };

        certificates.push(certificate);

      } catch (error) {
        errors.push(`Row ${processed}: ${error instanceof Error ? error.message : 'Processing error'}`);
      }
    }

    // Store certificates in bulk
    const result = await db.storeCertificateBulk(certificates);
    
    res.json({
      message: 'Bulk upload completed',
      processed: csvData.length,
      success: result.success,
      failed: result.failed,
      errors: [...errors, ...result.errors]
    });

  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ error: 'Bulk upload failed' });
  }
});

// POST /api/admin/register-institution - Register a new institution
router.post('/register-institution', async (req: Request, res: Response) => {
  try {
    const { walletAddress, institutionName, authorizedCourses } = req.body;

    if (!walletAddress || !institutionName) {
      return res.status(400).json({ error: 'Wallet address and institution name are required' });
    }

    const institution = {
      walletAddress,
      institutionName,
      trustScore: 0.5, // Default trust score
      verificationStatus: 'PENDING' as const,
      authorizedCourses: authorizedCourses || []
    };

    await db.registerInstitution(institution);

    // Register with AI service for validation
    aiService.registerInstitution(walletAddress, {
      institutionName,
      walletAddress,
      trustScore: 0.5,
      verificationStatus: 'PENDING',
      authorizedCourses: authorizedCourses || [],
      registrationDate: new Date()
    });

    res.json({ 
      message: 'Institution registered successfully',
      institution
    });

  } catch (error) {
    console.error('Institution registration error:', error);
    res.status(500).json({ error: 'Failed to register institution' });
  }
});

// GET /api/admin/institutions - Get all registered institutions
router.get('/institutions', async (req: Request, res: Response) => {
  try {
    // Since we don't have a getAllInstitutions method, we'll return a placeholder
    // This would be implemented in a production system
    res.json({ message: 'Institutions list endpoint - to be implemented' });
  } catch (error) {
    console.error('Error fetching institutions:', error);
    res.status(500).json({ error: 'Failed to fetch institutions' });
  }
});

// POST /api/admin/revoke-certificate - Revoke a certificate
router.post('/revoke-certificate', async (req: Request, res: Response) => {
  try {
    const { certificateId, actorWallet, reason } = req.body;

    if (!certificateId || !actorWallet) {
      return res.status(400).json({ error: 'Certificate ID and actor wallet are required' });
    }

    await db.updateCertificateStatus(certificateId, 'REVOKED', actorWallet);

    res.json({ 
      message: 'Certificate revoked successfully',
      certificateId,
      status: 'REVOKED'
    });

  } catch (error) {
    console.error('Certificate revocation error:', error);
    res.status(500).json({ error: 'Failed to revoke certificate' });
  }
});

// GET /api/admin/flagged-certificates - Get certificates with high anomaly scores
router.get('/flagged-certificates', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const minAnomalyScore = parseFloat(req.query.minScore as string) || 0.5;

    // This would require a specific database query method
    // For now, return a placeholder response
    res.json({ 
      message: 'Flagged certificates endpoint - query implementation needed',
      filters: { limit, minAnomalyScore }
    });

  } catch (error) {
    console.error('Error fetching flagged certificates:', error);
    res.status(500).json({ error: 'Failed to fetch flagged certificates' });
  }
});

export default router;