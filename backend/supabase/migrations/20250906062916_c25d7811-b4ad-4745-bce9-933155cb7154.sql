-- Create certificates table
CREATE TABLE public.certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cert_id TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  ocr_hash TEXT NOT NULL,
  ai_hash TEXT NOT NULL,
  qr_hash TEXT NOT NULL,
  anomaly_score DECIMAL(5,4) NOT NULL DEFAULT 0.0,
  metadata_uri TEXT,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'flagged', 'invalid')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create OCR data table
CREATE TABLE public.certificate_ocr (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  certificate_id UUID NOT NULL REFERENCES public.certificates(id) ON DELETE CASCADE,
  ocr_text TEXT NOT NULL,
  confidence_score DECIMAL(5,4) DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create VC JSON table
CREATE TABLE public.certificate_vc (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  certificate_id UUID NOT NULL REFERENCES public.certificates(id) ON DELETE CASCADE,
  vc_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_ocr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_vc ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a public verification system)
CREATE POLICY "Certificates are publicly readable" 
ON public.certificates 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert certificates" 
ON public.certificates 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update certificate status" 
ON public.certificates 
FOR UPDATE 
USING (true);

CREATE POLICY "OCR data is publicly readable" 
ON public.certificate_ocr 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert OCR data" 
ON public.certificate_ocr 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "VC data is publicly readable" 
ON public.certificate_vc 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert VC data" 
ON public.certificate_vc 
FOR INSERT 
WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_certificates_updated_at
BEFORE UPDATE ON public.certificates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_certificates_cert_id ON public.certificates(cert_id);
CREATE INDEX idx_certificates_status ON public.certificates(status);
CREATE INDEX idx_certificates_created_at ON public.certificates(created_at);
CREATE INDEX idx_certificate_ocr_cert_id ON public.certificate_ocr(certificate_id);
CREATE INDEX idx_certificate_vc_cert_id ON public.certificate_vc(certificate_id);