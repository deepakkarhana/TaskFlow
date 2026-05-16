const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../prisma');
const { authenticate, requireProjectAdmin, requireProjectMember } = require('../middleware/auth');

const router = express.Router();

// All project routes require authentication
router.use(authenticate);

// GET /api/projects — list all projects user belongs to
router.get('/', async (req, res, next) => {
  try {
    const memberships = await prisma.projectMember.findMany({
      where: { userId: req.user.id },
      include: {
        project: {
          include: {
            _count: { select: { tasks: true, members: true } },
            members: {
              where: { role: 'ADMIN' },
              include: { user: { select: { name: true, email: true } } },
              take: 1,
            },
          },
        },
      },
    });

    const projects = memberships.map((m) => ({
      ...m.project,
      myRole: m.role,
    }));

    res.json({ projects });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects — create a project
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Project name is required'),
    body('description').optional().trim(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { name, description } = req.body;

      const project = await prisma.project.create({
        data: {
          name,
          description,
          createdById: req.user.id,
          members: {
            create: { userId: req.user.id, role: 'ADMIN' },
          },
        },
        include: {
          _count: { select: { tasks: true, members: true } },
        },
      });

      res.status(201).json({ project: { ...project, myRole: 'ADMIN' } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/projects/:projectId — project detail
router.get('/:projectId', requireProjectMember, async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        tasks: {
          include: {
            assignedTo: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    res.json({ project: { ...project, myRole: req.membership.role } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/projects/:projectId — update project (admin only)
router.patch(
  '/:projectId',
  requireProjectMember,
  requireProjectAdmin,
  [body('name').optional().trim().notEmpty()],
  async (req, res, next) => {
    try {
      const { projectId } = req.params;
      const { name, description } = req.body;

      const project = await prisma.project.update({
        where: { id: projectId },
        data: { ...(name && { name }), ...(description !== undefined && { description }) },
      });

      res.json({ project });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/projects/:projectId — delete project (admin only)
router.delete('/:projectId', requireProjectMember, requireProjectAdmin, async (req, res, next) => {
  try {
    await prisma.project.delete({ where: { id: req.params.projectId } });
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/members — add member (admin only)
router.post(
  '/:projectId/members',
  requireProjectMember,
  requireProjectAdmin,
  [body('email').isEmail().withMessage('Valid email required')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email, role = 'MEMBER' } = req.body;
      const { projectId } = req.params;

      const userToAdd = await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true, email: true },
      });

      if (!userToAdd) return res.status(404).json({ error: 'User not found with that email' });

      const existing = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: userToAdd.id, projectId } },
      });

      if (existing) return res.status(409).json({ error: 'User is already a member' });

      const membership = await prisma.projectMember.create({
        data: { userId: userToAdd.id, projectId, role },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      res.status(201).json({ member: membership });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/projects/:projectId/members/:userId — remove member (admin only)
router.delete(
  '/:projectId/members/:userId',
  requireProjectMember,
  requireProjectAdmin,
  async (req, res, next) => {
    try {
      const { projectId, userId } = req.params;

      if (userId === req.user.id) {
        return res.status(400).json({ error: 'Cannot remove yourself as admin' });
      }

      await prisma.projectMember.delete({
        where: { userId_projectId: { userId, projectId } },
      });

      res.json({ message: 'Member removed successfully' });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/projects/:projectId/members/:userId/role — change role (admin only)
router.patch(
  '/:projectId/members/:userId/role',
  requireProjectMember,
  requireProjectAdmin,
  async (req, res, next) => {
    try {
      const { projectId, userId } = req.params;
      const { role } = req.body;

      if (!['ADMIN', 'MEMBER'].includes(role)) {
        return res.status(400).json({ error: 'Role must be ADMIN or MEMBER' });
      }

      const membership = await prisma.projectMember.update({
        where: { userId_projectId: { userId, projectId } },
        data: { role },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      res.json({ member: membership });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
