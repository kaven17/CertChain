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
    rollNumber: string | null;
    institution: string | null;
    course: string | null;
    grade: string | null;
    issueDate: string | null;
    certificateID: string | null;
  } {
    const text = ocrResult.text.toLowerCase();
    
    // Enhanced pattern matching for better extraction
    const studentNameMatch = text.match(/(?:name|student|recipient|candidate)[:\s-]*([\w\s\.]+?)(?:\n|roll|id|course)/i);
    const rollNumberMatch = text.match(/(?:roll|registration|reg|id)[:\s#-]*([a-zA-Z0-9\/\-]+)/i);
    const institutionMatch = text.match(/(?:university|college|institute|school|academy)[:\s]*([\w\s&\.]+?)(?:\n|course|department)/i);
    const courseMatch = text.match(/(?:course|program|degree|diploma|bachelor|master|b\.tech|m\.tech|mba|bba)[:\s]*([\w\s\.\,\&]+?)(?:\n|grade|result|date)/i);
    const gradeMatch = text.match(/(?:grade|result|score|cgpa|percentage|marks)[:\s]*([a-zA-Z0-9\+\-\.%\s]+?)(?:\n|date|issued)/i);
    const dateMatch = text.match(/(?:date|issued|awarded)[:\s]*([\d]{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
    const certificateIDMatch = text.match(/(?:certificate|cert|id|number|no)[:\s#]*([a-zA-Z0-9\/\-]+)/i);

    return {
      studentName: studentNameMatch ? studentNameMatch[1].trim().replace(/\s+/g, ' ') : null,
      rollNumber: rollNumberMatch ? rollNumberMatch[1].trim() : null,
      institution: institutionMatch ? institutionMatch[1].trim().replace(/\s+/g, ' ') : null,
      course: courseMatch ? courseMatch[1].trim().replace(/\s+/g, ' ') : null,
      grade: gradeMatch ? gradeMatch[1].trim() : null,
      issueDate: dateMatch ? dateMatch[1].trim() : null,
      certificateID: certificateIDMatch ? certificateIDMatch[1].trim() : null,
    };
  }

  // Validate OCR quality
  validateOCRQuality(ocrResult: OCRResult, minimumConfidence: number = 80): boolean {
    return ocrResult.confidence >= minimumConfidence;
  }
}