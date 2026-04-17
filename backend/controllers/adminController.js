import { randomUUID } from "crypto";
import pdfParse from "pdf-parse";
import Document from "../models/Document.js";
import User from "../models/User.js";
import {
  deleteDocumentVectors,
  findUploadedDocument,
  listUploadedDocuments,
  processDocument,
} from "../services/ragService.js";
import {
  deletePdfFromCloud,
  streamPdfFromCloud,
  uploadPdfToCloud,
} from "../services/storageService.js";

function sanitizeOriginalName(headerValue) {
  const fallback = "document.pdf";
  let rawName = (headerValue || fallback).trim();

  try {
    rawName = decodeURIComponent(rawName);
  } catch (_error) {
    rawName = fallback;
  }

  const safeName = rawName.replace(/[\\/]/g, "_").trim();
  const normalizedName = safeName || fallback;

  return normalizedName.toLowerCase().endsWith(".pdf")
    ? normalizedName
    : `${normalizedName}.pdf`;
}

export async function getUploadedDocuments(req, res) {
  try {
    const documents = await listUploadedDocuments(req.user);
    return res.json({
      success: true,
      documents,
    });
  } catch (error) {
    console.error("List documents route failed:", error);
    return res.status(500).json({
      success: false,
      error:
        error.message || "Something went wrong while fetching uploaded documents.",
    });
  }
}

export async function downloadDocument(req, res) {
  try {
    const docId = req.params.docId?.trim();
    const document = await findUploadedDocument(docId, req.user);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Uploaded PDF not found for this docId.",
      });
    }

    const { body, contentLength, contentType } = await streamPdfFromCloud(
      document.storageKey,
      document.originalName,
    );

    res.setHeader("Content-Type", contentType || "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${document.originalName.replace(/"/g, "")}"`,
    );

    if (contentLength) {
      res.setHeader("Content-Length", String(contentLength));
    }

    body.on("error", (error) => {
      console.error("Cloud download stream failed:", error);
      if (!res.headersSent) {
        res.status(500).end("Unable to download the PDF.");
      } else {
        res.end();
      }
    });

    return body.pipe(res);
  } catch (error) {
    console.error("Download document route failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Something went wrong while downloading the PDF.",
    });
  }
}

export async function uploadDocument(req, res) {
  let document = null;

  try {
    const mimeType = req.headers["content-type"] || "";
    const originalName = sanitizeOriginalName(req.headers["x-file-name"]);
    const fileBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    if (!fileBuffer.length) {
      return res.status(400).json({
        success: false,
        error: "Please upload a PDF file.",
      });
    }

    if (!mimeType.startsWith("application/pdf")) {
      return res.status(400).json({
        success: false,
        error: "Only PDF files are allowed.",
      });
    }

    let pages = 0;

    try {
      const pdfInfo = await pdfParse(fileBuffer);
      pages = pdfInfo.numpages || 0;
    } catch (error) {
      console.warn("Could not read PDF page count during upload:", error.message);
    }

    const { storageKey } = await uploadPdfToCloud(
      fileBuffer,
      originalName,
    );

    document = await Document.create({
      docId: randomUUID(),
      ownerId: req.user._id,
      originalName,
      mimeType,
      size: fileBuffer.length,
      storageKey,
      pages,
    });

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { documentIds: document._id },
    });

    document.status = "processing";
    document.processingError = "";
    await document.save();

    const result = await processDocument(document, fileBuffer);

    document.status = "processed";
    document.pages = result.pageCount;
    document.processedAt = new Date();
    document.pineconeNamespace = document.docId;
    await document.save();

    return res.json({
      success: true,
      docId: document.docId,
      fileName: document.originalName,
      pages: document.pages,
      storageKey: document.storageKey,
      chunkCount: result.chunkCount,
      extractionMode: result.extractionMode,
      message: `File uploaded, checked, and indexed successfully using ${result.extractionMode === "ocr" ? "OCR for scanned/image-based content" : "direct PDF text extraction"}. ${result.chunkCount} chunks stored in Pinecone.`,
    });
  } catch (error) {
    console.error("Upload route failed:", error);

    if (document) {
      await Document.updateOne(
        { _id: document._id },
        {
          $set: {
            status: "failed",
            processingError: error.message || "Upload or processing failed.",
          },
        },
      );
    }

    return res.status(500).json({
      success: false,
      error:
        error.message || "Something went wrong while uploading and processing the PDF.",
    });
  }
}

export async function processUploadedDocument(req, res) {
  try {
    const docId = req.body?.docId?.trim();

    if (!docId) {
      return res.status(400).json({
        success: false,
        error: "docId is required.",
      });
    }

    const document = await findUploadedDocument(docId, req.user);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Uploaded PDF not found for this docId.",
      });
    }

    document.status = "processing";
    document.processingError = "";
    await document.save();

    const result = await processDocument(document);

    document.status = "processed";
    document.pages = result.pageCount;
    document.processedAt = new Date();
    document.pineconeNamespace = document.docId;
    await document.save();

    return res.json({
      success: true,
      message: `Document processed successfully. ${result.chunkCount} chunks stored in Pinecone.`,
      chunkCount: result.chunkCount,
      pageCount: result.pageCount,
    });
  } catch (error) {
    console.error("Process route failed:", error);

    const docId = req.body?.docId?.trim();
    if (docId) {
      await Document.updateOne(
        { docId },
        {
          $set: {
            status: "failed",
            processingError: error.message || "Processing failed.",
          },
        },
      );
    }

    return res.status(500).json({
      success: false,
      error: error.message || "Something went wrong while processing the PDF.",
    });
  }
}

export async function deleteUploadedDocument(req, res) {
  try {
    const docId = req.params.docId?.trim();

    if (!docId) {
      return res.status(400).json({
        success: false,
        error: "docId is required.",
      });
    }

    const document = await findUploadedDocument(docId, req.user);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Uploaded PDF not found for this docId.",
      });
    }

    await deleteDocumentVectors(document.docId);
    await deletePdfFromCloud(document.storageKey);

    await Document.deleteOne({ _id: document._id });
    await User.findByIdAndUpdate(document.ownerId, {
      $pull: { documentIds: document._id },
    });

    return res.json({
      success: true,
      message: "Document deleted from Cloudinary, Pinecone, and MongoDB.",
      docId: document.docId,
    });
  } catch (error) {
    console.error("Delete document route failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Something went wrong while deleting the PDF.",
    });
  }
}
