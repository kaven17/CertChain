import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Shield, CheckCircle, AlertTriangle, XCircle, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { blockchainService } from '@/lib/blockchain';

interface CertificateData {
  certID: string;
  fileName: string;
  status: string;
  anomalyScore: number;
  createdAt: string;
  txHash?: string;
  ocrText?: string;
}

const Verify = () => {
  const { id: certID } = useParams<{ id: string }>();
  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [blockchainVerified, setBlockchainVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (certID) {
      verifyCertificate();
    }
  }, [certID]);

  const verifyCertificate = async () => {
    if (!certID) return;
    
    setLoading(true);
    
    try {
      // Check database
      const { data, error } = await supabase
        .from('certificates')
        .select(`
          *,
          certificate_ocr(ocr_text)
        `)
        .eq('cert_id', certID)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setCertificate({
          certID: data.cert_id,
          fileName: data.file_name,
          status: data.status,
          anomalyScore: data.anomaly_score,
          createdAt: data.created_at,
          txHash: data.tx_hash,
          ocrText: data.certificate_ocr[0]?.ocr_text
        });

        // Verify on blockchain if possible
        if (blockchainService.isConnected()) {
          try {
            const blockchainResult = await blockchainService.verifyCertificate(certID);
            setBlockchainVerified(blockchainResult.isValid);
          } catch (error) {
            console.warn('Blockchain verification failed:', error);
          }
        }
      }
    } catch (error) {
      console.error('Verification error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="h-8 w-8 text-success" />;
      case 'flagged':
        return <AlertTriangle className="h-8 w-8 text-warning" />;
      case 'invalid':
        return <XCircle className="h-8 w-8 text-destructive" />;
      default:
        return <Shield className="h-8 w-8 text-muted-foreground" />;
    }
  };

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'verified':
        return { title: '✅ Certificate Verified', desc: 'This certificate is authentic and has been verified.' };
      case 'flagged':
        return { title: '⚠️ Certificate Flagged', desc: 'This certificate has been flagged for potential anomalies.' };
      case 'invalid':
        return { title: '❌ Certificate Invalid', desc: 'This certificate could not be verified or is invalid.' };
      default:
        return { title: 'Unknown Status', desc: 'Certificate status could not be determined.' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-gradient-success text-success-foreground';
      case 'flagged':
        return 'bg-warning text-warning-foreground';
      case 'invalid':
        return 'bg-destructive text-destructive-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-8 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Verifying Certificate</h3>
              <p className="text-muted-foreground">Please wait while we verify certificate {certID}...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!certificate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto border-destructive/20">
            <CardContent className="p-8 text-center">
              <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2 text-destructive">Certificate Not Found</h3>
              <p className="text-muted-foreground mb-6">
                The certificate with ID <code className="bg-muted px-2 py-1 rounded">{certID}</code> could not be found in our records.
              </p>
              <div className="flex gap-4 justify-center">
                <Button asChild variant="outline">
                  <Link to="/">
                    <Home className="h-4 w-4 mr-2" />
                    Return Home
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusMessage(certificate.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-semibold">Certificate Verification</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Main Verification Result */}
          <Card className="shadow-card">
            <CardHeader className="text-center pb-8">
              <div className="flex justify-center mb-4">
                {getStatusIcon(certificate.status)}
              </div>
              <CardTitle className="text-2xl mb-2">{statusInfo.title}</CardTitle>
              <CardDescription className="text-lg">{statusInfo.desc}</CardDescription>
              <Badge className={`${getStatusColor(certificate.status)} mt-4`}>
                {certificate.status.charAt(0).toUpperCase() + certificate.status.slice(1)}
              </Badge>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Certificate Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Certificate Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Certificate ID:</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{certificate.certID}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">File Name:</span>
                      <span className="text-right">{certificate.fileName.split('_').slice(1).join('_')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Issued:</span>
                      <span>{new Date(certificate.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Verification Status</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Anomaly Score:</span>
                      <span className={`font-medium ${
                        certificate.anomalyScore > 0.7 ? 'text-destructive' :
                        certificate.anomalyScore > 0.3 ? 'text-warning' : 'text-success'
                      }`}>
                        {(certificate.anomalyScore * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Database:</span>
                      <span className="text-success font-medium">✓ Found</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Blockchain:</span>
                      <span className={`font-medium ${
                        blockchainVerified === null ? 'text-muted-foreground' :
                        blockchainVerified ? 'text-success' : 'text-destructive'
                      }`}>
                        {blockchainVerified === null ? 'Not Connected' :
                         blockchainVerified ? '✓ Verified' : '✗ Invalid'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction Hash */}
              {certificate.txHash && (
                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-2">Blockchain Transaction</h4>
                  <code className="text-xs bg-muted p-3 rounded block break-all">
                    {certificate.txHash}
                  </code>
                </div>
              )}

              {/* OCR Text Preview */}
              {certificate.ocrText && (
                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-2">Certificate Content Preview</h4>
                  <div className="bg-muted p-4 rounded text-sm max-h-32 overflow-y-auto">
                    <pre className="whitespace-pre-wrap">{certificate.ocrText.substring(0, 300)}</pre>
                    {certificate.ocrText.length > 300 && (
                      <span className="text-muted-foreground">... (truncated)</span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-center gap-4">
            <Button asChild variant="outline">
              <Link to="/">
                <Home className="h-4 w-4 mr-2" />
                Return to Dashboard
              </Link>
            </Button>
            <Button asChild>
              <Link to={`/?view=${certificate.certID}`}>
                View Full Details
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Verify;