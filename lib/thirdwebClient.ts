import { createThirdwebClient, upload } from "thirdweb";

// Create the Thirdweb client
const client = createThirdwebClient({
  clientId: process.env.THIRDWEB_CLIENT_ID || "", // from .env
});

// Example: upload a single JSON or file to Pinata
async function uploadToPinata(files: (File | Buffer | string)[]) {
  try {
    const result = await upload({
      client,
      files,
      uploader: {
        type: "pinata",
        options: {
          apiKey: process.env.PINATA_API_KEY || "",
          secretApiKey: process.env.PINATA_SECRET_API_KEY || "",
        },
      },
    });

    console.log("Uploaded to Pinata at:", result);
    return result;
  } catch (err) {
    console.error("Upload failed:", err);
    throw err;
  }
}

// Usage example
// await uploadToPinata(["./metadata/cert.json"]);
