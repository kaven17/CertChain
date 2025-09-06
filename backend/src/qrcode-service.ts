import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

export interface QRCodeData {
  certificateId: string;
  verificationUrl: string;
  blockchainTxHash?: string;
  timestamp: string;
}

export class QRCodeService {
  private baseVerificationUrl: string;

  constructor(baseUrl: string = process.env.FRONTEND_URL || 'http://localhost:3000') {
    this.baseVerificationUrl = baseUrl;
  }

  // Generate QR code data for a certificate
  generateQRData(certificateId: string, txHash?: string): QRCodeData {
    return {
      certificateId,
      verificationUrl: `${this.baseVerificationUrl}/verify?id=${certificateId}`,
      blockchainTxHash: txHash,
      timestamp: new Date().toISOString()
    };
  }

  // Generate QR code as base64 string
  async generateQRCode(qrData: QRCodeData): Promise<string> {
    const qrString = JSON.stringify(qrData);
    
    try {
      const qrCodeDataURL = await QRCode.toDataURL(qrString, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });
      
      return qrCodeDataURL;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error}`);
    }
  }

  // Generate QR code and save to file
  async saveQRCodeToFile(qrData: QRCodeData, filePath: string): Promise<void> {
    const qrString = JSON.stringify(qrData);
    
    try {
      await QRCode.toFile(filePath, qrString, {
        errorCorrectionLevel: 'M',
        type: 'png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });
    } catch (error) {
      throw new Error(`Failed to save QR code to file: ${error}`);
    }
  }

  // Parse QR code data back to object
  parseQRData(qrString: string): QRCodeData | null {
    try {
      const data = JSON.parse(qrString);
      
      if (data.certificateId && data.verificationUrl) {
        return data as QRCodeData;
      }
      
      return null;
    } catch {
      return null;
    }
  }

  // Generate verification URL for certificate
  getVerificationUrl(certificateId: string): string {
    return `${this.baseVerificationUrl}/verify?id=${certificateId}`;
  }

  // Update QR data with latest blockchain information (for correction chain)
  updateQRDataForCorrection(
    originalQrData: QRCodeData, 
    newTxHash: string, 
    correctionId: string
  ): QRCodeData {
    return {
      ...originalQrData,
      blockchainTxHash: newTxHash,
      timestamp: new Date().toISOString(),
      correctionId: correctionId
    } as QRCodeData & { correctionId: string };
  }
}