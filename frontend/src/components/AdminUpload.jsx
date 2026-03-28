import React, { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { AlertCircle, CheckCircle2, Download, File, Loader2, UploadCloud } from 'lucide-react';
import axios from 'axios';
import { cn } from '../lib/utils.js';

const AdminUpload = () => {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [documents, setDocuments] = useState([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);

  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles?.length > 0) {
      setFile(acceptedFiles[0]);
      setStatus('idle');
      setMessage('');
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    try {
      setIsLoadingDocuments(true);
      const response = await axios.get(`${apiBaseUrl}/api/admin/documents`);
      if (response.data.success) {
        setDocuments(response.data.documents || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  });

  const handleUploadAndProcess = async () => {
    if (!file) return;

    try {
      setStatus('uploading');
      setMessage('Uploading PDF to the backend...');

      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await axios.post(`${apiBaseUrl}/api/admin/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!uploadRes.data.success) {
        throw new Error(uploadRes.data.error || 'Failed to upload document');
      }

      setStatus('processing');
      setMessage(
        uploadRes.data.pages > 0
          ? `Chunking and embedding ${uploadRes.data.pages} pages...`
          : 'Chunking and embedding the uploaded PDF...',
      );

      const processRes = await axios.post(`${apiBaseUrl}/api/admin/process`, {
        docId: uploadRes.data.docId,
      });

      if (!processRes.data.success) {
        throw new Error(processRes.data.error || 'Failed to process document');
      }

      setStatus('success');
      setMessage(processRes.data.message || 'Document processed and indexed successfully.');
      setFile(null);
      await loadDocuments();
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage(err.response?.data?.error || err.message || 'Unexpected error during upload or indexing.');
    }
  };

  return (
    <section className="glass-panel rounded-[32px] p-4 shadow-[0_30px_80px_rgba(2,8,23,0.45)] sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[28px] border border-slate-200/80 bg-white/65 p-6 dark:border-white/10 dark:bg-white/4">
          <div
            {...getRootProps()}
            className={cn(
              'group flex min-h-[23rem] cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed p-8 text-center transition-all duration-300',
              isDragActive
                ? 'border-teal-300 bg-teal-300/10 shadow-[0_24px_60px_rgba(45,212,191,0.12)]'
                : 'border-slate-300 bg-white hover:border-teal-300 hover:bg-teal-50/40 dark:border-white/14 dark:bg-slate-950/35 dark:hover:border-teal-200/35 dark:hover:bg-slate-950/50',
              status === 'uploading' || status === 'processing' ? 'pointer-events-none opacity-60' : '',
            )}
          >
            <input {...getInputProps()} />
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[26px] border border-teal-200 bg-white text-teal-600 shadow-[0_18px_50px_rgba(20,184,166,0.1)] dark:border-white/12 dark:bg-white/8 dark:text-teal-200 dark:shadow-[0_18px_50px_rgba(20,184,166,0.12)]">
              {file ? <File size={34} /> : <UploadCloud size={34} />}
            </div>

            {file ? (
              <div>
                <p className="text-xl font-semibold text-slate-900 dark:text-white">{file.name}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div>
                <p className="text-xl font-semibold text-slate-900 dark:text-white">Drag and drop your PDF here</p>
                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">or click to browse and upload a clean text-based file</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-[28px] border border-slate-200/80 bg-white/65 p-6 dark:border-white/10 dark:bg-slate-950/40">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700/75 dark:text-teal-200/75">Upload Workflow</p>
            <div className="mt-5 space-y-4">
              {[
                'Upload the PDF from the admin panel',
                'Backend extracts text and creates chunks',
                'Embeddings are stored in Pinecone for retrieval',
              ].map((step, index) => (
                <div key={step} className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/8 dark:bg-white/5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
                    {index + 1}
                  </div>
                  <p className="pt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {status !== 'idle' && (
            <div
              className={cn(
                'rounded-[28px] border p-5',
                status === 'error' && 'border-rose-400/20 bg-rose-500/10 text-rose-100',
                status === 'success' && 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
                (status === 'uploading' || status === 'processing') && 'border-sky-400/20 bg-sky-500/10 text-sky-100',
              )}
            >
              <div className="flex items-start gap-3">
                {status === 'error' && <AlertCircle className="mt-0.5 shrink-0" size={18} />}
                {status === 'success' && <CheckCircle2 className="mt-0.5 shrink-0" size={18} />}
                {(status === 'uploading' || status === 'processing') && <Loader2 className="mt-0.5 shrink-0 animate-spin" size={18} />}
                <p className="text-sm leading-7">{message}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleUploadAndProcess}
            disabled={!file || status === 'uploading' || status === 'processing'}
            className="inline-flex items-center justify-center gap-2 rounded-[22px] bg-gradient-to-r from-teal-300 via-cyan-300 to-amber-200 px-6 py-4 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {(status === 'uploading' || status === 'processing') ? <Loader2 className="animate-spin" size={18} /> : <UploadCloud size={18} />}
            {(status === 'uploading' || status === 'processing') ? 'Processing...' : 'Upload & Index'}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-[28px] border border-slate-200/80 bg-white/65 p-5 dark:border-white/10 dark:bg-slate-950/40">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Uploaded PDFs</h3>
          <span className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            {documents.length} file{documents.length === 1 ? '' : 's'}
          </span>
        </div>

        {isLoadingDocuments ? (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-white/8 dark:bg-white/5 dark:text-slate-300">
            <Loader2 size={16} className="animate-spin" />
            Loading uploaded files...
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-white/8 dark:bg-white/5 dark:text-slate-300">
            No uploaded PDFs yet.
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((document) => (
              <a
                key={document.docId}
                href={`${apiBaseUrl}/api/admin/documents/${document.docId}/download`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-teal-300 hover:bg-teal-50/40 dark:border-white/8 dark:bg-white/5 dark:hover:border-teal-200/35 dark:hover:bg-white/8"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{document.fileName}</p>
                </div>
                <Download size={16} className="shrink-0 text-slate-500 dark:text-slate-300" />
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default AdminUpload;
