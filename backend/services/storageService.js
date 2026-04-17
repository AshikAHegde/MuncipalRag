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

function buildPdfDeliveryUrl(storageKey) {
  return cloudinary.url(storageKey, {
    resource_type: "image",
    type: "upload",
    secure: true,
    format: "pdf",
  });
}

export async function uploadPdfToCloud(fileBuffer, originalName) {
  const safeName = sanitizeFileName(originalName);
  const publicId = buildPublicId(originalName);

  const uploadResult = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "auto",
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
  const response = await axios.get(buildPdfDeliveryUrl(storageKey), {
    responseType: "arraybuffer",
  });

  return Buffer.from(response.data);
}

export async function streamPdfFromCloud(storageKey, _originalName) {
  const response = await axios({
    url: buildPdfDeliveryUrl(storageKey),
    method: "GET",
    responseType: "stream",
  });

  const body = new PassThrough();
  response.data.pipe(body);

  return {
    body,
    contentLength: Number(response.headers["content-length"] || 0) || null,
    contentType: response.headers["content-type"] || "application/pdf",
  };
}

export async function deletePdfFromCloud(storageKey) {
  try {
    await cloudinary.api.delete_resources([storageKey], {
      resource_type: "image",
      type: "upload",
    });
  } catch (error) {
    console.warn("Failed to delete as image, trying raw...", error.message);
  }
  
  try {
    await cloudinary.api.delete_resources([storageKey], {
      resource_type: "raw",
      type: "upload",
    });
  } catch (error) {
    console.warn("Failed to delete as raw...", error.message);
  }
}
