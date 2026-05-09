import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('clients');
  const [orgs, setOrgs] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [error, setError] = useState('');
  
  // Expanded Org state for viewing presenters
  const [expandedOrg, setExpandedOrg] = useState(null);
  
  // Create Modal State
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', domain: '', maxLicenses: 10 });
  const [creating, setCreating] = useState(false);

  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get('/admin/organizations');
      setOrgs(res.data.organizations);
      setStats(res.data.stats);

      const ticketRes = await api.get('/admin/support');
      setTickets(ticketRes.data.tickets);
    } catch (err) {
      setError('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await api.put(`/admin/organizations/${id}/status`);
      fetchData();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/admin/organizations', form);
      setShowModal(false);
      setForm({ name: '', domain: '', maxLicenses: 10 });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
      <div className="text-cyan-400 text-sm font-mono animate-pulse">Loading SaaS Data...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      {/* Navbar */}
      <nav className="border-b border-white/[0.06] bg-[#07090F]/95 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-sm">👑</div>
            <span className="font-black tracking-tight text-lg">Super<span className="text-orange-400">Admin</span></span>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }} className="text-sm font-bold text-slate-400 hover:text-white transition-colors">
            Sign Out
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#0D1220] border border-white/5 rounded-2xl p-6 shadow-xl">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Total Universities</div>
            <div className="text-4xl font-black text-cyan-400">{stats?.totalOrganizations || 0}</div>
          </div>
          <div className="bg-[#0D1220] border border-white/5 rounded-2xl p-6 shadow-xl">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Active Presenters</div>
            <div className="text-4xl font-black text-emerald-400">{stats?.totalPresenters || 0}</div>
          </div>
          <div className="bg-[#0D1220] border border-white/5 rounded-2xl p-6 shadow-xl">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">MRR (Demo)</div>
            <div className="text-4xl font-black text-purple-400">$2,450</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 mb-6">
          <button 
            onClick={() => setActiveTab('clients')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'clients' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-500 hover:text-white'
            }`}
          >
            Universities & Clients
          </button>
          <button 
            onClick={() => setActiveTab('tickets')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'tickets' ? 'border-orange-400 text-orange-400' : 'border-transparent text-slate-500 hover:text-white'
            }`}
          >
            Support Tickets
            {tickets.filter(t => t.status === 'open').length > 0 && (
              <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                {tickets.filter(t => t.status === 'open').length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'clients' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">University Clients</h2>
              <button 
                onClick={() => setShowModal(true)}
                className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 px-4 py-2 rounded-xl text-sm font-bold transition-all"
              >
                + Onboard New Client
              </button>
            </div>

        {/* Table */}
        <div className="bg-[#0D1220] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Client Name</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Invite Code</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Presenters</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(org => (
                <React.Fragment key={org._id}>
                  <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => setExpandedOrg(expandedOrg === org._id ? null : org._id)}>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-xs w-4">
                          {expandedOrg === org._id ? '▼' : '▶'}
                        </span>
                        <div>
                          <div className="font-bold text-sm text-white">{org.name}</div>
                          <div className="text-xs text-slate-500">{org.domain || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <code className="bg-black/30 px-2 py-1 rounded text-cyan-400 text-xs font-mono select-all">
                        {org.inviteCode}
                      </code>
                    </td>
                    <td className="p-4 text-sm font-medium">
                      {org.presenterCount} <span className="text-slate-600">/ {org.maxLicenses}</span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        org.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {org.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => handleToggleStatus(org._id)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                          org.isActive 
                            ? 'border-red-500/20 text-red-400 hover:bg-red-500/10' 
                            : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                      >
                        {org.isActive ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                  
                  {/* Expanded Presenters View */}
                  {expandedOrg === org._id && (
                    <tr className="bg-black/20 border-b border-white/5">
                      <td colSpan="5" className="p-0">
                        <div className="p-6 pl-12">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Registered Presenters</h4>
                          {org.presenters?.length === 0 ? (
                            <div className="text-sm text-slate-500 italic">No presenters registered yet.</div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {org.presenters.map(p => (
                                <div key={p._id} className="flex items-center gap-3 bg-[#0D1220] border border-white/5 p-3 rounded-xl">
                                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold text-xs border border-cyan-500/20">
                                    {p.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="text-sm font-bold text-white">{p.name}</div>
                                    <div className="text-xs text-slate-500">{p.email}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {orgs.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500 text-sm">No clients onboarded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </>
        )}

        {activeTab === 'tickets' && (
          <div className="bg-[#0D1220] border border-white/5 rounded-2xl overflow-hidden shadow-xl p-6">
            <h2 className="text-xl font-bold mb-6">Support Requests</h2>
            {tickets.length === 0 ? (
              <p className="text-slate-500 text-sm">No support tickets.</p>
            ) : (
              <div className="space-y-4">
                {tickets.map(ticket => (
                  <div key={ticket._id} className="p-4 border border-white/10 rounded-xl bg-white/[0.02]">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-orange-400">{ticket.subject}</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          From: {ticket.userId?.name} <span className="opacity-50">({ticket.organizationId?.name || 'Unknown'})</span>
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        ticket.status === 'open' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {ticket.status}
                      </span>
                    </div>
                    <div className="text-sm text-slate-300 bg-black/20 p-3 rounded-lg mt-3">
                      {ticket.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0D1220] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Onboard New Client</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#4A5568] uppercase tracking-widest block mb-2">University Name</label>
                <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full bg-[#111827] border border-[#1E2D45] text-white rounded-xl px-4 py-3 text-sm focus:border-cyan-400 focus:outline-none" placeholder="Oxford University" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#4A5568] uppercase tracking-widest block mb-2">Domain (Optional)</label>
                <input type="text" value={form.domain} onChange={e => setForm({...form, domain: e.target.value})}
                  className="w-full bg-[#111827] border border-[#1E2D45] text-white rounded-xl px-4 py-3 text-sm focus:border-cyan-400 focus:outline-none" placeholder="oxford.edu" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#4A5568] uppercase tracking-widest block mb-2">Max Presenter Licenses</label>
                <input type="number" min="1" value={form.maxLicenses} onChange={e => setForm({...form, maxLicenses: parseInt(e.target.value)})}
                  className="w-full bg-[#111827] border border-[#1E2D45] text-white rounded-xl px-4 py-3 text-sm focus:border-cyan-400 focus:outline-none" />
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 transition-colors">Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 py-3 rounded-xl font-bold text-sm bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors">
                  {creating ? 'Creating...' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
