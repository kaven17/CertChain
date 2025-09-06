import sqlite3 from 'sqlite3';
import { promisify } from 'util';

export interface Certificate {
  id: string;
  studentName: string;
  rollNumber?: string;
  walletAddress: string;
  issuerWallet: string;
  fileHash: string;
  ocrText: string;
  ocrHash: string;
  aiHash: string;
  vcJson: string;
  anomalyScore: number;
  trustIndex: number;
  riskLevel: string;
  flags: string;
  txHash: string;
  contractAddress: string;
  qrCodeData: string;
  institutionName?: string;
  courseName?: string;
  grade?: string;
  issueDate?: string;
  certificateType: string;
  correctionId?: string;
  parentCertificateId?: string;
  timestamp: Date;
  verified: boolean;
  status: 'ACTIVE' | 'REVOKED' | 'CORRECTED';
}

export interface Institution {
  walletAddress: string;
  institutionName: string;
  trustScore: number;
  verificationStatus: 'VERIFIED' | 'PENDING' | 'REVOKED';
  authorizedCourses: string[];
  registrationDate: Date;
  totalCertificates: number;
  flaggedCertificates: number;
}

export interface AuditLog {
  id: number;
  certificateId?: string;
  action: string;
  actorWallet: string;
  details: string;
  timestamp: Date;
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
    const createCertificatesTableSQL = `
      CREATE TABLE IF NOT EXISTS certificates (
        id TEXT PRIMARY KEY,
        student_name TEXT NOT NULL,
        roll_number TEXT,
        wallet_address TEXT NOT NULL,
        issuer_wallet TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        ocr_text TEXT,
        ocr_hash TEXT,
        ai_hash TEXT,
        vc_json TEXT NOT NULL,
        anomaly_score REAL DEFAULT 0,
        trust_index REAL DEFAULT 0,
        risk_level TEXT DEFAULT 'LOW',
        flags TEXT,
        tx_hash TEXT,
        contract_address TEXT,
        qr_code_data TEXT,
        institution_name TEXT,
        course_name TEXT,
        grade TEXT,
        issue_date TEXT,
        certificate_type TEXT DEFAULT 'ACADEMIC',
        correction_id TEXT,
        parent_certificate_id TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        verified BOOLEAN DEFAULT FALSE,
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createInstitutionsTableSQL = `
      CREATE TABLE IF NOT EXISTS institutions (
        wallet_address TEXT PRIMARY KEY,
        institution_name TEXT NOT NULL,
        trust_score REAL DEFAULT 0,
        verification_status TEXT DEFAULT 'PENDING',
        authorized_courses TEXT,
        registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_certificates INTEGER DEFAULT 0,
        flagged_certificates INTEGER DEFAULT 0
      )
    `;

    const createAuditLogTableSQL = `
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        certificate_id TEXT,
        action TEXT NOT NULL,
        actor_wallet TEXT NOT NULL,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (certificate_id) REFERENCES certificates (id)
      )
    `;

    const createIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_wallet_address ON certificates(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_issuer_wallet ON certificates(issuer_wallet);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON certificates(timestamp);
      CREATE INDEX IF NOT EXISTS idx_verified ON certificates(verified);
      CREATE INDEX IF NOT EXISTS idx_status ON certificates(status);
      CREATE INDEX IF NOT EXISTS idx_risk_level ON certificates(risk_level);
      CREATE INDEX IF NOT EXISTS idx_institution_name ON certificates(institution_name);
      CREATE INDEX IF NOT EXISTS idx_parent_certificate ON certificates(parent_certificate_id);
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_certificate ON audit_log(certificate_id);
    `;

    try {
      await this.dbRun(createCertificatesTableSQL);
      await this.dbRun(createInstitutionsTableSQL);
      await this.dbRun(createAuditLogTableSQL);
      await this.dbRun(createIndexesSQL);
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  async storeCertificate(certificate: Omit<Certificate, 'timestamp' | 'verified'>): Promise<void> {
    const insertSQL = `
      INSERT INTO certificates (
        id, student_name, roll_number, wallet_address, issuer_wallet, file_hash, 
        ocr_text, ocr_hash, ai_hash, vc_json, anomaly_score, trust_index, 
        risk_level, flags, tx_hash, contract_address, qr_code_data, 
        institution_name, course_name, grade, issue_date, certificate_type,
        correction_id, parent_certificate_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      await this.dbRun(insertSQL, [
        certificate.id,
        certificate.studentName,
        certificate.rollNumber || null,
        certificate.walletAddress,
        certificate.issuerWallet,
        certificate.fileHash,
        certificate.ocrText,
        certificate.ocrHash,
        certificate.aiHash,
        certificate.vcJson,
        certificate.anomalyScore,
        certificate.trustIndex,
        certificate.riskLevel,
        certificate.flags,
        certificate.txHash,
        certificate.contractAddress,
        certificate.qrCodeData,
        certificate.institutionName || null,
        certificate.courseName || null,
        certificate.grade || null,
        certificate.issueDate || null,
        certificate.certificateType,
        certificate.correctionId || null,
        certificate.parentCertificateId || null,
        certificate.status
      ]);

      // Log the action
      await this.logAction(certificate.id, 'CERTIFICATE_ISSUED', certificate.issuerWallet, 
        `Certificate issued for ${certificate.studentName}`);
    } catch (error) {
      console.error('Error storing certificate:', error);
      throw error;
    }
  }

  async getCertificate(id: string): Promise<Certificate | null> {
    const selectSQL = `SELECT * FROM certificates WHERE id = ?`;

    try {
      const row = await this.dbGet(selectSQL, [id]);
      if (!row) return null;

      return this.mapRowToCertificate(row);
    } catch (error) {
      console.error('Error retrieving certificate:', error);
      throw error;
    }
  }

  async updateCertificateStatus(id: string, status: 'ACTIVE' | 'REVOKED' | 'CORRECTED', actorWallet: string): Promise<void> {
    const updateSQL = `UPDATE certificates SET status = ? WHERE id = ?`;

    try {
      await this.dbRun(updateSQL, [status, id]);
      await this.logAction(id, `CERTIFICATE_${status}`, actorWallet, `Certificate status changed to ${status}`);
    } catch (error) {
      console.error('Error updating certificate status:', error);
      throw error;
    }
  }

  async updateVerificationStatus(id: string, verified: boolean): Promise<void> {
    const updateSQL = `UPDATE certificates SET verified = ? WHERE id = ?`;

    try {
      await this.dbRun(updateSQL, [verified, id]);
    } catch (error) {
      console.error('Error updating verification status:', error);
      throw error;
    }
  }

  async getCertificatesByWallet(walletAddress: string): Promise<Certificate[]> {
    const selectSQL = `SELECT * FROM certificates WHERE wallet_address = ? ORDER BY timestamp DESC`;

    try {
      const rows = await this.dbAll(selectSQL, [walletAddress]);
      return rows.map(row => this.mapRowToCertificate(row));
    } catch (error) {
      console.error('Error retrieving certificates by wallet:', error);
      throw error;
    }
  }

  async getCertificatesByInstitution(issuerWallet: string): Promise<Certificate[]> {
    const selectSQL = `SELECT * FROM certificates WHERE issuer_wallet = ? ORDER BY timestamp DESC`;

    try {
      const rows = await this.dbAll(selectSQL, [issuerWallet]);
      return rows.map(row => this.mapRowToCertificate(row));
    } catch (error) {
      console.error('Error retrieving certificates by institution:', error);
      throw error;
    }
  }

  // Institution management
  async registerInstitution(institution: Omit<Institution, 'registrationDate' | 'totalCertificates' | 'flaggedCertificates'>): Promise<void> {
    const insertSQL = `
      INSERT INTO institutions (
        wallet_address, institution_name, trust_score, verification_status, authorized_courses
      ) VALUES (?, ?, ?, ?, ?)
    `;

    try {
      await this.dbRun(insertSQL, [
        institution.walletAddress,
        institution.institutionName,
        institution.trustScore,
        institution.verificationStatus,
        JSON.stringify(institution.authorizedCourses)
      ]);

      await this.logAction(null, 'INSTITUTION_REGISTERED', institution.walletAddress, 
        `Institution ${institution.institutionName} registered`);
    } catch (error) {
      console.error('Error registering institution:', error);
      throw error;
    }
  }

  async getInstitution(walletAddress: string): Promise<Institution | null> {
    const selectSQL = `SELECT * FROM institutions WHERE wallet_address = ?`;

    try {
      const row = await this.dbGet(selectSQL, [walletAddress]);
      if (!row) return null;

      return {
        walletAddress: row.wallet_address,
        institutionName: row.institution_name,
        trustScore: row.trust_score,
        verificationStatus: row.verification_status,
        authorizedCourses: JSON.parse(row.authorized_courses || '[]'),
        registrationDate: new Date(row.registration_date),
        totalCertificates: row.total_certificates,
        flaggedCertificates: row.flagged_certificates
      };
    } catch (error) {
      console.error('Error retrieving institution:', error);
      throw error;
    }
  }

  // Bulk operations for institutional uploads
  async storeCertificateBulk(certificates: Omit<Certificate, 'timestamp' | 'verified'>[]): Promise<{ success: number; failed: number; errors: string[] }> {
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    for (const certificate of certificates) {
      try {
        await this.storeCertificate(certificate);
        success++;
      } catch (error) {
        failed++;
        errors.push(`Certificate ${certificate.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { success, failed, errors };
  }

  // Analytics and reporting
  async getAnalytics(): Promise<{
    totalCertificates: number;
    verifiedCertificates: number;
    flaggedCertificates: number;
    institutionCount: number;
    riskDistribution: { [key: string]: number };
    recentActivity: number;
  }> {
    try {
      const totalResult = await this.dbGet(`SELECT COUNT(*) as count FROM certificates`);
      const verifiedResult = await this.dbGet(`SELECT COUNT(*) as count FROM certificates WHERE verified = true`);
      const flaggedResult = await this.dbGet(`SELECT COUNT(*) as count FROM certificates WHERE anomaly_score > 0.5`);
      const institutionResult = await this.dbGet(`SELECT COUNT(*) as count FROM institutions`);
      
      const riskDistribution = await this.dbAll(`
        SELECT risk_level, COUNT(*) as count 
        FROM certificates 
        GROUP BY risk_level
      `);

      const recentActivityResult = await this.dbGet(`
        SELECT COUNT(*) as count 
        FROM certificates 
        WHERE timestamp > datetime('now', '-7 days')
      `);

      const riskDist: { [key: string]: number } = {};
      riskDistribution.forEach(row => {
        riskDist[row.risk_level] = row.count;
      });

      return {
        totalCertificates: totalResult.count,
        verifiedCertificates: verifiedResult.count,
        flaggedCertificates: flaggedResult.count,
        institutionCount: institutionResult.count,
        riskDistribution: riskDist,
        recentActivity: recentActivityResult.count
      };
    } catch (error) {
      console.error('Error getting analytics:', error);
      throw error;
    }
  }

  async getAuditLog(certificateId?: string, limit: number = 100): Promise<AuditLog[]> {
    let selectSQL = `SELECT * FROM audit_log`;
    const params: any[] = [];

    if (certificateId) {
      selectSQL += ` WHERE certificate_id = ?`;
      params.push(certificateId);
    }

    selectSQL += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    try {
      const rows = await this.dbAll(selectSQL, params);
      return rows.map(row => ({
        id: row.id,
        certificateId: row.certificate_id,
        action: row.action,
        actorWallet: row.actor_wallet,
        details: row.details,
        timestamp: new Date(row.timestamp)
      }));
    } catch (error) {
      console.error('Error retrieving audit log:', error);
      throw error;
    }
  }

  private async logAction(certificateId: string | null, action: string, actorWallet: string, details: string): Promise<void> {
    const insertSQL = `
      INSERT INTO audit_log (certificate_id, action, actor_wallet, details)
      VALUES (?, ?, ?, ?)
    `;

    try {
      await this.dbRun(insertSQL, [certificateId, action, actorWallet, details]);
    } catch (error) {
      console.error('Error logging action:', error);
    }
  }

  private mapRowToCertificate(row: any): Certificate {
    return {
      id: row.id,
      studentName: row.student_name,
      rollNumber: row.roll_number,
      walletAddress: row.wallet_address,
      issuerWallet: row.issuer_wallet,
      fileHash: row.file_hash,
      ocrText: row.ocr_text,
      ocrHash: row.ocr_hash,
      aiHash: row.ai_hash,
      vcJson: row.vc_json,
      anomalyScore: row.anomaly_score,
      trustIndex: row.trust_index,
      riskLevel: row.risk_level,
      flags: row.flags,
      txHash: row.tx_hash,
      contractAddress: row.contract_address,
      qrCodeData: row.qr_code_data,
      institutionName: row.institution_name,
      courseName: row.course_name,
      grade: row.grade,
      issueDate: row.issue_date,
      certificateType: row.certificate_type,
      correctionId: row.correction_id,
      parentCertificateId: row.parent_certificate_id,
      timestamp: new Date(row.timestamp),
      verified: row.verified,
      status: row.status
    };
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