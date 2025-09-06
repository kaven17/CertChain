import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { computeFileHash, computeTextHash, generateCertID, generateQRCode, computeQRHash } from '@/lib/crypto-utils';
import { blockchainService } from '@/lib/blockchain';
import { cn } from '@/lib/utils';

interface UploadResult {
  certID: string;
  txHash?: string;
  anomalyScore: number;
  status: 'success' | 'error';
  message: string;
}

export function CertificateUpload({ onUploadComplete }: { onUploadComplete: (result: UploadResult) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (selectedFile: File) => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(selectedFile.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, JPG, or PNG file",
        variant: "destructive"
      });
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB",
        variant: "destructive"
      });
      return;
    }

    setFile(selectedFile);
  };

  const simulateOCR = async (file: File): Promise<{ text: string; confidence: number }> => {
    // Simulate OCR processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock OCR text based on file type
    const mockText = file.type.includes('pdf') 
      ? "Certificate of Achievement\nThis is to certify that John Doe has successfully completed the Advanced Web Development Course on December 15, 2024. Course Duration: 6 months. Grade: A+. Instructor: Dr. Jane Smith. Institution: Tech Academy."
      : "CERTIFICATE\nAwarded to: John Doe\nFor completion of: Blockchain Development\nDate: 2024-12-15\nSignature: [Digital Signature]";
    
    return {
      text: mockText,
      confidence: 0.95 + Math.random() * 0.05 // 95-100% confidence
    };
  };

  const simulateAnomalyDetection = async (ocrText: string): Promise<number> => {
    // Simulate AI anomaly detection delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Mock anomaly score (0-1, where 0 is no anomaly, 1 is high anomaly)
    const baseScore = Math.random() * 0.3; // Most certificates should have low anomaly scores
    const hasIssues = ocrText.length < 50 || Math.random() < 0.1; // 10% chance of issues
    
    return hasIssues ? 0.7 + Math.random() * 0.3 : baseScore;
  };

  const uploadCertificate = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);

    try {
      // Step 1: Generate certificate ID
      const certID = generateCertID();
      setProgress(10);

      // Step 2: Compute file hash
      const fileHash = await computeFileHash(file);
      setProgress(20);

      // Step 3: Upload file to Supabase Storage
      const fileName = `${certID}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(fileName, file);

      if (uploadError) throw uploadError;
      setProgress(30);

      // Step 4: Perform OCR
      const { text: ocrText, confidence } = await simulateOCR(file);
      const ocrHash = computeTextHash(ocrText);
      setProgress(50);

      // Step 5: Anomaly detection
      const anomalyScore = await simulateAnomalyDetection(ocrText);
      const aiHash = computeTextHash(`anomaly_score:${anomalyScore}`);
      setProgress(70);

      // Step 6: Generate QR code
      const qrData = generateQRCode(certID);
      const qrHash = computeQRHash(qrData);
      setProgress(75);

      // Step 7: Create VC JSON
      const vcJSON = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        "type": ["VerifiableCredential", "CertificateCredential"],
        "issuer": "CertifyChain",
        "issuanceDate": new Date().toISOString(),
        "credentialSubject": {
          "id": certID,
          "certificateDetails": {
            "ocrText": ocrText,
            "confidence": confidence,
            "anomalyScore": anomalyScore
          }
        }
      };

      // Step 8: Store in database
      const { data: certificateData, error: dbError } = await supabase
        .from('certificates')
        .insert({
          cert_id: certID,
          file_name: fileName,
          file_hash: fileHash,
          ocr_hash: ocrHash,
          ai_hash: aiHash,
          qr_hash: qrHash,
          anomaly_score: anomalyScore,
          status: 'pending'
        })
        .select()
        .single();

      if (dbError) throw dbError;
      setProgress(80);

      // Step 9: Store OCR and VC data
      await Promise.all([
        supabase.from('certificate_ocr').insert({
          certificate_id: certificateData.id,
          ocr_text: ocrText,
          confidence_score: confidence
        }),
        supabase.from('certificate_vc').insert({
          certificate_id: certificateData.id,
          vc_json: vcJSON
        })
      ]);
      setProgress(90);

      // Step 10: Add to blockchain (optional - may fail if wallet not connected)
      let txHash: string | undefined;
      if (blockchainService.isConnected()) {
        const metadataURI = `${window.location.origin}/api/metadata/${certID}`;
        const blockchainResult = await blockchainService.addCertificate(
          certID, fileHash, ocrHash, aiHash, qrHash, anomalyScore, metadataURI
        );
        
        if (blockchainResult.success) {
          txHash = blockchainResult.txHash;
          // Update certificate with transaction hash
          await supabase
            .from('certificates')
            .update({ tx_hash: txHash, status: 'verified' })
            .eq('id', certificateData.id);
        }
      }

      setProgress(100);

      const result: UploadResult = {
        certID,
        txHash,
        anomalyScore,
        status: 'success',
        message: 'Certificate uploaded and processed successfully!'
      };

      toast({
        title: "Certificate Issued",
        description: `Certificate ${certID} has been successfully processed.`,
      });

      onUploadComplete(result);

    } catch (error: any) {
      console.error('Upload error:', error);
      const result: UploadResult = {
        certID: 'ERROR',
        anomalyScore: 0,
        status: 'error',
        message: error.message
      };

      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive"
      });

      onUploadComplete(result);
    } finally {
      setUploading(false);
      setProgress(0);
      setFile(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Issue New Certificate
        </CardTitle>
        <CardDescription>
          Upload a certificate file (PDF, JPG, PNG) to process and add to the blockchain
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!uploading && (
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25",
              "hover:border-primary/50 cursor-pointer"
            )}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0];
                if (selectedFile) handleFileSelect(selectedFile);
              }}
            />
            
            {file ? (
              <div className="space-y-2">
                <FileText className="h-12 w-12 mx-auto text-primary" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-lg font-medium">Drop your certificate here</p>
                <p className="text-sm text-muted-foreground">
                  Or click to select a file (PDF, JPG, PNG)
                </p>
              </div>
            )}
          </div>
        )}

        {uploading && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing certificate...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
            
            <div className="text-sm text-muted-foreground space-y-1">
              {progress >= 10 && <div>✓ Certificate ID generated</div>}
              {progress >= 20 && <div>✓ File hash computed</div>}
              {progress >= 30 && <div>✓ File uploaded to storage</div>}
              {progress >= 50 && <div>✓ OCR processing complete</div>}
              {progress >= 70 && <div>✓ Anomaly detection complete</div>}
              {progress >= 80 && <div>✓ Database updated</div>}
              {progress >= 90 && <div>✓ Additional data stored</div>}
              {progress >= 100 && <div>✓ Processing complete</div>}
            </div>
          </div>
        )}

        {file && !uploading && (
          <Button 
            onClick={uploadCertificate}
            className="w-full bg-gradient-primary hover:opacity-90"
            size="lg"
          >
            Issue Certificate
          </Button>
        )}
      </CardContent>
    </Card>
  );
}