const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../prisma');
const { authenticate, requireProjectMember } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// GET /api/tasks/project/:projectId — all tasks in a project
router.get('/project/:projectId', requireProjectMember, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { status, priority, assignedToId } = req.query;

    const filters = { projectId };
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (assignedToId) filters.assignedToId = assignedToId;

    // Members only see assigned tasks; admins see all
    if (req.membership.role === 'MEMBER') {
      filters.assignedToId = req.user.id;
    }

    const tasks = await prisma.task.findMany({
      where: filters,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({ tasks });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/project/:projectId — create task (admin only)
router.post(
  '/project/:projectId',
  requireProjectMember,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').optional().trim(),
    body('dueDate').optional().isISO8601().withMessage('Valid date required'),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    body('assignedToId').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      if (req.membership.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can create tasks' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { title, description, dueDate, priority, assignedToId } = req.body;
      const { projectId } = req.params;

      // Validate assignee is a project member
      if (assignedToId) {
        const membership = await prisma.projectMember.findUnique({
          where: { userId_projectId: { userId: assignedToId, projectId } },
        });
        if (!membership) {
          return res.status(400).json({ error: 'Assignee is not a project member' });
        }
      }

      const task = await prisma.task.create({
        data: {
          title,
          description,
          dueDate: dueDate ? new Date(dueDate) : null,
          priority: priority || 'MEDIUM',
          projectId,
          createdById: req.user.id,
          assignedToId: assignedToId || null,
        },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      res.status(201).json({ task });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/tasks/:taskId — update task
router.patch(
  '/:taskId',
  [
    body('title').optional().trim().notEmpty(),
    body('status').optional().isIn(['TODO', 'IN_PROGRESS', 'DONE']),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']),
    body('dueDate').optional().isISO8601(),
  ],
  async (req, res, next) => {
    try {
      const { taskId } = req.params;

      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { project: { include: { members: true } } },
      });

      if (!task) return res.status(404).json({ error: 'Task not found' });

      const membership = task.project.members.find((m) => m.userId === req.user.id);
      if (!membership) return res.status(403).json({ error: 'Not a project member' });

      // Members can only update status of their own tasks
      if (membership.role === 'MEMBER') {
        if (task.assignedToId !== req.user.id) {
          return res.status(403).json({ error: 'You can only update your assigned tasks' });
        }

        const allowedFields = ['status'];
        const attemptedFields = Object.keys(req.body);
        const forbidden = attemptedFields.filter((f) => !allowedFields.includes(f));

        if (forbidden.length > 0) {
          return res.status(403).json({
            error: `Members can only update status. Forbidden fields: ${forbidden.join(', ')}`,
          });
        }
      }

      const { title, description, dueDate, priority, status, assignedToId } = req.body;

      const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: {
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
          ...(priority && { priority }),
          ...(status && { status }),
          ...(assignedToId !== undefined && { assignedToId }),
        },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      res.json({ task: updatedTask });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/tasks/:taskId — delete task (admin only)
router.delete('/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { include: { members: true } } },
    });

    if (!task) return res.status(404).json({ error: 'Task not found' });

    const membership = task.project.members.find((m) => m.userId === req.user.id);
    if (!membership || membership.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can delete tasks' });
    }

    await prisma.task.delete({ where: { id: taskId } });
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
