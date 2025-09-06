import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Upload, Shield, Eye, Link, Wallet, CheckCircle, AlertTriangle } from 'lucide-react';
import { blockchainService } from '@/lib/blockchain';
import { CertificateUpload } from '@/components/CertificateUpload';
import { CertificateVerify } from '@/components/CertificateVerify';
import { CertificateView } from '@/components/CertificateView';
import { useToast } from '@/hooks/use-toast';

interface UploadResult {
  certID: string;
  txHash?: string;
  anomalyScore: number;
  status: 'success' | 'error';
  message: string;
}

const Index = () => {
  const [walletConnected, setWalletConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [selectedCertID, setSelectedCertID] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    setWalletConnected(blockchainService.isConnected());
  }, []);

  const connectWallet = async () => {
    const connected = await blockchainService.connect();
    setWalletConnected(connected);
    
    if (connected) {
      toast({
        title: "Wallet Connected",
        description: "Successfully connected to MetaMask",
      });
    } else {
      toast({
        title: "Connection Failed",
        description: "Please install MetaMask or check your connection",
        variant: "destructive"
      });
    }
  };

  const handleUploadComplete = (result: UploadResult) => {
    if (result.status === 'success') {
      setSelectedCertID(result.certID);
      setActiveTab('view');
    }
  };

  const handleVerifyComplete = (certID: string) => {
    setSelectedCertID(certID);
    setActiveTab('view');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-primary">
                <Shield className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">CertifyChain</h1>
                <p className="text-sm text-muted-foreground">Blockchain Certificate Verification Platform</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Badge variant={walletConnected ? "default" : "secondary"} className="flex items-center gap-2">
                {walletConnected ? (
                  <>
                    <CheckCircle className="h-3 w-3" />
                    Wallet Connected
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3" />
                    Wallet Disconnected
                  </>
                )}
              </Badge>
              
              {!walletConnected && (
                <Button onClick={connectWallet} variant="outline" className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Connect Wallet
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Hero Section */}
          <Card className="bg-gradient-card border-0 shadow-card">
            <CardHeader className="text-center pb-8">
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-full bg-gradient-primary shadow-glow">
                  <Shield className="h-8 w-8 text-primary-foreground" />
                </div>
              </div>
              <CardTitle className="text-3xl mb-2">Secure Certificate Management</CardTitle>
              <CardDescription className="text-lg max-w-2xl mx-auto">
                Issue, verify, and manage digital certificates with blockchain technology, OCR processing, 
                and AI-powered anomaly detection for enhanced security and authenticity.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="flex justify-center mb-3">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Issue Certificates</h3>
                <p className="text-sm text-muted-foreground">
                  Upload and process certificates with automated OCR and anomaly detection
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="flex justify-center mb-3">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Verify Authenticity</h3>
                <p className="text-sm text-muted-foreground">
                  Instantly verify certificate authenticity using blockchain verification
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="flex justify-center mb-3">
                  <Eye className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">View Details</h3>
                <p className="text-sm text-muted-foreground">
                  Access complete certificate details including OCR text and metadata
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Interface */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Certificate Management Dashboard</CardTitle>
              <CardDescription>
                Manage your certificates through our comprehensive platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="upload" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Issue Certificate
                  </TabsTrigger>
                  <TabsTrigger value="verify" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Verify Certificate
                  </TabsTrigger>
                  <TabsTrigger value="view" className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    View Details
                  </TabsTrigger>
                </TabsList>

                <div className="mt-6">
                  <TabsContent value="upload" className="space-y-4">
                    <CertificateUpload onUploadComplete={handleUploadComplete} />
                  </TabsContent>

                  <TabsContent value="verify" className="space-y-4">
                    <CertificateVerify />
                  </TabsContent>

                  <TabsContent value="view" className="space-y-4">
                    {selectedCertID ? (
                      <CertificateView certID={selectedCertID} />
                    ) : (
                      <Card>
                        <CardContent className="p-6 text-center">
                          <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                          <p className="text-muted-foreground">
                            No certificate selected. Upload a new certificate or verify an existing one to view details.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>

          {/* API Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                API Endpoints
              </CardTitle>
              <CardDescription>
                Backend API endpoints available for integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <h4 className="font-semibold text-success mb-2">POST /issue</h4>
                    <p className="text-sm text-muted-foreground">
                      Issue new certificate with file upload, OCR processing, and blockchain registration
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <h4 className="font-semibold text-primary mb-2">GET /verify/:id</h4>
                    <p className="text-sm text-muted-foreground">
                      Verify certificate authenticity and get verification status
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <h4 className="font-semibold text-warning mb-2">GET /view/:id</h4>
                    <p className="text-sm text-muted-foreground">
                      Retrieve complete certificate details including OCR text and metadata
                    </p>
                  </div>
                </div>
                
                <div className="text-center">
                  <Badge variant="outline" className="text-xs">
                    Backend implementation using Supabase Edge Functions for equivalent Node.js + Express functionality
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/50 mt-16">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>© 2024 CertifyChain MVP - Powered by Blockchain Technology</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
