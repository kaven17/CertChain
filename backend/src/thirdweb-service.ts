import { ThirdwebSDK } from '@thirdweb-dev/sdk';
import crypto from 'crypto';

export interface CertificateBlockchainData {
  certificateId: string;
  fileHash: string;
  ocrHash: string;
  aiHash: string;
  anomalyScore: number;
  trustIndex: number;
  issuerWallet: string;
  timestamp: number;
}

export class ThirdWebService {
  private sdk: ThirdwebSDK;
  private contractAddress: string;

  constructor() {
    // Initialize ThirdWeb SDK with your credentials
    this.sdk = new ThirdwebSDK('sepolia', {
      clientId: process.env.THIRDWEB_CLIENT_ID,
      secretKey: process.env.THIRDWEB_SECRET_KEY,
    });
    
    // You'll need to add your deployed contract address here
    this.contractAddress = process.env.CONTRACT_ADDRESS || '';
  }

  // Store certificate data on blockchain
  async storeCertificateOnChain(data: CertificateBlockchainData): Promise<string> {
    try {
      if (!this.contractAddress) {
        console.warn('Contract address not configured, skipping blockchain storage');
        return '';
      }

      // Get the contract instance
      const contract = await this.sdk.getContract(this.contractAddress);

      // Create a combined hash of all certificate data
      const combinedHash = crypto.createHash('sha256')
        .update(data.fileHash + data.ocrHash + data.aiHash)
        .digest('hex');

      // Call smart contract function to store certificate
      const transaction = await contract.call('storeCertificate', [
        data.certificateId,
        combinedHash,
        data.issuerWallet,
        Math.floor(data.anomalyScore * 100), // Convert to integer (0-100)
        Math.floor(data.trustIndex * 100),   // Convert to integer (0-100)
        data.timestamp
      ]);

      console.log('Certificate stored on blockchain:', transaction.receipt.transactionHash);
      return transaction.receipt.transactionHash;

    } catch (error) {
      console.error('Error storing certificate on blockchain:', error);
      // Don't throw error - allow system to continue without blockchain
      return '';
    }
  }

  // Verify certificate against blockchain
  async verifyCertificateOnChain(certificateId: string): Promise<{
    exists: boolean;
    verified: boolean;
    blockchainData?: any;
    transactionHash?: string;
  }> {
    try {
      if (!this.contractAddress) {
        return { exists: false, verified: false };
      }

      const contract = await this.sdk.getContract(this.contractAddress);

      // Call smart contract function to get certificate data
      const result = await contract.call('getCertificate', [certificateId]);

      if (result && result.exists) {
        return {
          exists: true,
          verified: true,
          blockchainData: {
            certificateId: result.certificateId,
            combinedHash: result.combinedHash,
            issuerWallet: result.issuerWallet,
            anomalyScore: result.anomalyScore / 100, // Convert back to decimal
            trustIndex: result.trustIndex / 100,     // Convert back to decimal
            timestamp: result.timestamp
          },
          transactionHash: result.transactionHash
        };
      }

      return { exists: false, verified: false };

    } catch (error) {
      console.error('Error verifying certificate on blockchain:', error);
      return { exists: false, verified: false };
    }
  }

  // Verify hash integrity
  async verifyHashes(certificateId: string, fileHash: string, ocrHash: string, aiHash: string): Promise<boolean> {
    try {
      const verification = await this.verifyCertificateOnChain(certificateId);
      
      if (!verification.exists || !verification.blockchainData) {
        return false;
      }

      // Recreate combined hash
      const combinedHash = crypto.createHash('sha256')
        .update(fileHash + ocrHash + aiHash)
        .digest('hex');

      return combinedHash === verification.blockchainData.combinedHash;

    } catch (error) {
      console.error('Error verifying hashes:', error);
      return false;
    }
  }

  // Get contract instance for advanced operations
  async getContract() {
    if (!this.contractAddress) {
      throw new Error('Contract address not configured');
    }
    return await this.sdk.getContract(this.contractAddress);
  }

  // Check if blockchain is properly configured
  isConfigured(): boolean {
    return !!(process.env.THIRDWEB_CLIENT_ID && 
              process.env.THIRDWEB_SECRET_KEY && 
              this.contractAddress);
  }
}

export default ThirdWebService;