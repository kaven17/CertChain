// backend/src/lib/blockchain.ts
import { ethers, Contract, BrowserProvider, Signer } from "ethers";

declare global {
  interface Window {
    ethereum?: any; // MetaMask provider
  }
}

// Replace with deployed contract address or env
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0xYourDeployedContractAddressHere";

const CERTIFYCHAIN_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "string",
        "name": "certID",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "issuer",
        "type": "address"
      }
    ],
    "name": "CertificateAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "string",
        "name": "certID",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "correctionID",
        "type": "string"
      }
    ],
    "name": "CertificateCorrected",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "string",
        "name": "certID",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "admin",
        "type": "address"
      }
    ],
    "name": "CertificateRevoked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "string",
        "name": "certID",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "verifier",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "valid",
        "type": "bool"
      }
    ],
    "name": "CertificateVerified",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "version",
        "type": "uint8"
      }
    ],
    "name": "Initialized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "previousAdminRole",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "newAdminRole",
        "type": "bytes32"
      }
    ],
    "name": "RoleAdminChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleGranted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleRevoked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "newThreshold",
        "type": "uint8"
      }
    ],
    "name": "VerificationThresholdUpdated",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "DEFAULT_ADMIN_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "ISSUER_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "VERIFIER_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "certID",
        "type": "string"
      },
      {
        "internalType": "bytes32",
        "name": "fileHash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "ocrHash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "aiHash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "qrHash",
        "type": "bytes32"
      },
      {
        "internalType": "uint8",
        "name": "anomalyScore",
        "type": "uint8"
      },
      {
        "internalType": "string",
        "name": "metadataURI",
        "type": "string"
      }
    ],
    "name": "addCertificate",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "certID",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "correctionID",
        "type": "string"
      },
      {
        "internalType": "bytes32",
        "name": "newFileHash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "newOcrHash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "newAiHash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "newQrHash",
        "type": "bytes32"
      },
      {
        "internalType": "uint8",
        "name": "newAnomalyScore",
        "type": "uint8"
      },
      {
        "internalType": "string",
        "name": "newMetadataURI",
        "type": "string"
      }
    ],
    "name": "correctCertificate",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      }
    ],
    "name": "getRoleAdmin",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "grantRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "hasRole",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "admin",
        "type": "address"
      }
    ],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "renounceRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "certID",
        "type": "string"
      }
    ],
    "name": "revokeCertificate",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "revokeRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "interfaceId",
        "type": "bytes4"
      }
    ],
    "name": "supportsInterface",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "newThreshold",
        "type": "uint8"
      }
    ],
    "name": "updateVerificationThreshold",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "verificationThreshold",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "certID",
        "type": "string"
      }
    ],
    "name": "verifyCertificate",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "certID",
        "type": "string"
      }
    ],
    "name": "viewCertificate",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "fileHash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "ocrHash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "aiHash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "qrHash",
        "type": "bytes32"
      },
      {
        "internalType": "uint8",
        "name": "anomalyScore",
        "type": "uint8"
      },
      {
        "internalType": "address",
        "name": "issuer",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      },
      {
        "internalType": "string[]",
        "name": "corrections",
        "type": "string[]"
      },
      {
        "internalType": "enum CertifyChainV3.Status",
        "name": "status",
        "type": "uint8"
      },
      {
        "internalType": "string",
        "name": "metadataURI",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

export class BlockchainService {
  private provider: BrowserProvider | null = null;
  private signer: Signer | null = null;
  private contract: Contract | null = null;

  toBytes32(hash: string): string {
    if (!hash) throw new Error("Empty hash provided");
    let h = hash.startsWith("0x") ? hash.slice(2) : hash;
    if (!/^[0-9a-fA-F]*$/.test(h)) throw new Error("Hash contains non-hex characters");
    if (h.length > 64) h = h.slice(h.length - 64);
    else if (h.length < 64) h = h.padStart(64, "0");
    return "0x" + h.toLowerCase();
  }

  async connect(): Promise<boolean> {
    try {
      if (!window.ethereum) {
        console.error("No ethereum provider found");
        return false;
      }

      await window.ethereum.request({ method: "eth_requestAccounts" });

      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      this.contract = new ethers.Contract(CONTRACT_ADDRESS, CERTIFYCHAIN_ABI, this.signer);

      return true;
    } catch (err) {
      console.error("Failed to connect:", err);
      return false;
    }
  }

  async addCertificate(params: {
    certID: string;
    fileHashHex: string;
    ocrHashHex: string;
    aiHashHex: string;
    qrHashHex: string;
    anomalyScore: number;
    metadataURI: string;
  }): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      if (!this.contract) throw new Error("Contract not initialized");

      const tx = await this.contract.addCertificate(
        params.certID,
        this.toBytes32(params.fileHashHex),
        this.toBytes32(params.ocrHashHex),
        this.toBytes32(params.aiHashHex),
        this.toBytes32(params.qrHashHex),
        Math.max(0, Math.min(255, Math.floor(params.anomalyScore))),
        params.metadataURI
      );

      const receipt = await tx.wait();
      return { success: true, txHash: receipt.transactionHash || receipt.hash };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  }

  async verifyCertificate(certID: string): Promise<{ success: boolean; isValid?: boolean; error?: string }> {
    try {
      if (!this.contract) throw new Error("Contract not initialized");

      const res = await this.contract.verifyCertificate(certID);

      if (typeof res === "boolean") return { success: true, isValid: res };

      // Transaction response fallback
      if (res && "wait" in res && typeof res.wait === "function") {
        const receipt = await res.wait();
        const event = receipt.events?.find((e) => e.event === "CertificateVerified");
        return { success: true, isValid: event?.args ? Boolean(event.args.valid ?? event.args[2]) : undefined };
      }

      return { success: true };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  }

  async viewCertificate(certID: string): Promise<{
    success: boolean;
    data?: {
      fileHash: string;
      ocrHash: string;
      aiHash: string;
      qrHash: string;
      anomalyScore: number;
      issuer: string;
      timestamp: number;
      corrections: string[];
      status: "Active" | "Revoked";
      metadataURI: string;
    };
    error?: string;
  }> {
    try {
      if (!this.contract) throw new Error("Contract not initialized");

      const res = await this.contract.viewCertificate(certID);

      const status = Number(res[8]) === 1 ? "Revoked" : "Active";

      return {
        success: true,
        data: {
          fileHash: res[0] as string,
          ocrHash: res[1] as string,
          aiHash: res[2] as string,
          qrHash: res[3] as string,
          anomalyScore: Number(res[4]),
          issuer: String(res[5]),
          timestamp: Number(res[6]),
          corrections: Array.isArray(res[7]) ? (res[7] as string[]) : [],
          status,
          metadataURI: String(res[9]),
        },
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  }

  async hasRole(role: string, account: string): Promise<boolean> {
    if (!this.contract) throw new Error("Contract not initialized");
    return await this.contract.hasRole(role, account);
  }

  async grantRole(role: string, account: string): Promise<void> {
    if (!this.contract) throw new Error("Contract not initialized");
    const tx = await this.contract.grantRole(role, account);
    await tx.wait();
  }

  async revokeRole(role: string, account: string): Promise<void> {
    if (!this.contract) throw new Error("Contract not initialized");
    const tx = await this.contract.revokeRole(role, account);
    await tx.wait();
  }

  isConnected(): boolean {
    return this.contract !== null;
  }

  async getAddress(): Promise<string | null> {
    if (!this.signer) return null;
    try {
      return await this.signer.getAddress();
    } catch {
      return null;
    }
  }
}

export const blockchainService = new BlockchainService();
