import React, { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { AlertCircle, CheckCircle2, Download, File, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { cn } from '../lib/utils.js';
import api from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';

const AdminUpload = () => {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [domain, setDomain] = useState('criminal');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [documents, setDocuments] = useState([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [deletingDocId, setDeletingDocId] = useState('');
  const legalDomains = [
    { label: 'Criminal', value: 'criminal' },
    { label: 'Civil', value: 'civil' },
    { label: 'Corporate', value: 'corporate' },
    { label: 'Tax', value: 'tax' },
  ];
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
      const response = await api.get('/api/admin/documents');
      if (response.data.success) {
        setDocuments(response.data.documents || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingDocuments(false);
    }
  }, []);

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
      setMessage('Uploading, checking, and indexing the PDF...');

      const uploadRes = await api.post('/api/admin/upload', file, {
        headers: {
          'Content-Type': 'application/pdf',
          'X-File-Name': encodeURIComponent(file.name),
          'X-Document-Domain': domain,
        },
      });

      if (!uploadRes.data.success) {
        throw new Error(uploadRes.data.error || 'Failed to upload document');
      }

      setStatus('success');
      setMessage(uploadRes.data.message || 'Document processed and indexed successfully.');
      setFile(null);
      await loadDocuments();
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage(err.response?.data?.error || err.message || 'Unexpected error during upload or indexing.');
    }
  };

  const handleDownload = async (document) => {
    try {
      const response = await api.get(`/api/admin/documents/${document.docId}/download`, {
        responseType: 'blob',
      });

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = window.document.createElement('a');
      link.href = blobUrl;
      link.download = document.fileName;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (downloadError) {
      console.error(downloadError);
      setStatus('error');
      setMessage(downloadError.response?.data?.error || 'Unable to download the selected PDF.');
    }
  };

  const handleDelete = async (document) => {
    const confirmed = window.confirm(
      `Delete "${document.fileName}" from Cloudinary, Pinecone, and MongoDB?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingDocId(document.docId);
      setStatus('processing');
      setMessage(`Deleting ${document.fileName} from all storage systems...`);

      const response = await api.delete(`/api/admin/documents/${document.docId}`);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to delete document');
      }

      setStatus('success');
      setMessage(response.data.message || 'Document deleted successfully.');
      await loadDocuments();
    } catch (deleteError) {
      console.error(deleteError);
      setStatus('error');
      setMessage(deleteError.response?.data?.error || deleteError.message || 'Unable to delete the selected PDF.');
    } finally {
      setDeletingDocId('');
    }
  };

  return (
    <section className="glass-panel w-full self-start rounded-[28px] p-3.5 shadow-[0_24px_64px_rgba(2,8,23,0.42)] sm:p-5">
      <div className="mb-5 rounded-[24px] border border-slate-200/80 bg-white/65 p-4 dark:border-white/10 dark:bg-slate-950/40 sm:p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-teal-700/75 dark:text-teal-200/75">Admin Workspace</p>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl">Document management</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Signed in as {user?.fullName}. Only admin accounts can upload, process, and download indexed legal PDFs.
            </p>
          </div>
          <div className="w-fit rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs uppercase tracking-[0.24em] text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-slate-400">
            role: {user?.role}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/8 dark:bg-white/5">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Indexed Files</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{documents.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/8 dark:bg-white/5">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Selected File</p>
            <p className="mt-2 truncate text-sm font-medium text-slate-900 dark:text-white">{file?.name || 'No file selected'}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/8 dark:bg-white/5">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Current Status</p>
            <p className="mt-2 text-sm font-medium capitalize text-slate-900 dark:text-white">{status.replace('_', ' ')}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/8 dark:bg-white/5">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Accepted Type</p>
            <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">PDF only</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.9fr)]">
        <div className="rounded-[24px] border border-slate-200/80 bg-white/65 p-4 sm:p-5 dark:border-white/10 dark:bg-white/4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700/75 dark:text-teal-200/75">Upload Area</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">Dropzone</h3>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
              Upload a legal PDF, assign its domain metadata, and the backend will process, chunk, and index it for the legal AI system.
            </p>
          </div>

          <div className="mb-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Domain</span>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {legalDomains.map((option) => {
                  const isActive = domain === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDomain(option.value)}
                      className={cn(
                        'rounded-[16px] border px-4 py-3 text-left text-sm font-semibold transition',
                        isActive
                          ? 'border-sky-300 bg-sky-100 text-slate-950 shadow-[0_10px_30px_rgba(96,165,250,0.16)] dark:border-sky-300/40 dark:bg-sky-400/15 dark:text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50 dark:border-white/10 dark:bg-white/6 dark:text-slate-200 dark:hover:border-sky-200/30 dark:hover:bg-white/10',
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </label>
          </div>

          <div
            {...getRootProps()}
            className={cn(
              'group flex min-h-[16rem] cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed p-5 text-center transition-all duration-300 sm:min-h-[18rem] sm:p-6 lg:min-h-[22rem]',
              isDragActive
                ? 'border-teal-300 bg-teal-300/10 shadow-[0_24px_60px_rgba(45,212,191,0.12)]'
                : 'border-slate-300 bg-white hover:border-teal-300 hover:bg-teal-50/40 dark:border-white/14 dark:bg-slate-950/35 dark:hover:border-teal-200/35 dark:hover:bg-slate-950/50',
              status === 'uploading' || status === 'processing' ? 'pointer-events-none opacity-60' : '',
            )}
          >
            <input {...getInputProps()} />
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] border border-teal-200 bg-white text-teal-600 shadow-[0_18px_50px_rgba(20,184,166,0.1)] dark:border-white/12 dark:bg-white/8 dark:text-teal-200 dark:shadow-[0_18px_50px_rgba(20,184,166,0.12)]">
              {file ? <File size={28} /> : <UploadCloud size={28} />}
            </div>

            {file ? (
              <div className="w-full max-w-lg">
                <p className="break-words text-lg font-semibold text-slate-900 dark:text-white">{file.name}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="max-w-lg">
                <p className="text-lg font-semibold text-slate-900 dark:text-white">Drag and drop your PDF here</p>
                <p className="mt-2.5 text-sm leading-6 text-slate-600 dark:text-slate-300">or click to browse and upload a clean text-based file</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-[24px] border border-slate-200/80 bg-white/65 p-4 sm:p-5 dark:border-white/10 dark:bg-slate-950/40">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700/75 dark:text-teal-200/75">Upload Workflow</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {[
                'Upload the PDF from the admin panel',
                'Backend extracts text and creates chunks',
                'Embeddings are stored in Pinecone with legal metadata for domain-based retrieval',
              ].map((step, index) => (
                <div key={step} className="flex h-full items-start gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/8 dark:bg-white/5">
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
                'rounded-[24px] border p-4',
                status === 'error' && 'border-rose-400/20 bg-rose-500/10 text-rose-100',
                status === 'success' && 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
                (status === 'uploading' || status === 'processing') && 'border-sky-400/20 bg-sky-500/10 text-sky-100',
              )}
            >
              <div className="flex items-start gap-3">
                {status === 'error' && <AlertCircle className="mt-0.5 shrink-0" size={18} />}
                {status === 'success' && <CheckCircle2 className="mt-0.5 shrink-0" size={18} />}
                {(status === 'uploading' || status === 'processing') && <Loader2 className="mt-0.5 shrink-0 animate-spin" size={18} />}
                <p className="text-sm leading-6">{message}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleUploadAndProcess}
            disabled={!file || status === 'uploading' || status === 'processing'}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[18px] bg-gradient-to-r from-teal-300 via-cyan-300 to-sky-200 px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {(status === 'uploading' || status === 'processing') ? <Loader2 className="animate-spin" size={18} /> : <UploadCloud size={18} />}
            {(status === 'uploading' || status === 'processing') ? 'Processing...' : 'Upload & Index'}
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-white/65 p-4 dark:border-white/10 dark:bg-slate-950/40 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {documents.map((document) => (
              <div
                key={document.docId}
                className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-teal-300 hover:bg-teal-50/40 dark:border-white/8 dark:bg-white/5 dark:hover:border-teal-200/35 dark:hover:bg-white/8"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{document.fileName}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {document.domain} · {(document.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownload(document)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-teal-300 hover:text-teal-700 dark:border-white/10 dark:text-slate-300 dark:hover:border-teal-200/35 dark:hover:text-teal-200"
                    aria-label={`Download ${document.fileName}`}
                  >
                    <Download size={16} className="shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(document)}
                    disabled={deletingDocId === document.docId}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 text-rose-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-400/20 dark:text-rose-300 dark:hover:border-rose-300/35 dark:hover:bg-rose-500/10"
                    aria-label={`Delete ${document.fileName}`}
                  >
                    {deletingDocId === document.docId ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} className="shrink-0" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default AdminUpload;
