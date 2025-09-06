import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Shield, Search, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { blockchainService } from '@/lib/blockchain';
import { useToast } from '@/hooks/use-toast';

interface VerificationResult {
  certID: string;
  verified: boolean;
  status: 'verified' | 'flagged' | 'invalid';
  anomalyScore: number;
  fileName?: string;
  createdAt?: string;
  txHash?: string;
  blockchainVerified?: boolean;
}

export function CertificateVerify() {
  const [certID, setCertID] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const { toast } = useToast();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'flagged':
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      case 'invalid':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Shield className="h-5 w-5 text-muted-foreground" />;
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

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'verified':
        return '✅ Certificate Verified';
      case 'flagged':
        return '⚠️ Certificate Flagged';
      case 'invalid':
        return '❌ Certificate Invalid';
      default:
        return '🔍 Unknown Status';
    }
  };

  const determineStatus = (anomalyScore: number, exists: boolean): 'verified' | 'flagged' | 'invalid' => {
    if (!exists) return 'invalid';
    if (anomalyScore > 0.7) return 'flagged';
    return 'verified';
  };

  const verifyCertificate = async () => {
    if (!certID.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please enter a certificate ID",
        variant: "destructive"
      });
      return;
    }

    setVerifying(true);
    setResult(null);

    try {
      // Step 1: Check database
      const { data: certificate, error } = await supabase
        .from('certificates')
        .select(`
          *,
          certificate_ocr(*),
          certificate_vc(*)
        `)
        .eq('cert_id', certID.trim())
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const exists = !!certificate;
      let blockchainVerified = false;
      
      // Step 2: Verify on blockchain if connected
      if (blockchainService.isConnected()) {
        try {
          const blockchainResult = await blockchainService.verifyCertificate(certID);
          blockchainVerified = blockchainResult.isValid;
        } catch (error) {
          console.warn('Blockchain verification failed:', error);
        }
      }

      const anomalyScore = certificate?.anomaly_score || 1.0;
      const status = determineStatus(anomalyScore, exists);

      const verificationResult: VerificationResult = {
        certID: certID.trim(),
        verified: exists && status === 'verified',
        status,
        anomalyScore,
        fileName: certificate?.file_name,
        createdAt: certificate?.created_at,
        txHash: certificate?.tx_hash,
        blockchainVerified
      };

      setResult(verificationResult);

      toast({
        title: "Verification Complete",
        description: getStatusMessage(status),
        variant: status === 'verified' ? 'default' : 'destructive'
      });

    } catch (error: any) {
      console.error('Verification error:', error);
      
      const errorResult: VerificationResult = {
        certID: certID.trim(),
        verified: false,
        status: 'invalid',
        anomalyScore: 1.0
      };

      setResult(errorResult);

      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify certificate",
        variant: "destructive"
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      verifyCertificate();
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Verify Certificate
        </CardTitle>
        <CardDescription>
          Enter a certificate ID to verify its authenticity and check for any anomalies
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter certificate ID (e.g., CERT_1234567890_ABCDEF)"
            value={certID}
            onChange={(e) => setCertID(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
            disabled={verifying}
          />
          <Button 
            onClick={verifyCertificate}
            disabled={verifying || !certID.trim()}
            className="bg-gradient-primary hover:opacity-90"
          >
            {verifying ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-foreground" />
                Verifying...
              </div>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Verify
              </>
            )}
          </Button>
        </div>

        {result && (
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.status)}
                  <div>
                    <h3 className="font-semibold">Certificate ID: {result.certID}</h3>
                    <p className="text-sm text-muted-foreground">
                      {result.createdAt ? `Issued: ${new Date(result.createdAt).toLocaleDateString()}` : 'Issue date unknown'}
                    </p>
                  </div>
                </div>
                <Badge className={getStatusColor(result.status)}>
                  {getStatusMessage(result.status)}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Anomaly Score:</span>
                    <span className={`text-sm font-medium ${
                      result.anomalyScore > 0.7 ? 'text-destructive' : 
                      result.anomalyScore > 0.3 ? 'text-warning' : 'text-success'
                    }`}>
                      {(result.anomalyScore * 100).toFixed(1)}%
                    </span>
                  </div>
                  
                  {result.fileName && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">File:</span>
                      <span className="text-sm font-medium">{result.fileName.split('_').slice(1).join('_')}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Database:</span>
                    <span className={`text-sm font-medium ${result.verified ? 'text-success' : 'text-destructive'}`}>
                      {result.verified ? 'Valid' : 'Not Found'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Blockchain:</span>
                    <span className={`text-sm font-medium ${
                      result.blockchainVerified === undefined ? 'text-muted-foreground' :
                      result.blockchainVerified ? 'text-success' : 'text-destructive'
                    }`}>
                      {result.blockchainVerified === undefined ? 'Not Connected' :
                       result.blockchainVerified ? 'Verified' : 'Invalid'}
                    </span>
                  </div>
                </div>
              </div>

              {result.txHash && (
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Transaction Hash:</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {result.txHash.slice(0, 10)}...{result.txHash.slice(-10)}
                    </code>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}