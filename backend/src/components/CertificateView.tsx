import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, FileText, Hash, Brain, QrCode, Clock, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CertificateDetails {
  certID: string;
  fileName: string;
  fileHash: string;
  ocrHash: string;
  aiHash: string;
  qrHash: string;
  anomalyScore: number;
  status: string;
  txHash?: string;
  createdAt: string;
  updatedAt: string;
  ocrText?: string;
  ocrConfidence?: number;
  vcJSON?: any;
}

interface CertificateViewProps {
  certID: string;
}

export function CertificateView({ certID }: CertificateViewProps) {
  const [certificate, setCertificate] = useState<CertificateDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (certID) {
      fetchCertificateDetails();
    }
  }, [certID]);

  const fetchCertificateDetails = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('certificates')
        .select(`
          *,
          certificate_ocr(ocr_text, confidence_score),
          certificate_vc(vc_json)
        `)
        .eq('cert_id', certID)
        .single();

      if (error) throw error;

      const details: CertificateDetails = {
        certID: data.cert_id,
        fileName: data.file_name,
        fileHash: data.file_hash,
        ocrHash: data.ocr_hash,
        aiHash: data.ai_hash,
        qrHash: data.qr_hash,
        anomalyScore: data.anomaly_score,
        status: data.status,
        txHash: data.tx_hash,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        ocrText: data.certificate_ocr[0]?.ocr_text,
        ocrConfidence: data.certificate_ocr[0]?.confidence_score,
        vcJSON: data.certificate_vc[0]?.vc_json
      };

      setCertificate(details);
    } catch (error: any) {
      console.error('Error fetching certificate details:', error);
      toast({
        title: "Error",
        description: "Failed to fetch certificate details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      verified: 'bg-gradient-success text-success-foreground',
      flagged: 'bg-warning text-warning-foreground', 
      invalid: 'bg-destructive text-destructive-foreground',
      pending: 'bg-muted text-muted-foreground'
    };
    
    return (
      <Badge className={colors[status as keyof typeof colors] || colors.pending}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatHash = (hash: string) => {
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!certificate) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Certificate not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Certificate Details</CardTitle>
                <CardDescription>Complete information for {certificate.certID}</CardDescription>
              </div>
            </div>
            {getStatusBadge(certificate.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Certificate ID</label>
              <p className="font-mono text-sm">{certificate.certID}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">File Name</label>
              <p className="text-sm">{certificate.fileName.split('_').slice(1).join('_')}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Anomaly Score</label>
              <p className={`text-sm font-medium ${
                certificate.anomalyScore > 0.7 ? 'text-destructive' :
                certificate.anomalyScore > 0.3 ? 'text-warning' : 'text-success'
              }`}>
                {(certificate.anomalyScore * 100).toFixed(2)}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <p className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {new Date(certificate.createdAt).toLocaleString()}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
              <p className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {new Date(certificate.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hashes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Cryptographic Hashes
          </CardTitle>
          <CardDescription>
            SHA-256 hashes for integrity verification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm font-medium text-muted-foreground">File Hash</label>
            <code className="block text-xs bg-muted p-2 rounded mt-1 break-all">
              {certificate.fileHash}
            </code>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">OCR Hash</label>
            <code className="block text-xs bg-muted p-2 rounded mt-1 break-all">
              {certificate.ocrHash}
            </code>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">AI Hash</label>
            <code className="block text-xs bg-muted p-2 rounded mt-1 break-all">
              {certificate.aiHash}
            </code>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">QR Hash</label>
            <code className="block text-xs bg-muted p-2 rounded mt-1 break-all">
              {certificate.qrHash}
            </code>
          </div>
        </CardContent>
      </Card>

      {/* OCR Results */}
      {certificate.ocrText && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              OCR Results
            </CardTitle>
            <CardDescription>
              Extracted text with {certificate.ocrConfidence ? `${(certificate.ocrConfidence * 100).toFixed(1)}% confidence` : 'unknown confidence'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-32 w-full rounded border p-3">
              <pre className="text-sm whitespace-pre-wrap">{certificate.ocrText}</pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* VC JSON */}
      {certificate.vcJSON && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Verifiable Credential
            </CardTitle>
            <CardDescription>
              W3C Verifiable Credential JSON representation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-40 w-full rounded border p-3">
              <pre className="text-xs">
                {JSON.stringify(certificate.vcJSON, null, 2)}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Blockchain Info */}
      {certificate.txHash && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Blockchain Transaction
            </CardTitle>
            <CardDescription>
              On-chain verification details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Transaction Hash</label>
                <code className="block text-xs bg-muted p-2 rounded mt-1 break-all">
                  {certificate.txHash}
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}