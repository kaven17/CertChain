import { OCRResult } from './ocr';
import crypto from 'crypto';

export interface EnhancedAnomalyDetectionResult {
  anomalyScore: number; // 0-1 scale (0 = trusted, 1 = highly suspicious)
  trustIndex: number; // 0-1 scale (1 = highly trusted, 0 = not trusted)
  flags: AnomalyFlag[];
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  aiHash: string; // Hash of the AI analysis vector
}

export interface AnomalyFlag {
  type: 'FRAUD' | 'TAMPERING' | 'INCONSISTENCY' | 'FORMAT' | 'DUPLICATE' | 'SUSPICIOUS_PATTERN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  confidence: number;
}

export interface CertificateSubmission {
  studentName: string;
  rollNumber?: string;
  walletAddress: string;
  issuerWallet: string;
  timestamp: Date;
  ocrResult: OCRResult;
  extractedInfo: {
    studentName: string | null;
    rollNumber: string | null;
    institution: string | null;
    course: string | null;
    grade: string | null;
    issueDate: string | null;
    certificateID: string | null;
  };
  fileHash: string;
}

export class EnhancedAIService {
  private recentSubmissions: Map<string, CertificateSubmission[]> = new Map();
  private institutionProfiles: Map<string, InstitutionProfile> = new Map();
  private suspiciousPatterns: string[] = [
    'copy', 'duplicate', 'fake', 'forged', 'counterfeit', 'photoshop', 
    'edited', 'modified', 'template', 'sample', 'example', 'test'
  ];

  // Enhanced anomaly detection with trust index
  async detectAnomalies(
    submission: CertificateSubmission,
    timeWindow: number = 30 * 60 * 1000, // 30 minutes
    maxSubmissions: number = 3
  ): Promise<EnhancedAnomalyDetectionResult> {
    const flags: AnomalyFlag[] = [];
    let anomalyScore = 0;

    // 1. Rate limiting analysis
    const rateLimitFlags = this.checkRateLimit(submission, timeWindow, maxSubmissions);
    flags.push(...rateLimitFlags);
    anomalyScore += rateLimitFlags.length * 0.15;

    // 2. Name consistency analysis
    const nameFlags = this.checkNameConsistency(submission);
    flags.push(...nameFlags);
    anomalyScore += nameFlags.length * 0.2;

    // 3. OCR quality analysis
    const ocrFlags = this.checkOCRQuality(submission.ocrResult);
    flags.push(...ocrFlags);
    anomalyScore += ocrFlags.length * 0.1;

    // 4. Document forgery patterns
    const forgeryFlags = this.checkForgeryPatterns(submission.ocrResult.text);
    flags.push(...forgeryFlags);
    anomalyScore += forgeryFlags.length * 0.25;

    // 5. Data completeness analysis
    const completenessFlags = this.checkDataCompleteness(submission.extractedInfo);
    flags.push(...completenessFlags);
    anomalyScore += completenessFlags.length * 0.1;

    // 6. Temporal consistency analysis
    const temporalFlags = this.checkTemporalConsistency(submission.extractedInfo);
    flags.push(...temporalFlags);
    anomalyScore += temporalFlags.length * 0.15;

    // 7. Institution validation
    const institutionFlags = await this.checkInstitutionConsistency(submission);
    flags.push(...institutionFlags);
    anomalyScore += institutionFlags.length * 0.2;

    // 8. Format and structure analysis
    const formatFlags = this.checkDocumentFormat(submission.ocrResult);
    flags.push(...formatFlags);
    anomalyScore += formatFlags.length * 0.1;

    // Normalize anomaly score to 0-1 range
    anomalyScore = Math.min(1, anomalyScore);

    // Calculate trust index (inverse of anomaly score with additional factors)
    const trustIndex = this.calculateTrustIndex(anomalyScore, submission, flags);

    // Determine risk level
    const riskLevel = this.calculateRiskLevel(anomalyScore, flags);

    // Generate AI analysis hash
    const aiHash = this.generateAIHash(flags, anomalyScore, trustIndex, submission);

    // Store submission for future analysis
    this.storeSubmission(submission);

    return {
      anomalyScore,
      trustIndex,
      flags,
      confidence: this.calculateConfidence(flags.length, submission.ocrResult.confidence),
      riskLevel,
      aiHash
    };
  }

  private checkRateLimit(
    submission: CertificateSubmission,
    timeWindow: number,
    maxSubmissions: number
  ): AnomalyFlag[] {
    const flags: AnomalyFlag[] = [];
    const submissions = this.getRecentSubmissions(submission.walletAddress, timeWindow);
    
    if (submissions.length > maxSubmissions) {
      flags.push({
        type: 'DUPLICATE',
        severity: 'HIGH',
        description: `${submissions.length} submissions from same wallet in ${timeWindow / 60000} minutes`,
        confidence: 0.9
      });
    }

    // Check for identical file hashes (exact duplicates)
    const duplicateFile = submissions.find(s => s.fileHash === submission.fileHash);
    if (duplicateFile) {
      flags.push({
        type: 'DUPLICATE',
        severity: 'CRITICAL',
        description: 'Identical file submitted previously',
        confidence: 1.0
      });
    }

    return flags;
  }

