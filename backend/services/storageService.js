import axios from "axios";
import { randomUUID } from "crypto";
import { PassThrough, Readable } from "stream";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

function sanitizeFileName(fileName = "document.pdf") {
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  return safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
}

function buildPublicId(originalName) {
  const safeName = sanitizeFileName(originalName).replace(/\.pdf$/i, "");
  return `documents/${new Date().toISOString().slice(0, 10)}/${randomUUID()}__${safeName}`;
}

function buildPdfDeliveryUrl(storageKey, resourceType = "raw") {
  return cloudinary.url(storageKey, {
    resource_type: resourceType,
    type: "upload",
    secure: true,
    ...(resourceType === "image" ? { format: "pdf" } : {}),
  });
}

export async function uploadPdfToCloud(fileBuffer, originalName) {
  const safeName = sanitizeFileName(originalName);
  const publicId = buildPublicId(originalName);

  const uploadResult = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: publicId,
        folder: "",
        use_filename: false,
        unique_filename: false,
        overwrite: false,
        filename_override: safeName,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      },
    );

    Readable.from(fileBuffer).pipe(uploadStream);
  });

  return {
    storageKey: uploadResult.public_id,
  };
}

export async function downloadPdfBuffer(storageKey) {
  // Try raw first (new uploads), fallback to image (older uploads stored with resource_type auto)
  const urls = [buildPdfDeliveryUrl(storageKey, "raw"), buildPdfDeliveryUrl(storageKey, "image")];
  for (const url of urls) {
    try {
      const response = await axios.get(url, { responseType: "arraybuffer" });
      return Buffer.from(response.data);
    } catch (err) {
      if (err.response?.status !== 404) throw err;
    }
  }
  throw new Error(`Could not download PDF from Cloudinary for key: ${storageKey}`);
}

export async function streamPdfFromCloud(storageKey, _originalName) {
  // Try raw first (new uploads), fallback to image (older uploads stored with resource_type auto)
  const urls = [buildPdfDeliveryUrl(storageKey, "raw"), buildPdfDeliveryUrl(storageKey, "image")];
  let lastError;
  for (const url of urls) {
    try {
      const response = await axios({ url, method: "GET", responseType: "stream" });
      const body = new PassThrough();
      response.data.pipe(body);
      return {
        body,
        contentLength: Number(response.headers["content-length"] || 0) || null,
        contentType: response.headers["content-type"] || "application/pdf",
      };
    } catch (err) {
      lastError = err;
      if (err.response?.status !== 404) throw err;
    }
  }
  throw lastError;
}

export async function deletePdfFromCloud(storageKey) {
  try {
    await cloudinary.api.delete_resources([storageKey], {
      resource_type: "raw",
      type: "upload",
    });
  } catch (error) {
    console.warn("Failed to delete from Cloudinary:", error.message);
  }
}
