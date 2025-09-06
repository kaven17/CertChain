import sqlite3 from 'sqlite3';
import { promisify } from 'util';

export interface Certificate {
  id: string;
  studentName: string;
  walletAddress: string;
  fileHash: string;
  ocrText: string;
  ocrHash: string;
  aiHash: string;
  vcJson: string;
  anomalyScore: number;
  flags: string;
  txHash: string;
  contractAddress: string;
  timestamp: Date;
  verified: boolean;
}

export class DatabaseService {
  private db: sqlite3.Database;
  private dbRun: (sql: string, params?: any[]) => Promise<sqlite3.RunResult>;
  private dbGet: (sql: string, params?: any[]) => Promise<any>;
  private dbAll: (sql: string, params?: any[]) => Promise<any[]>;

  constructor(dbPath: string = 'certificates.db') {
    this.db = new sqlite3.Database(dbPath);
    
    // Promisify database methods
    this.dbRun = promisify(this.db.run.bind(this.db));
    this.dbGet = promisify(this.db.get.bind(this.db));
    this.dbAll = promisify(this.db.all.bind(this.db));

    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS certificates (
        id TEXT PRIMARY KEY,
        student_name TEXT NOT NULL,
        wallet_address TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        ocr_text TEXT,
        ocr_hash TEXT,
        ai_hash TEXT,
        vc_json TEXT NOT NULL,
        anomaly_score INTEGER DEFAULT 0,
        flags TEXT,
        tx_hash TEXT,
        contract_address TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        verified BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createIndexSQL = `
      CREATE INDEX IF NOT EXISTS idx_wallet_address ON certificates(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON certificates(timestamp);
      CREATE INDEX IF NOT EXISTS idx_verified ON certificates(verified);
    `;

    try {
      await this.dbRun(createTableSQL);
      await this.dbRun(createIndexSQL);
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  async storeCertificate(certificate: Omit<Certificate, 'timestamp' | 'verified'>): Promise<void> {
    const insertSQL = `
      INSERT INTO certificates (
        id, student_name, wallet_address, file_hash, ocr_text, 
        ocr_hash, ai_hash, vc_json, anomaly_score, flags, 
        tx_hash, contract_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      await this.dbRun(insertSQL, [
        certificate.id,
        certificate.studentName,
        certificate.walletAddress,
        certificate.fileHash,
        certificate.ocrText,
        certificate.ocrHash,
        certificate.aiHash,
        certificate.vcJson,
        certificate.anomalyScore,
        certificate.flags,
        certificate.txHash,
        certificate.contractAddress
      ]);
    } catch (error) {
      console.error('Error storing certificate:', error);
      throw error;
    }
  }

  async getCertificate(id: string): Promise<Certificate | null> {
    const selectSQL = `
      SELECT * FROM certificates WHERE id = ?
    `;

    try {
      const row = await this.dbGet(selectSQL, [id]);
      if (!row) return null;

      return {
        id: row.id,
        studentName: row.student_name,
        walletAddress: row.wallet_address,
        fileHash: row.file_hash,
        ocrText: row.ocr_text,
        ocrHash: row.ocr_hash,
        aiHash: row.ai_hash,
        vcJson: row.vc_json,
        anomalyScore: row.anomaly_score,
        flags: row.flags,
        txHash: row.tx_hash,
        contractAddress: row.contract_address,
        timestamp: new Date(row.timestamp),
        verified: row.verified
      };
    } catch (error) {
      console.error('Error retrieving certificate:', error);
      throw error;
    }
  }

  async updateVerificationStatus(id: string, verified: boolean): Promise<void> {
    const updateSQL = `
      UPDATE certificates SET verified = ? WHERE id = ?
    `;

    try {
      await this.dbRun(updateSQL, [verified, id]);
    } catch (error) {
      console.error('Error updating verification status:', error);
      throw error;
    }
  }

  async getCertificatesByWallet(walletAddress: string): Promise<Certificate[]> {
    const selectSQL = `
      SELECT * FROM certificates WHERE wallet_address = ? ORDER BY timestamp DESC
    `;

    try {
      const rows = await this.dbAll(selectSQL, [walletAddress]);
      return rows.map(row => ({
        id: row.id,
        studentName: row.student_name,
        walletAddress: row.wallet_address,
        fileHash: row.file_hash,
        ocrText: row.ocr_text,
        ocrHash: row.ocr_hash,
        aiHash: row.ai_hash,
        vcJson: row.vc_json,
        anomalyScore: row.anomaly_score,
        flags: row.flags,
        txHash: row.tx_hash,
        contractAddress: row.contract_address,
        timestamp: new Date(row.timestamp),
        verified: row.verified
      }));
    } catch (error) {
      console.error('Error retrieving certificates by wallet:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}