  private checkNameConsistency(submission: CertificateSubmission): AnomalyFlag[] {
    const flags: AnomalyFlag[] = [];
    
    if (submission.extractedInfo.studentName && submission.studentName) {
      const similarity = this.calculateNameSimilarity(
        submission.extractedInfo.studentName,
        submission.studentName
      );
      
      if (similarity < 0.6) {
        flags.push({
          type: 'INCONSISTENCY',
          severity: 'HIGH',
          description: `Name mismatch: OCR "${submission.extractedInfo.studentName}" vs provided "${submission.studentName}"`,
          confidence: 1 - similarity
        });
      }
    }

    return flags;
  }

  private checkOCRQuality(ocrResult: OCRResult): AnomalyFlag[] {
    const flags: AnomalyFlag[] = [];

    if (ocrResult.confidence < 70) {
      flags.push({
        type: 'FORMAT',
        severity: 'MEDIUM',
        description: `Low OCR confidence: ${ocrResult.confidence}%`,
        confidence: (70 - ocrResult.confidence) / 70
      });
    }

    // Check for encoding issues
    if (ocrResult.text.includes('�') || ocrResult.text.includes('\uFFFD')) {
      flags.push({
        type: 'TAMPERING',
        severity: 'MEDIUM',
        description: 'Text encoding issues detected',
        confidence: 0.7
      });
    }

    return flags;
  }

  private checkForgeryPatterns(text: string): AnomalyFlag[] {
    const flags: AnomalyFlag[] = [];
    const lowerText = text.toLowerCase();

    this.suspiciousPatterns.forEach(pattern => {
      if (lowerText.includes(pattern)) {
        flags.push({
          type: 'FRAUD',
          severity: 'HIGH',
          description: `Suspicious keyword detected: "${pattern}"`,
          confidence: 0.8
        });
      }
    });

    // Check for repeated patterns (copy-paste indicators)
    const words = text.split(/\s+/);
    const wordFreq: { [key: string]: number } = {};
    words.forEach(word => {
      if (word.length > 3) {
        wordFreq[word.toLowerCase()] = (wordFreq[word.toLowerCase()] || 0) + 1;
      }
    });

    Object.entries(wordFreq).forEach(([word, count]) => {
      if (count > 5 && word.length > 4) {
        flags.push({
          type: 'SUSPICIOUS_PATTERN',
          severity: 'MEDIUM',
          description: `Word "${word}" repeated ${count} times`,
          confidence: Math.min(0.9, count / 10)
        });
      }
    });

    return flags;
  }

  private checkDataCompleteness(extractedInfo: any): AnomalyFlag[] {
    const flags: AnomalyFlag[] = [];
    const requiredFields = ['studentName', 'institution'];
    const recommendedFields = ['course', 'issueDate'];

    requiredFields.forEach(field => {
      if (!extractedInfo[field]) {
        flags.push({
          type: 'FORMAT',
          severity: 'MEDIUM',
          description: `Missing required field: ${field}`,
          confidence: 0.7
        });
      }
    });

    const missingRecommended = recommendedFields.filter(field => !extractedInfo[field]);
    if (missingRecommended.length > 1) {
      flags.push({
        type: 'FORMAT',
        severity: 'LOW',
        description: `Missing recommended fields: ${missingRecommended.join(', ')}`,
        confidence: 0.5
      });
    }

    return flags;
  }

  private checkTemporalConsistency(extractedInfo: any): AnomalyFlag[] {
    const flags: AnomalyFlag[] = [];

    if (extractedInfo.issueDate) {
      try {
        const issueDate = new Date(extractedInfo.issueDate);
        const now = new Date();
        
        if (issueDate > now) {
          flags.push({
            type: 'INCONSISTENCY',
            severity: 'HIGH',
            description: 'Certificate issue date is in the future',
            confidence: 0.9
          });
        }

        // Check if date is too old (more than 50 years)
        const fiftyYearsAgo = new Date();
        fiftyYearsAgo.setFullYear(now.getFullYear() - 50);
        
        if (issueDate < fiftyYearsAgo) {
          flags.push({
            type: 'INCONSISTENCY',
            severity: 'LOW',
            description: 'Certificate issue date is unusually old',
            confidence: 0.6
          });
        }
      } catch {
        flags.push({
          type: 'FORMAT',
          severity: 'LOW',
          description: 'Invalid date format',
          confidence: 0.5
        });
      }
    }

    return flags;
  }

