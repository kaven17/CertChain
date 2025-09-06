import CryptoJS from 'crypto-js';

export function computeFileHash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      if (e.target?.result) {
        const wordArray = CryptoJS.lib.WordArray.create(e.target.result as ArrayBuffer);
        const hash = CryptoJS.SHA256(wordArray).toString();
        resolve(hash);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    
    reader.onerror = () => reject(new Error('File reading failed'));
    reader.readAsArrayBuffer(file);
  });
}

export function computeTextHash(text: string): string {
  return CryptoJS.SHA256(text).toString();
}

export function generateCertID(): string {
  return `CERT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
}

export function generateQRCode(certID: string): string {
  // In a real implementation, you'd generate actual QR code data
  // For now, we'll simulate the QR data
  const qrData = {
    certID,
    verifyURL: `${window.location.origin}/verify/${certID}`,
    timestamp: new Date().toISOString()
  };
  
  return JSON.stringify(qrData);
}

export function computeQRHash(qrData: string): string {
  return CryptoJS.SHA256(qrData).toString();
}