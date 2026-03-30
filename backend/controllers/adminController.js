import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";
import {
  findUploadedDocument,
  listUploadedDocuments,
  processDocument,
} from "../services/ragService.js";

export async function getUploadedDocuments(_req, res) {
  try {
    const documents = await listUploadedDocuments();
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
    const filePath = await findUploadedDocument(docId);

    if (!filePath) {
      return res.status(404).json({
        success: false,
        error: "Uploaded PDF not found for this docId.",
      });
    }

    return res.download(
      filePath,
      path.basename(filePath).split("__").slice(1).join("__"),
    );
  } catch (error) {
    console.error("Download document route failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Something went wrong while downloading the PDF.",
    });
  }
}

export async function uploadDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a PDF file.",
      });
    }

    const [docId] = req.file.filename.split("__");
    let pages = 0;

    try {
      const fileBuffer = await fs.readFile(req.file.path);
      const pdfInfo = await pdfParse(fileBuffer);
      pages = pdfInfo.numpages || 0;
    } catch (error) {
      console.warn("Could not read PDF page count during upload:", error.message);
    }

    return res.json({
      success: true,
      docId,
      fileName: req.file.originalname,
      pages,
      message: "PDF uploaded successfully.",
    });
  } catch (error) {
    console.error("Upload route failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Something went wrong while uploading the PDF.",
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

    const filePath = await findUploadedDocument(docId);

    if (!filePath) {
      return res.status(404).json({
        success: false,
        error: "Uploaded PDF not found for this docId.",
      });
    }

    const result = await processDocument(filePath, docId);

    return res.json({
      success: true,
      message: `Document processed successfully. ${result.chunkCount} chunks stored in Pinecone.`,
      chunkCount: result.chunkCount,
      pageCount: result.pageCount,
    });
  } catch (error) {
    console.error("Process route failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Something went wrong while processing the PDF.",
    });
  }
}
