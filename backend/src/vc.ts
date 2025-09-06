import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface VerifiableCredential {
  '@context': string[];
  type: string[];
  issuer: {
    id: string;
    name: string;
  };
  issuanceDate: string;
  credentialSubject: {
    id: string;
    name: string;
    achievement: {
      name: string;
      description: string;
      institution: string;
      grade?: string;
      issueDate?: string;
    };
    ocrData: {
      text: string;
      confidence: number;
      extractedInfo: any;
    };
    anomalyScore: number;
    flags: string[];
  };
  proof?: {
    type: string;
    created: string;
    verificationMethod: string;
    jws: string;
  };
}

export class VCService {
  private issuerPrivateKey: string;
  private issuerId: string;
  private issuerName: string;

  constructor(
    privateKey: string,
    issuerId: string,
    issuerName: string = 'CertifyChain Issuer'
  ) {
    this.issuerPrivateKey = privateKey;
    this.issuerId = issuerId;
    this.issuerName = issuerName;
  }

  // Create a Verifiable Credential
  createVC(
    studentName: string,
    studentWallet: string,
    ocrResult: any,
    extractedInfo: any,
    anomalyScore: number,
    flags: string[],
    achievement: {
      name: string;
      description: string;
      institution: string;
      grade?: string;
      issueDate?: string;
    }
  ): VerifiableCredential {
    const now = new Date().toISOString();

    const vc: VerifiableCredential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://www.w3.org/2018/credentials/examples/v1'
      ],
      type: ['VerifiableCredential', 'CertificateCredential'],
      issuer: {
        id: this.issuerId,
        name: this.issuerName
      },
      issuanceDate: now,
      credentialSubject: {
        id: studentWallet,
        name: studentName,
        achievement: {
          name: achievement.name,
          description: achievement.description,
          institution: achievement.institution,
          grade: achievement.grade,
          issueDate: achievement.issueDate
        },
        ocrData: {
          text: ocrResult.text,
          confidence: ocrResult.confidence,
          extractedInfo: extractedInfo
        },
        anomalyScore,
        flags
      }
    };

    return vc;
  }

  // Sign the VC using JWT
  signVC(vc: VerifiableCredential): string {
    const payload = {
      vc: vc,
      iss: this.issuerId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year expiration
    };

    return jwt.sign(payload, this.issuerPrivateKey, { algorithm: 'HS256' });
  }

  // Verify a signed VC
  verifyVC(signedVC: string): { valid: boolean; vc?: VerifiableCredential; error?: string } {
    try {
      const decoded = jwt.verify(signedVC, this.issuerPrivateKey) as any;
      return {
        valid: true,
        vc: decoded.vc
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown verification error'
      };
    }
  }

  // Create hash of VC for blockchain storage
  createVCHash(vc: VerifiableCredential | string): string {
    const vcString = typeof vc === 'string' ? vc : JSON.stringify(vc);
    return crypto.createHash('sha256').update(vcString).digest('hex');
  }

  // Create anchor hash combining all certificate data
  createAnchorHash(
    fileHash: string,
    ocrHash: string,
    vcHash: string,
    anomalyScore: number
  ): string {
    const combinedData = `${fileHash}:${ocrHash}:${vcHash}:${anomalyScore}`;
    return crypto.createHash('sha256').update(combinedData).digest('hex');
  }

  // Extract VC from signed JWT
  extractVCFromJWT(signedVC: string): VerifiableCredential | null {
    try {
      const payload = jwt.decode(signedVC) as any;
      return payload?.vc || null;
    } catch {
      return null;
    }
  }

  // Validate VC structure
  validateVCStructure(vc: VerifiableCredential): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!vc['@context'] || !Array.isArray(vc['@context'])) {
      errors.push('Missing or invalid @context');
    }

    if (!vc.type || !Array.isArray(vc.type)) {
      errors.push('Missing or invalid type');
    }

    if (!vc.issuer || !vc.issuer.id) {
      errors.push('Missing issuer information');
    }

    if (!vc.issuanceDate) {
      errors.push('Missing issuance date');
    }

    if (!vc.credentialSubject || !vc.credentialSubject.id) {
      errors.push('Missing credential subject');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}