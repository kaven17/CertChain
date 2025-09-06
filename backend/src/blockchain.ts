import { ethers } from 'ethers';

export interface BlockchainConfig {
  rpcUrl: string;
  privateKey: string;
  contractAddress: string;
  contractABI: any[];
}

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;

  constructor(config: BlockchainConfig) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.contract = new ethers.Contract(config.contractAddress, config.contractABI, this.wallet);
  }

  // Issue certificate on blockchain
  async issueCertificate(
    certID: string,
    fileHash: string,
    ocrHash: string,
    aiHash: string,
    qrHash: string,
    anomalyScore: number,
    metadataURI: string = ''
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const tx = await this.contract.addCertificate(
        certID,
        fileHash,
        ocrHash,
        aiHash,
        qrHash,
        anomalyScore,
        metadataURI
      );

      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error) {
      console.error('Error issuing certificate on blockchain:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown blockchain error'
      };
    }
  }

  // Verify certificate on blockchain
  async verifyCertificate(certID: string): Promise<{
    success: boolean;
    exists: boolean;
    valid?: boolean;
    certificateData?: any;
    error?: string;
  }> {
    try {
      // First check if certificate exists
      const certificateData = await this.contract.viewCertificate(certID);
      
      if (certificateData.timestamp.toString() === '0') {
        return {
          success: true,
          exists: false
        };
      }

      // If it exists, call verify function (this will emit an event)
      const tx = await this.contract.verifyCertificate(certID);
      const receipt = await tx.wait();

      // Parse the verification event
      const verificationEvent = receipt.logs.find((log: any) => 
        log.topics[0] === this.contract.interface.getEventTopic('CertificateVerified')
      );

      let valid = false;
      if (verificationEvent) {
        const parsedEvent = this.contract.interface.parseLog(verificationEvent);
        valid = parsedEvent.args.valid;
      }

      return {
        success: true,
        exists: true,
        valid,
        certificateData: {
          fileHash: certificateData.fileHash,
          ocrHash: certificateData.ocrHash,
          aiHash: certificateData.aiHash,
          qrHash: certificateData.qrHash,
          anomalyScore: certificateData.anomalyScore.toString(),
          issuer: certificateData.issuer,
          timestamp: new Date(certificateData.timestamp.toString() * 1000),
          status: certificateData.status === 0 ? 'Active' : 'Revoked',
          corrections: certificateData.corrections,
          metadataURI: certificateData.metadataURI
        }
      };
    } catch (error) {
      console.error('Error verifying certificate on blockchain:', error);
      return {
        success: false,
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown blockchain error'
      };
    }
  }

  // Get certificate details from blockchain
  async getCertificateDetails(certID: string): Promise<{
    success: boolean;
    exists: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const certificateData = await this.contract.viewCertificate(certID);
      
      if (certificateData.timestamp.toString() === '0') {
        return {
          success: true,
          exists: false
        };
      }

      return {
        success: true,
        exists: true,
        data: {
          fileHash: certificateData.fileHash,
          ocrHash: certificateData.ocrHash,
          aiHash: certificateData.aiHash,
          qrHash: certificateData.qrHash,
          anomalyScore: certificateData.anomalyScore.toString(),
          issuer: certificateData.issuer,
          timestamp: new Date(certificateData.timestamp.toString() * 1000),
          status: certificateData.status === 0 ? 'Active' : 'Revoked',
          corrections: certificateData.corrections,
          metadataURI: certificateData.metadataURI
        }
      };
    } catch (error) {
      console.error('Error getting certificate details:', error);
      return {
        success: false,
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown blockchain error'
      };
    }
  }

  // Check if wallet has issuer role
  async hasIssuerRole(walletAddress: string): Promise<boolean> {
    try {
      const ISSUER_ROLE = await this.contract.ISSUER_ROLE();
      return await this.contract.hasRole(ISSUER_ROLE, walletAddress);
    } catch (error) {
      console.error('Error checking issuer role:', error);
      return false;
    }
  }

  // Get current gas price
  async getGasPrice(): Promise<bigint> {
    return await this.provider.getFeeData().then(data => data.gasPrice || 0n);
  }

  // Get wallet balance
  async getWalletBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }
}