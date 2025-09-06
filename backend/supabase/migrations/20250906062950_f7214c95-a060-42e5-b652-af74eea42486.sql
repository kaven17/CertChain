-- Create storage bucket for certificate uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('certificates', 'certificates', false);

-- Create storage policies for certificate uploads
CREATE POLICY "Anyone can upload certificates" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'certificates');

CREATE POLICY "Anyone can view certificates" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'certificates');

CREATE POLICY "Anyone can update certificates" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'certificates');