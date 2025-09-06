import { OCRResult } from './ocr';

export interface AnomalyDetectionResult {
  anomalyScore: number;
  flags: string[];
  confidence: number;
}

export interface CertificateSubmission {
  studentName: string;
  walletAddress: string;
  timestamp: Date;
  ocrResult: OCRResult;
  extractedInfo: {
    studentName: string | null;
    institution: string | null;
    course: string | null;
    grade: string | null;
    issueDate: string | null;
  };
}

export class AIService {
  private recentSubmissions: Map<string, CertificateSubmission[]> = new Map();
  
  // Rule-based anomaly detection
  async detectAnomalies(
    submission: CertificateSubmission,
    timeWindow: number = 30 * 60 * 1000, // 30 minutes in milliseconds
    maxSubmissions: number = 3
  ): Promise<AnomalyDetectionResult> {
    const flags: string[] = [];
    let anomalyScore = 10; // Base score

    // Rule 1: Check for duplicate submissions from same student in time window
    const studentSubmissions = this.getRecentSubmissions(
      submission.walletAddress,
      timeWindow
    );
    
    if (studentSubmissions.length > maxSubmissions) {
      flags.push(`Multiple submissions detected: ${studentSubmissions.length} in ${timeWindow / 60000} minutes`);
      anomalyScore += 30;
    }

    // Rule 2: Compare OCR extracted name with provided student name
    if (submission.extractedInfo.studentName && submission.studentName) {
      const similarity = this.calculateNameSimilarity(
        submission.extractedInfo.studentName,
        submission.studentName
      );
      
      if (similarity < 0.7) { // Less than 70% similarity
        flags.push('Name mismatch between OCR and provided name');
        anomalyScore += 40;
      }
    }

    // Rule 3: Check OCR confidence
    if (submission.ocrResult.confidence < 80) {
      flags.push('Low OCR confidence score');
      anomalyScore += 20;
    }

    // Rule 4: Check for suspicious patterns in text
    const suspiciousPatterns = this.checkSuspiciousPatterns(submission.ocrResult.text);
    if (suspiciousPatterns.length > 0) {
      flags.push(...suspiciousPatterns);
      anomalyScore += suspiciousPatterns.length * 15;
    }

    // Rule 5: Check for missing critical information
    const missingInfo = this.checkMissingInformation(submission.extractedInfo);
    if (missingInfo.length > 0) {
      flags.push(...missingInfo);
      anomalyScore += missingInfo.length * 10;
    }

    // Rule 6: Check for future dates
    if (submission.extractedInfo.issueDate) {
      const issueDate = new Date(submission.extractedInfo.issueDate);
      if (issueDate > new Date()) {
        flags.push('Certificate issue date is in the future');
        anomalyScore += 25;
      }
    }

    // Store this submission for future comparisons
    this.storeSubmission(submission);

    // Cap the anomaly score at 100
    anomalyScore = Math.min(anomalyScore, 100);

    return {
      anomalyScore,
      flags,
      confidence: this.calculateConfidence(flags.length, submission.ocrResult.confidence)
    };
  }

  private getRecentSubmissions(
    walletAddress: string,
    timeWindow: number
  ): CertificateSubmission[] {
    const submissions = this.recentSubmissions.get(walletAddress) || [];
    const cutoffTime = new Date(Date.now() - timeWindow);
    
    return submissions.filter(sub => sub.timestamp > cutoffTime);
  }

  private storeSubmission(submission: CertificateSubmission): void {
    const existing = this.recentSubmissions.get(submission.walletAddress) || [];
    existing.push(submission);
    
    // Keep only last 10 submissions per wallet
    if (existing.length > 10) {
      existing.splice(0, existing.length - 10);
    }
    
    this.recentSubmissions.set(submission.walletAddress, existing);
  }

  private calculateNameSimilarity(name1: string, name2: string): number {
    // Simple Jaccard similarity for name comparison
    const words1 = name1.toLowerCase().split(/\s+/);
    const words2 = name2.toLowerCase().split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private checkSuspiciousPatterns(text: string): string[] {
    const flags: string[] = [];
    const lowerText = text.toLowerCase();

    // Check for common fraud indicators
    const fraudPatterns = [
      /copy|duplicate|fake|forged|counterfeit/i,
      /photoshop|edited|modified/i,
      /template|sample|example/i
    ];

    fraudPatterns.forEach((pattern, index) => {
      if (pattern.test(text)) {
        flags.push(`Suspicious pattern detected: ${['copy/fake terms', 'editing terms', 'template terms'][index]}`);
      }
    });

    // Check for inconsistent formatting or encoding issues
    if (text.includes('�') || text.includes('\uFFFD')) {
      flags.push('Text encoding issues detected');
    }

    // Check for extremely short or long text (might indicate OCR failure)
    if (text.trim().length < 50) {
      flags.push('Unusually short certificate text');
    } else if (text.length > 5000) {
      flags.push('Unusually long certificate text');
    }

    return flags;
  }

  private checkMissingInformation(extractedInfo: any): string[] {
    const flags: string[] = [];
    const requiredFields = ['studentName', 'institution'];

    requiredFields.forEach(field => {
      if (!extractedInfo[field]) {
        flags.push(`Missing ${field} information`);
      }
    });

    return flags;
  }

  private calculateConfidence(flagCount: number, ocrConfidence: number): number {
    // Base confidence starts high and decreases with more flags
    let confidence = 90 - (flagCount * 15);
    
    // Factor in OCR confidence
    confidence = (confidence + ocrConfidence) / 2;
    
    return Math.max(0, Math.min(100, confidence));
  }

  // Clean up old submissions periodically
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void { // 24 hours
    const cutoffTime = new Date(Date.now() - maxAge);
    
    for (const [wallet, submissions] of this.recentSubmissions.entries()) {
      const filtered = submissions.filter(sub => sub.timestamp > cutoffTime);
      
      if (filtered.length === 0) {
        this.recentSubmissions.delete(wallet);
      } else {
        this.recentSubmissions.set(wallet, filtered);
      }
    }
  }
}