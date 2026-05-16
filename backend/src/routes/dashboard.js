const express = require('express');
const prisma = require('../prisma');
const { authenticate, requireProjectMember } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// GET /api/dashboard/project/:projectId — full dashboard stats
router.get('/project/:projectId', requireProjectMember, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const now = new Date();

    const [
      totalTasks,
      tasksByStatus,
      tasksByPriority,
      overdueTasks,
      members,
      recentTasks,
    ] = await Promise.all([
      // Total tasks
      prisma.task.count({ where: { projectId } }),

      // Tasks grouped by status
      prisma.task.groupBy({
        by: ['status'],
        where: { projectId },
        _count: { status: true },
      }),

      // Tasks grouped by priority
      prisma.task.groupBy({
        by: ['priority'],
        where: { projectId },
        _count: { priority: true },
      }),

      // Overdue tasks (due date in past, not done)
      prisma.task.findMany({
        where: {
          projectId,
          dueDate: { lt: now },
          status: { not: 'DONE' },
        },
        include: {
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),

      // Members with their task counts
      prisma.projectMember.findMany({
        where: { projectId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              assignedTasks: {
                where: { projectId },
                select: { id: true, status: true },
              },
            },
          },
        },
      }),

      // Recently updated tasks
      prisma.task.findMany({
        where: { projectId },
        include: {
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
    ]);

    // Format status counts
    const statusMap = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
    tasksByStatus.forEach((s) => {
      statusMap[s.status] = s._count.status;
    });

    // Format priority counts
    const priorityMap = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    tasksByPriority.forEach((p) => {
      priorityMap[p.priority] = p._count.priority;
    });

    // Tasks per user
    const tasksPerUser = members.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      totalAssigned: m.user.assignedTasks.length,
      todo: m.user.assignedTasks.filter((t) => t.status === 'TODO').length,
      inProgress: m.user.assignedTasks.filter((t) => t.status === 'IN_PROGRESS').length,
      done: m.user.assignedTasks.filter((t) => t.status === 'DONE').length,
    }));

    res.json({
      dashboard: {
        totalTasks,
        tasksByStatus: statusMap,
        tasksByPriority: priorityMap,
        overdueTasks,
        overdueCount: overdueTasks.length,
        tasksPerUser,
        recentTasks,
        completionRate: totalTasks > 0 ? Math.round((statusMap.DONE / totalTasks) * 100) : 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/me — global stats for logged in user
router.get('/me', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    const [myProjects, myTasks, myOverdue] = await Promise.all([
      prisma.projectMember.count({ where: { userId } }),

      prisma.task.groupBy({
        by: ['status'],
        where: { assignedToId: userId },
        _count: { status: true },
      }),

      prisma.task.count({
        where: {
          assignedToId: userId,
          dueDate: { lt: now },
          status: { not: 'DONE' },
        },
      }),
    ]);

    const statusMap = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
    myTasks.forEach((t) => { statusMap[t.status] = t._count.status; });

    res.json({
      stats: {
        totalProjects: myProjects,
        myTasks: statusMap,
        overdueCount: myOverdue,
        totalAssigned: Object.values(statusMap).reduce((a, b) => a + b, 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
