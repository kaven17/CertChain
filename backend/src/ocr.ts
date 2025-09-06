import { createWorker } from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
}

export class OCRService {
  private worker: any;

  async initializeWorker(): Promise<void> {
    this.worker = await createWorker('eng');
  }

  async extractText(imagePath: string): Promise<OCRResult> {
    if (!this.worker) {
      await this.initializeWorker();
    }

    const { data } = await this.worker.recognize(imagePath);
    
    return {
      text: data.text,
      confidence: data.confidence,
      words: data.words.map((word: any) => ({
        text: word.text,
        confidence: word.confidence,
        bbox: word.bbox
      }))
    };
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
    }
  }

  // Extract key information from certificate text
  extractCertificateInfo(ocrResult: OCRResult): {
    studentName: string | null;
    institution: string | null;
    course: string | null;
    grade: string | null;
    issueDate: string | null;
  } {
    const text = ocrResult.text.toLowerCase();
    
    // Simple pattern matching - can be enhanced with more sophisticated NLP
    const studentNameMatch = text.match(/(?:name|student|recipient)[:\s]*([\w\s]+)/i);
    const institutionMatch = text.match(/(?:university|college|institute|school)[:\s]*([\w\s]+)/i);
    const courseMatch = text.match(/(?:course|program|degree|diploma)[:\s]*([\w\s]+)/i);
    const gradeMatch = text.match(/(?:grade|result|score)[:\s]*([\w\+\-]+)/i);
    const dateMatch = text.match(/(?:date|issued)[:\s]*([\d\/\-\.]+)/i);

    return {
      studentName: studentNameMatch ? studentNameMatch[1].trim() : null,
      institution: institutionMatch ? institutionMatch[1].trim() : null,
      course: courseMatch ? courseMatch[1].trim() : null,
      grade: gradeMatch ? gradeMatch[1].trim() : null,
      issueDate: dateMatch ? dateMatch[1].trim() : null,
    };
  }

  // Validate OCR quality
  validateOCRQuality(ocrResult: OCRResult, minimumConfidence: number = 80): boolean {
    return ocrResult.confidence >= minimumConfidence;
  }
}