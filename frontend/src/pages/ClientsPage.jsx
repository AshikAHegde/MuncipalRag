import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Folder, Users, Briefcase, ChevronRight, Loader2 } from 'lucide-react';
import api from '../lib/api.js';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  // New Client Form
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    phone: '',
    caseDetails: { title: '', oppositeParty: '' }
  });

  const fetchClients = async () => {
    try {
      const res = await api.get('/api/clients');
      if (res.data.success) {
        setClients(res.data.clients);
      }
    } catch (error) {
      console.error("Failed to fetch clients", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/clients', newClient);
      if (res.data.success) {
        setClients([res.data.client, ...clients]);
        setShowModal(false);
        setNewClient({ name: '', email: '', phone: '', caseDetails: { title: '', oppositeParty: '' } });
      }
    } catch (error) {
      console.error("Error creating client", error);
    }
  };

  const filteredClients = clients?.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.caseDetails?.title?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <section className="premium-surface flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-[#e6e0d6] bg-cream-50 dark:border-[#355269] dark:bg-[#1b2c3a]">
      <div className="flex shrink-0 items-center justify-between border-b border-[#e6e0d6] bg-white px-6 py-4 dark:border-[#355269] dark:bg-[#1b2c3a]">
        <div>
          <h1 className="text-2xl font-bold text-moss-900 dark:text-[#f3e4db]">Client Workspaces</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage your legal cases and client portfolios.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-xl bg-moss-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-moss-700 shadow-sm"
        >
          <Plus size={18} /> New Client
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search clients or cases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-moss-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-sky-500 transition"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-moss-500" size={32} /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500">No clients found.</div>
            ) : (
              filteredClients.map(client => (
                <Link 
                  key={client._id} 
                  to={`/clients/${client._id}`}
                  className="group relative flex flex-col rounded-2xl border border-[#ebe5dc] bg-white p-5 transition hover:border-moss-300 hover:shadow-lg dark:border-[#1d2a35] dark:bg-[#131d26] dark:hover:border-sky-500/50 dark:hover:shadow-[0_0_20px_rgba(14,165,233,0.1)]"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-moss-100 text-moss-700 dark:bg-[#1d3344] dark:text-[#a9d6f7] font-bold text-lg">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{client.name}</h3>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                          {client.caseDetails?.status || 'Active'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Briefcase size={14} className="opacity-70" />
                      <span className="truncate">{client.caseDetails?.title || 'No case title'}</span>
                    </div>
                    {client.caseDetails?.oppositeParty && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Users size={14} className="opacity-70" />
                        <span className="truncate">Vs: {client.caseDetails.oppositeParty}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-auto border-t border-[#ebe5dc] pt-3 flex items-center justify-between text-moss-600 dark:border-white/5 dark:text-sky-400 font-medium text-sm">
                    Open Workspace <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#131d26] dark:border dark:border-white/10 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Create New Client</h2>
            <form onSubmit={handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">Client Name</label>
                <input required type="text" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-moss-500 dark:border-white/10 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">Email</label>
                  <input type="email" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-moss-500 dark:border-white/10 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">Phone</label>
                  <input type="text" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-moss-500 dark:border-white/10 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">Case Title (Optional)</label>
                <input type="text" value={newClient.caseDetails.title} onChange={e => setNewClient({...newClient, caseDetails: {...newClient.caseDetails, title: e.target.value}})} className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-moss-500 dark:border-white/10 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">Opposite Party (Optional)</label>
                <input type="text" value={newClient.caseDetails.oppositeParty} onChange={e => setNewClient({...newClient, caseDetails: {...newClient.caseDetails, oppositeParty: e.target.value}})} className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-moss-500 dark:border-white/10 dark:text-white" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Full Client / Case Information (Optional)</label>
                  <label className="cursor-pointer text-xs font-bold text-moss-600 dark:text-sky-400 hover:underline">
                    Upload Text or PDF File
                    <input 
                      type="file" 
                      accept=".txt,.md,.csv,.pdf" 
                      className="hidden" 
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                            try {
                              const res = await api.post('/api/clients/extract-pdf', file, {
                                headers: { 'Content-Type': 'application/pdf' }
                              });
                              if (res.data.success) {
                                setNewClient(prev => ({
                                  ...prev,
                                  caseDetails: { ...prev.caseDetails, description: prev.caseDetails?.description ? prev.caseDetails.description + '\n\n' + res.data.text : res.data.text }
                                }));
                              }
                            } catch (err) {
                              console.error("PDF Extraction failed:", err);
                              alert("Failed to extract text from PDF. " + (err.response?.data?.error || err.message));
                            }
                          } else {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              setNewClient(prev => ({
                                ...prev,
                                caseDetails: { ...prev.caseDetails, description: prev.caseDetails?.description ? prev.caseDetails.description + '\n\n' + evt.target.result : evt.target.result }
                              }));
                            };
                            reader.readAsText(file);
                          }
                        }
                        e.target.value = null;
                      }} 
                    />
                  </label>
                </div>
                <textarea 
                  value={newClient.caseDetails.description || ''} 
                  onChange={e => setNewClient({...newClient, caseDetails: {...newClient.caseDetails, description: e.target.value}})} 
                  placeholder="Paste full case history, background, or client details here..."
                  className="w-full h-32 rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-moss-500 dark:border-white/10 dark:text-white resize-none" 
                />
              </div>
              
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/10">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition">Cancel</button>
                <button type="submit" className="rounded-xl bg-moss-600 px-5 py-2 text-sm font-semibold text-white hover:bg-moss-700 transition">Create Client</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
