import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, FileText, MessageSquareText, FileUp, Loader2 } from 'lucide-react';
import api from '../lib/api.js';
import SearchArea from '../components/SearchArea.jsx';

export default function ClientWorkspacePage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details'); // details, chat, docs
  const [isSaving, setIsSaving] = useState(false);

  const fetchClientData = async () => {
    try {
      setLoading(true);
      const clientRes = await api.get(`/api/clients/${clientId}`);
      if (clientRes.data.success) setClient(clientRes.data.client);
    } catch (error) {
      console.error("Error fetching client data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientData();
  }, [clientId]);

  const handleUpdate = async (e) => {
    e?.preventDefault();
    try {
      setIsSaving(true);
      const res = await api.put(`/api/clients/${clientId}`, {
        name: client.name,
        email: client.email,
        phone: client.phone,
        caseDetails: client.caseDetails,
        notes: client.notes
      });
      if (res.data.success) setClient(res.data.client);
    } catch (error) {
      console.error("Failed to update client", error);
    } finally {
      setIsSaving(false);
    }
  };



  if (loading) {
    return <div className="flex h-full items-center justify-center bg-cream-50 dark:bg-[#0b1219]"><Loader2 className="animate-spin text-moss-500" size={48} /></div>;
  }

  if (!client) {
    return <div className="flex h-full flex-col items-center justify-center text-slate-500">Client not found.</div>;
  }

  return (
    <section className="premium-surface flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-[#e6e0d6] bg-cream-50 dark:border-[#355269] dark:bg-[#1b2c3a]">
      <div className="flex shrink-0 items-center justify-between border-b border-[#e6e0d6] bg-white px-6 py-4 dark:border-[#355269] dark:bg-[#1b2c3a] shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Link to="/clients" className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-moss-900 dark:text-[#f3e4db] flex items-center gap-3">
              {client.name}
              <span className="text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400 px-2 py-0.5 rounded">
                Client Workspace
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {client.caseDetails?.title || 'Untitled Case'} {client.caseDetails?.oppositeParty && `(Vs: ${client.caseDetails.oppositeParty})`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
        </div>
      </div>

      <div className="flex shrink-0 border-b border-[#e6e0d6] bg-white px-6 dark:border-[#355269] dark:bg-[#1b2c3a]">
        <button onClick={() => setActiveTab('details')} className={`flex items-center gap-2 border-b-2 px-4 py-4 text-sm font-semibold transition ${activeTab === 'details' ? 'border-moss-600 text-moss-700 dark:border-sky-500 dark:text-sky-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'}`}>
          <FileText size={16} /> Case & Notes
        </button>
        <button onClick={() => setActiveTab('chat')} className={`flex items-center gap-2 border-b-2 px-4 py-4 text-sm font-semibold transition ${activeTab === 'chat' ? 'border-moss-600 text-moss-700 dark:border-sky-500 dark:text-sky-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'}`}>
          <MessageSquareText size={16} /> Client Chat
        </button>
        <button onClick={() => setActiveTab('docs')} className={`flex items-center gap-2 border-b-2 px-4 py-4 text-sm font-semibold transition ${activeTab === 'docs' ? 'border-moss-600 text-moss-700 dark:border-sky-500 dark:text-sky-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'}`}>
          <FileUp size={16} /> Evidence Docs
        </button>
      </div>

      <div className={`flex-1 min-h-0 ${activeTab === 'chat' ? 'flex flex-col' : 'overflow-y-auto'}`}>
        {activeTab === 'details' && (
          <div className="max-w-4xl mx-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#131d26]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Full Case Background</h3>
                  <label className="cursor-pointer text-xs font-bold text-moss-600 dark:text-sky-400 hover:underline flex items-center gap-1">
                    <FileUp size={14} /> Upload File
                    <input 
                      type="file" 
                      accept=".txt,.md,.csv" 
                      className="hidden" 
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            setClient(prev => ({
                              ...prev,
                              caseDetails: { ...prev.caseDetails, description: evt.target.result }
                            }));
                          };
                          reader.readAsText(file);
                        }
                      }} 
                    />
                  </label>
                </div>
                <textarea 
                  value={client.caseDetails?.description || ''}
                  onChange={e => setClient({...client, caseDetails: {...client.caseDetails, description: e.target.value}})}
                  placeholder="Paste or upload the full client background, history, or case facts here..."
                  className="w-full h-48 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none focus:border-moss-500 dark:border-white/10 dark:bg-black/30 dark:text-slate-200 dark:focus:border-sky-500 transition resize-none mb-4"
                />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 pt-4 border-t border-slate-100 dark:border-white/10">Lawyer Private Notes</h3>
                <textarea 
                  value={client.notes}
                  onChange={e => setClient({...client, notes: e.target.value})}
                  placeholder="Draft strategy, record observations, log call summaries here..."
                  className="w-full h-48 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none focus:border-moss-500 dark:border-white/10 dark:bg-black/30 dark:text-slate-200 dark:focus:border-sky-500 transition resize-none"
                />
                <div className="mt-4 flex justify-end">
                  <button onClick={handleUpdate} disabled={isSaving} className="flex items-center gap-2 rounded-xl bg-moss-100 px-4 py-2 text-sm font-semibold text-moss-700 hover:bg-moss-200 transition dark:bg-[#1d3344] dark:text-[#a9d6f7] dark:hover:bg-[#26465d] disabled:opacity-50">
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Notes & Case Data
                  </button>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#131d26]">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">Case Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Status</label>
                    <select value={client.caseDetails?.status} onChange={e => setClient({...client, caseDetails: {...client.caseDetails, status: e.target.value}})} className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/10 dark:text-white">
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Opposite Party</label>
                    <input type="text" value={client.caseDetails?.oppositeParty || ''} onChange={e => setClient({...client, caseDetails: {...client.caseDetails, oppositeParty: e.target.value}})} className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/10 dark:text-white" />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button onClick={handleUpdate} disabled={isSaving} className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline">Update Details</button>
                </div>
              </div>


            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex-1 min-h-0 flex flex-col">
            {client.caseDetails?.description ? (
              <SearchArea 
                clientId={clientId} 
                clientName={client.name}
                initialQuery={`Analyze this case background for legal violations and suggest actions:\n\n${client.caseDetails.description}`} 
                autoSubmit={true} 
                singleRun={true}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500 p-6 flex-col gap-4 text-center">
                <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-2">
                  <MessageSquareText size={32} className="text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Case Background Found</h3>
                <p className="max-w-md text-sm">Please add the "Full Case Background" in the <strong>Case & Notes</strong> tab to automatically start an AI chat analysis for this client.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="flex h-full items-center justify-center text-slate-500 p-6 flex-col gap-4">
            <FileUp size={48} className="text-slate-300 dark:text-slate-600" />
            <p>Document upload for specific clients is currently mapped globally.</p>
            <p className="text-sm">Use the main dashboard to upload evidence and tag it to this case.</p>
          </div>
        )}
      </div>
    </section>
  );
}
