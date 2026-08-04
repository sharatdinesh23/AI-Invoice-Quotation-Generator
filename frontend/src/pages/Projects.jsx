import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api.js';

const Projects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [connections, setConnections] = useState([]);
  const [savingPlatform, setSavingPlatform] = useState(null);
  const [dragProjectId, setDragProjectId] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [projectInvoices, setProjectInvoices] = useState([]);
  const [milestoneForm, setMilestoneForm] = useState({ title: '', amount: '', due_date: '' });
  const [platformForms, setPlatformForms] = useState({
    upwork: { api_key: '', api_secret: '' },
    fiverr: { api_key: '', api_secret: '' }
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_id: '',
    status: 'todo',
    source: 'manual',
    budget: '',
    currency: 'INR',
    deadline: ''
  });

  const columns = [
    { id: 'backlog', title: '📋 Backlog', color: 'border-slate-400 text-slate-700 bg-slate-50' },
    { id: 'todo', title: '⏳ To Do', color: 'border-blue-400 text-blue-700 bg-blue-50' },
    { id: 'in_progress', title: '⚡ In Progress', color: 'border-amber-400 text-amber-700 bg-amber-50' },
    { id: 'review', title: '🔍 Under Review', color: 'border-purple-400 text-purple-700 bg-purple-50' },
    { id: 'completed', title: '✓ Completed', color: 'border-emerald-400 text-emerald-700 bg-emerald-50' }
  ];

  useEffect(() => {
    fetchProjects();
    fetchClients();
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const res = await api.getPlatformConnections();
      const data = await res.json();
      setConnections(data.connections || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await api.getProjects();
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await api.getClients();
      const data = await res.json();
      setClients(data.clients || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSyncGmail = async () => {
    try {
      setSyncing(true);
      const res = await api.syncGmailProjects();
      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || 'Sync failed');
        return;
      }
      const gmail = data.gmail || {};
      alert(
        data.message ||
        `Sync done: ${data.synced_count || 0} new, ${gmail.skipped || 0} skipped, ${gmail.scanned || 0} scanned`
      );
      fetchProjects();
      fetchConnections();
    } catch (err) {
      alert('Failed to sync emails for projects');
    } finally {
      setSyncing(false);
    }
  };

  const handleSavePlatform = async (platformName) => {
    const form = platformForms[platformName];
    if (!form.api_key) {
      alert('API key is required');
      return;
    }
    try {
      setSavingPlatform(platformName);
      const res = await api.savePlatformConnection({
        platform_name: platformName,
        api_key: form.api_key,
        api_secret: form.api_secret || undefined
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || 'Failed to save credentials');
        return;
      }
      alert(data.message || 'Credentials saved');
      setPlatformForms(p => ({ ...p, [platformName]: { api_key: '', api_secret: '' } }));
      fetchConnections();
    } catch (err) {
      alert('Failed to save platform credentials');
    } finally {
      setSavingPlatform(null);
    }
  };

  const handleRemovePlatform = async (id) => {
    if (!window.confirm('Remove this platform connection?')) return;
    try {
      await api.deletePlatformConnection(id);
      fetchConnections();
    } catch (err) {
      alert('Failed to remove connection');
    }
  };

  const getConnection = (name) => connections.find(c => c.platform_name === name);

  const openProjectDetail = async (proj) => {
    setSelectedProject(proj);
    try {
      const res = await api.getProjectDetail(proj.id);
      const data = await res.json();
      setMilestones(data.milestones || []);
      setProjectInvoices(data.invoices || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDropOnColumn = async (columnId) => {
    if (!dragProjectId) return;
    const proj = projects.find(p => p.id === dragProjectId);
    if (!proj || proj.status === columnId) {
      setDragProjectId(null);
      return;
    }
    await handleStatusChange(dragProjectId, columnId);
    setDragProjectId(null);
  };

  const handleAddMilestone = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;
    try {
      const res = await api.createMilestone(selectedProject.id, {
        title: milestoneForm.title,
        amount: parseFloat(milestoneForm.amount || 0),
        due_date: milestoneForm.due_date || undefined,
        currency: selectedProject.currency || 'INR',
      });
      if (res.ok) {
        setMilestoneForm({ title: '', amount: '', due_date: '' });
        openProjectDetail(selectedProject);
      }
    } catch (err) {
      alert('Failed to add milestone');
    }
  };

  const handleMilestoneInvoice = async (milestoneId) => {
    try {
      const res = await api.createInvoiceFromMilestone(selectedProject.id, milestoneId);
      const data = await res.json();
      if (res.ok) {
        alert('Draft invoice created!');
        openProjectDetail(selectedProject);
        if (data.invoice?.id) navigate(`/invoices/${data.invoice.id}/edit`);
      }
    } catch (err) {
      alert('Failed to create invoice');
    }
  };

  const handleStatusChange = async (projectId, newStatus) => {
    try {
      const res = await api.updateProject(projectId, { status: newStatus });
      if (res.ok) {
        fetchProjects();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      const res = await api.deleteProject(id);
      if (res.ok) {
        fetchProjects();
      }
    } catch (err) {
      alert('Failed to delete project');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        budget: parseFloat(formData.budget || 0)
      };
      const res = await api.createProject(payload);
      if (res.ok) {
        setShowModal(false);
        setFormData({
          title: '', description: '', client_id: '', status: 'todo',
          source: 'manual', budget: '', currency: 'INR', deadline: ''
        });
        fetchProjects();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.detail || 'Failed to create project'}`);
      }
    } catch (err) {
      alert('Failed to save project');
    }
  };

  const getSourceBadge = (source) => {
    switch (source) {
      case 'upwork': return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-emerald-300">Upwork</span>;
      case 'fiverr': return <span className="bg-green-100 text-green-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-green-300">Fiverr</span>;
      case 'gmail': return <span className="bg-red-100 text-red-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-red-300">Gmail Sync</span>;
      default: return <span className="bg-gray-100 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded border border-gray-300">Manual</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Project & Contract CRM</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Kanban workflow board, budget tracking, & auto-email project detection</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowIntegrations(v => !v)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-semibold border border-gray-200 dark:border-gray-600"
          >
            🔌 Platform APIs
          </button>
          <button
            onClick={handleSyncGmail}
            disabled={syncing}
            className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg text-sm font-semibold border border-indigo-200 shadow-xs flex items-center gap-2"
          >
            {syncing ? ' Scanning Gmail...' : '📧 Scan Gmail for Projects'}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs"
          >
            ➕ New Project
          </button>
        </div>
      </div>

      {/* Platform Integrations Panel */}
      {showIntegrations && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Upwork & Fiverr Integrations</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Store API credentials securely. Gmail parsing remains the primary auto-detection source until partner APIs are approved.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {['upwork', 'fiverr'].map(platform => {
              const conn = getConnection(platform);
              return (
                <div key={platform} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold capitalize text-gray-900 dark:text-white">{platform}</h4>
                    {conn?.has_credentials ? (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Connected</span>
                    ) : (
                      <span className="text-xs text-gray-500">Not connected</span>
                    )}
                  </div>
                  {conn?.last_synced_at && (
                    <p className="text-[11px] text-gray-500">
                      Last sync: {new Date(conn.last_synced_at).toLocaleString()}
                    </p>
                  )}
                  <input
                    type="password"
                    placeholder="API Key"
                    value={platformForms[platform].api_key}
                    onChange={(e) => setPlatformForms(p => ({
                      ...p, [platform]: { ...p[platform], api_key: e.target.value }
                    }))}
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-2 dark:text-white"
                  />
                  <input
                    type="password"
                    placeholder="API Secret (optional)"
                    value={platformForms[platform].api_secret}
                    onChange={(e) => setPlatformForms(p => ({
                      ...p, [platform]: { ...p[platform], api_secret: e.target.value }
                    }))}
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-2 dark:text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSavePlatform(platform)}
                      disabled={savingPlatform === platform}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg"
                    >
                      {savingPlatform === platform ? 'Saving...' : 'Save'}
                    </button>
                    {conn && (
                      <button
                        onClick={() => handleRemovePlatform(conn.id)}
                        className="px-3 py-1.5 text-red-600 text-xs font-bold border border-red-200 rounded-lg"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kanban Board */}
      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading Kanban Projects...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
          {columns.map(col => {
            const colProjects = projects.filter(p => (p.status || 'todo') === col.id);
            return (
              <div
                key={col.id}
                className="bg-gray-100 dark:bg-gray-800/60 rounded-xl p-3 flex flex-col min-h-[500px] border border-gray-200 dark:border-gray-700"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropOnColumn(col.id)}
              >
                <div className={`p-2.5 rounded-lg border font-bold text-xs flex justify-between items-center mb-3 ${col.color}`}>
                  <span>{col.title}</span>
                  <span className="bg-white/80 dark:bg-black/30 px-2 py-0.5 rounded-full">{colProjects.length}</span>
                </div>

                <div className="space-y-3 flex-1">
                  {colProjects.length === 0 ? (
                    <div className="h-24 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg flex items-center justify-center text-xs text-gray-400">
                      No Projects
                    </div>
                  ) : (
                    colProjects.map(proj => (
                      <div
                        key={proj.id}
                        draggable
                        onDragStart={() => setDragProjectId(proj.id)}
                        onDragEnd={() => setDragProjectId(null)}
                        className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-xs border border-gray-200 dark:border-gray-700 hover:shadow-md transition space-y-2 cursor-grab active:cursor-grabbing ${dragProjectId === proj.id ? 'opacity-50' : ''}`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <button type="button" onClick={() => openProjectDetail(proj)} className="font-bold text-sm text-left text-gray-900 dark:text-white leading-tight hover:text-blue-600">
                            {proj.title}
                          </button>
                          {getSourceBadge(proj.source)}
                        </div>

                        {proj.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{proj.description}</p>
                        )}

                        {proj.external_link && (
                          <a
                            href={proj.external_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-600 hover:underline block truncate"
                          >
                            View on {proj.source === 'upwork' ? 'Upwork' : proj.source === 'fiverr' ? 'Fiverr' : 'platform'}
                          </a>
                        )}

                        <div className="flex justify-between items-center text-xs pt-1 border-t border-gray-100 dark:border-gray-700">
                          <span className="font-bold text-gray-800 dark:text-gray-200">
                            {proj.currency || 'INR'} {Number(proj.budget || 0).toLocaleString()}
                          </span>
                          {proj.clients?.name && (
                            <span className="text-[11px] text-gray-500 truncate max-w-[100px]">{proj.clients.name}</span>
                          )}
                        </div>

                        {/* Move Actions */}
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex gap-1 flex-wrap">
                            {columns.filter(c => c.id !== col.id).map(c => (
                              <button
                                key={c.id}
                                onClick={() => handleStatusChange(proj.id, c.id)}
                                title={`Move to ${c.title}`}
                                className="text-[10px] bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded font-medium"
                              >
                                &rarr; {c.title.split(' ')[1] || c.title}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => handleDelete(proj.id)}
                            className="text-red-500 hover:text-red-700 text-xs px-1"
                            title="Delete Project"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Project detail + milestones */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setSelectedProject(null)}>
          <div className="w-full max-w-md bg-white dark:bg-gray-800 h-full shadow-xl p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedProject.title}</h3>
                <p className="text-xs text-gray-500">{selectedProject.currency} {Number(selectedProject.budget || 0).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedProject(null)} className="text-gray-400 text-xl">&times;</button>
            </div>

            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">Milestones</h4>
            <form onSubmit={handleAddMilestone} className="flex gap-2 mb-3">
              <input required placeholder="Title" value={milestoneForm.title} onChange={e => setMilestoneForm(f => ({ ...f, title: e.target.value }))}
                className="flex-1 text-sm border rounded-lg p-2 dark:bg-gray-700 dark:text-white" />
              <input type="number" placeholder="Amt" value={milestoneForm.amount} onChange={e => setMilestoneForm(f => ({ ...f, amount: e.target.value }))}
                className="w-20 text-sm border rounded-lg p-2 dark:bg-gray-700 dark:text-white" />
              <button type="submit" className="px-3 bg-blue-600 text-white text-xs font-bold rounded-lg">Add</button>
            </form>
            <ul className="space-y-2 mb-6">
              {milestones.map(m => (
                <li key={m.id} className="border rounded-lg p-3 text-sm dark:border-gray-600">
                  <div className="flex justify-between">
                    <span className="font-semibold">{m.title}</span>
                    <span>{m.currency} {Number(m.amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-500 capitalize">{m.status}</span>
                    {m.status !== 'invoiced' && (
                      <button onClick={() => handleMilestoneInvoice(m.id)} className="text-xs text-blue-600 font-bold">→ Invoice</button>
                    )}
                  </div>
                </li>
              ))}
              {milestones.length === 0 && <p className="text-xs text-gray-500">No milestones yet.</p>}
            </ul>

            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">Linked Invoices</h4>
            <ul className="space-y-1">
              {projectInvoices.map(inv => (
                <li key={inv.id}>
                  <button onClick={() => navigate(`/invoices/${inv.id}/view`)} className="text-sm text-blue-600 hover:underline">
                    #{inv.invoice_number} — {inv.status} — {inv.currency} {inv.total}
                  </button>
                </li>
              ))}
              {projectInvoices.length === 0 && <p className="text-xs text-gray-500">No invoices linked.</p>}
            </ul>
            <button onClick={() => navigate(`/invoices/new?project_id=${selectedProject.id}`)}
              className="mt-4 w-full py-2 bg-green-600 text-white text-sm font-bold rounded-lg">
              + New Invoice for Project
            </button>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Add New Project / Contract</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Project Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Website Overhaul"
                  className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-2.5 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Client</label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData(p => ({ ...p, client_id: e.target.value }))}
                  className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-2.5 dark:text-white"
                >
                  <option value="">Select Client (Optional)</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Budget</label>
                  <input
                    type="number"
                    value={formData.budget}
                    onChange={(e) => setFormData(p => ({ ...p, budget: e.target.value }))}
                    placeholder="0.00"
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-2.5 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(p => ({ ...p, status: e.target.value }))}
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-2.5 dark:text-white"
                  >
                    <option value="backlog">Backlog</option>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Under Review</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Description</label>
                <textarea
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                  placeholder="Project details & deliverables"
                  className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm p-2.5 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
