# Certify Backend

1. copy `.env.example` → `.env` and fill in values.

2. Install:
   npm install

3. Dev:
   npm run dev
   (starts server on PORT)

4. Production build:
   npm run build
   npm start

API Endpoints:
- POST /certificate/issue
  - form-data:
    - file: file upload (pdf/png/jpg)
    - certID: string
    - ocrText: string (optional)
    - aiData: string (optional)
    - qrData: string (optional)
    - anomalyScore: number (optional)
    - issuer: string (optional)

- GET /certificate/:id/verify
- GET /certificate/:id
- POST /certificate/:id/revoke