  private async checkInstitutionConsistency(submission: CertificateSubmission): Promise<AnomalyFlag[]> {
    const flags: AnomalyFlag[] = [];

    // Check if issuer wallet is authorized for claimed institution
    if (submission.extractedInfo.institution) {
      const profile = this.institutionProfiles.get(submission.issuerWallet);
      
      if (profile && profile.institutionName.toLowerCase() !== submission.extractedInfo.institution.toLowerCase()) {
        flags.push({
          type: 'FRAUD',
          severity: 'CRITICAL',
          description: `Issuer wallet authorized for "${profile.institutionName}" but certificate claims "${submission.extractedInfo.institution}"`,
          confidence: 0.95
        });
      }
    }

    return flags;
  }

  private checkDocumentFormat(ocrResult: OCRResult): AnomalyFlag[] {
    const flags: AnomalyFlag[] = [];
    const text = ocrResult.text;

    // Check text length
    if (text.length < 100) {
      flags.push({
        type: 'FORMAT',
        severity: 'MEDIUM',
        description: 'Certificate text is unusually short',
        confidence: 0.6
      });
    } else if (text.length > 10000) {
      flags.push({
        type: 'FORMAT',
        severity: 'LOW',
        description: 'Certificate text is unusually long',
        confidence: 0.4
      });
    }

    // Check for proper certificate structure
    const hasHeader = /certificate|diploma|degree/i.test(text);
    const hasName = /name|student|recipient/i.test(text);
    const hasInstitution = /university|college|institute|school/i.test(text);
    
    if (!hasHeader || !hasName || !hasInstitution) {
      flags.push({
        type: 'FORMAT',
        severity: 'MEDIUM',
        description: 'Document does not follow standard certificate format',
        confidence: 0.7
      });
    }

    return flags;
  }

  private calculateTrustIndex(
    anomalyScore: number,
    submission: CertificateSubmission,
    flags: AnomalyFlag[]
  ): number {
    let trustIndex = 1 - anomalyScore;

    // Boost trust for high OCR confidence
    if (submission.ocrResult.confidence > 90) {
      trustIndex += 0.1;
    }

    // Reduce trust for critical flags
    const criticalFlags = flags.filter(f => f.severity === 'CRITICAL');
    trustIndex -= criticalFlags.length * 0.3;

    // Institutional trust boost
    const profile = this.institutionProfiles.get(submission.issuerWallet);
    if (profile && profile.trustScore > 0.8) {
      trustIndex += 0.1;
    }

    return Math.max(0, Math.min(1, trustIndex));
  }

  private calculateRiskLevel(anomalyScore: number, flags: AnomalyFlag[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const criticalFlags = flags.filter(f => f.severity === 'CRITICAL').length;
    const highFlags = flags.filter(f => f.severity === 'HIGH').length;

    if (criticalFlags > 0 || anomalyScore > 0.8) return 'CRITICAL';
    if (highFlags > 1 || anomalyScore > 0.6) return 'HIGH';
    if (anomalyScore > 0.3) return 'MEDIUM';
    return 'LOW';
  }

  private generateAIHash(
    flags: AnomalyFlag[],
    anomalyScore: number,
    trustIndex: number,
    submission: CertificateSubmission
  ): string {
    const analysisVector = {
      flags: flags.map(f => ({ type: f.type, severity: f.severity, confidence: f.confidence })),
      anomalyScore,
      trustIndex,
      timestamp: submission.timestamp.toISOString(),
      ocrConfidence: submission.ocrResult.confidence
    };

    return crypto.createHash('sha256').update(JSON.stringify(analysisVector)).digest('hex');
  }

  private calculateNameSimilarity(name1: string, name2: string): number {
    const words1 = name1.toLowerCase().split(/\s+/);
    const words2 = name2.toLowerCase().split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private getRecentSubmissions(walletAddress: string, timeWindow: number): CertificateSubmission[] {
    const submissions = this.recentSubmissions.get(walletAddress) || [];
    const cutoffTime = new Date(Date.now() - timeWindow);
    
    return submissions.filter(sub => sub.timestamp > cutoffTime);
  }

  private storeSubmission(submission: CertificateSubmission): void {
    const existing = this.recentSubmissions.get(submission.walletAddress) || [];
    existing.push(submission);
    
    if (existing.length > 20) {
      existing.splice(0, existing.length - 20);
    }
    
    this.recentSubmissions.set(submission.walletAddress, existing);
  }

  private calculateConfidence(flagCount: number, ocrConfidence: number): number {
    let confidence = 90 - (flagCount * 10);
    confidence = (confidence + ocrConfidence) / 2;
    return Math.max(0, Math.min(100, confidence));
  }

  // Register institution profile for DID wallet validation
  registerInstitution(walletAddress: string, profile: InstitutionProfile): void {
    this.institutionProfiles.set(walletAddress, profile);
  }
}

interface InstitutionProfile {
  institutionName: string;
  walletAddress: string;
  trustScore: number; // 0-1
  verificationStatus: 'VERIFIED' | 'PENDING' | 'REVOKED';
  authorizedCourses: string[];
  registrationDate: Date;
}