import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format, isPast, isToday } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// ─── Priority / Status helpers ──────────────────────────────────────────────

const PRIORITY_COLORS = {
  LOW: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-red-100 text-red-700',
};

const STATUS_COLORS = {
  TODO: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  DONE: 'bg-green-100 text-green-700',
};

const STATUS_LABELS = { TODO: 'To Do', IN_PROGRESS: 'In Progress', DONE: 'Done' };

// ─── Task Modal ───────────────────────────────────────────────────────────────

function TaskModal({ task, members, myRole, projectId, onClose, onSaved, onDeleted }) {
  const isAdmin = myRole === 'ADMIN';
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    dueDate: task?.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : '',
    priority: task?.priority || 'MEDIUM',
    status: task?.status || 'TODO',
    assignedToId: task?.assignedTo?.id || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        status: form.status,
        ...(isAdmin && {
          title: form.title,
          description: form.description || null,
          dueDate: form.dueDate || null,
          priority: form.priority,
          assignedToId: form.assignedToId || null,
        }),
      };
      const res = task
        ? await api.patch(`/tasks/${task.id}`, payload)
        : await api.post(`/tasks/project/${projectId}`, { ...form, assignedToId: form.assignedToId || null });

      toast.success(task ? 'Task updated!' : 'Task created!');
      onSaved(res.data.task);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${task.id}`);
      toast.success('Task deleted');
      onDeleted(task.id);
    } catch (err) {
      toast.error('Failed to delete task');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{task ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isAdmin && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    className="input"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    className="input"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                <select
                  className="input"
                  value={form.assignedToId}
                  onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="DONE">Done</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              {task && isAdmin && (
                <button type="button" onClick={handleDelete} className="btn-danger text-sm py-1.5 px-3">
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Member Modal ──────────────────────────────────────────────────────────

function AddMemberModal({ projectId, onClose, onAdded }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post(`/projects/${projectId}/members`, { email, role });
      toast.success('Member added!');
      onAdded(res.data.member);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Add Team Member</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              className="input"
              placeholder="member@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <p className="text-xs text-gray-400 mt-1">User must already have an account</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/dashboard/project/${projectId}`)
      .then((res) => setData(res.data.dashboard))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  if (!data) return null;

  const statusData = [
    { name: 'To Do', value: data.tasksByStatus.TODO, color: '#6b7280' },
    { name: 'In Progress', value: data.tasksByStatus.IN_PROGRESS, color: '#3b82f6' },
    { name: 'Done', value: data.tasksByStatus.DONE, color: '#22c55e' },
  ];

  const priorityData = [
    { name: 'Low', value: data.tasksByPriority.LOW, color: '#86efac' },
    { name: 'Medium', value: data.tasksByPriority.MEDIUM, color: '#fde68a' },
    { name: 'High', value: data.tasksByPriority.HIGH, color: '#fca5a5' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Tasks', value: data.totalTasks, color: 'text-gray-900' },
          { label: 'Completion Rate', value: `${data.completionRate}%`, color: 'text-green-600' },
          { label: 'In Progress', value: data.tasksByStatus.IN_PROGRESS, color: 'text-blue-600' },
          { label: 'Overdue', value: data.overdueCount, color: 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Tasks by Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Tasks per Member</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.tasksPerUser} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="totalAssigned" fill="#6366f1" name="Total" radius={[4, 4, 0, 0]} />
              <Bar dataKey="done" fill="#22c55e" name="Done" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Overdue tasks */}
      {data.overdueTasks.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Overdue Tasks ({data.overdueCount})
          </h3>
          <div className="space-y-2">
            {data.overdueTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.title}</p>
                  <p className="text-xs text-gray-500">
                    {t.assignedTo ? `Assigned to ${t.assignedTo.name}` : 'Unassigned'}
                  </p>
                </div>
                <span className="text-xs text-red-600 font-medium">
                  Due {format(new Date(t.dueDate), 'MMM d')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectDetail() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);

  const myRole = project?.myRole;
  const isAdmin = myRole === 'ADMIN';

  const fetchProject = useCallback(async () => {
    try {
      const res = await api.get(`/projects/${projectId}`);
      setProject(res.data.project);
      setTasks(res.data.project.tasks || []);
    } catch {
      toast.error('Failed to load project');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [projectId, navigate]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const handleTaskSaved = (savedTask) => {
    setTasks((prev) => {
      const exists = prev.find((t) => t.id === savedTask.id);
      return exists ? prev.map((t) => t.id === savedTask.id ? savedTask : t) : [savedTask, ...prev];
    });
    setShowTaskModal(false);
    setEditingTask(null);
  };

  const handleTaskDeleted = (taskId) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setShowTaskModal(false);
    setEditingTask(null);
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Remove this member?')) return;
    try {
      await api.delete(`/projects/${projectId}/members/${userId}`);
      toast.success('Member removed');
      setProject((prev) => ({
        ...prev,
        members: prev.members.filter((m) => m.userId !== userId),
      }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    try {
      await api.delete(`/projects/${projectId}`);
      toast.success('Project deleted');
      navigate('/');
    } catch {
      toast.error('Failed to delete project');
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    return true;
  });

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <Link to="/" className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Projects
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project?.name}</h1>
            {project?.description && (
              <p className="text-gray-500 mt-1">{project.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className={`badge ${isAdmin ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                {myRole}
              </span>
              <span className="text-xs text-gray-400">
                {project?.members?.length} members · {tasks.length} tasks
              </span>
            </div>
          </div>
          {isAdmin && (
            <button onClick={handleDeleteProject} className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Project
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {['tasks', 'members', 'dashboard'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex gap-2">
              <select
                className="input py-1.5 text-sm w-auto"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
              </select>
              <select
                className="input py-1.5 text-sm w-auto"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="">All Priorities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            {isAdmin && (
              <button
                onClick={() => { setEditingTask(null); setShowTaskModal(true); }}
                className="btn-primary flex items-center gap-2 text-sm py-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Task
              </button>
            )}
          </div>

          {/* Kanban-style columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {['TODO', 'IN_PROGRESS', 'DONE'].map((status) => {
              const columnTasks = filteredTasks.filter((t) => t.status === status);
              return (
                <div key={status} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-700 text-sm">
                      {STATUS_LABELS[status]}
                    </h3>
                    <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">
                      {columnTasks.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {columnTasks.map((task) => {
                      const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'DONE';
                      const isDueToday = task.dueDate && isToday(new Date(task.dueDate));
                      const canEdit = isAdmin || task.assignedTo?.id === user.id;
                      return (
                        <div
                          key={task.id}
                          onClick={() => { if (canEdit) { setEditingTask(task); setShowTaskModal(true); } }}
                          className={`bg-white rounded-lg p-3 border shadow-sm transition-all ${
                            canEdit ? 'cursor-pointer hover:shadow-md' : 'opacity-75'
                          } ${isOverdue ? 'border-red-200' : 'border-gray-100'}`}
                        >
                          <p className="font-medium text-sm text-gray-900 mb-2">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            <span className={`badge text-xs ${PRIORITY_COLORS[task.priority]}`}>
                              {task.priority}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            {task.assignedTo ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center">
                                  <span className="text-indigo-700 text-xs font-semibold">
                                    {task.assignedTo.name.charAt(0)}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500">{task.assignedTo.name.split(' ')[0]}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Unassigned</span>
                            )}
                            {task.dueDate && (
                              <span className={`text-xs font-medium ${
                                isOverdue ? 'text-red-600' : isDueToday ? 'text-orange-500' : 'text-gray-400'
                              }`}>
                                {isOverdue ? '⚠ ' : ''}
                                {format(new Date(task.dueDate), 'MMM d')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {columnTasks.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">No tasks</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {isAdmin && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowMemberModal(true)}
                className="btn-primary flex items-center gap-2 text-sm py-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Add Member
              </button>
            </div>
          )}
          <div className="card">
            <div className="divide-y divide-gray-50">
              {project?.members?.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-indigo-700 font-semibold">
                        {m.user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {m.user.name}
                        {m.user.id === user.id && (
                          <span className="ml-1 text-xs text-gray-400">(you)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">{m.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`badge ${m.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                      {m.role}
                    </span>
                    {isAdmin && m.user.id !== user.id && (
                      <button
                        onClick={() => handleRemoveMember(m.userId)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && <DashboardTab projectId={projectId} />}

      {/* Modals */}
      {showTaskModal && (
        <TaskModal
          task={editingTask}
          members={project?.members || []}
          myRole={myRole}
          projectId={projectId}
          onClose={() => { setShowTaskModal(false); setEditingTask(null); }}
          onSaved={handleTaskSaved}
          onDeleted={handleTaskDeleted}
        />
      )}
      {showMemberModal && (
        <AddMemberModal
          projectId={projectId}
          onClose={() => setShowMemberModal(false)}
          onAdded={(member) =>
            setProject((prev) => ({ ...prev, members: [...prev.members, member] }))
          }
        />
      )}
    </div>
  );
}
