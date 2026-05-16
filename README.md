#  TaskFlow — Team Task Manager

A full-stack collaborative task management web application built with **React**, **Node.js/Express**, **PostgreSQL**, and **Prisma**.

Think Trello/Asana — but built from scratch.

---

##  Live Demo

- **Frontend:** `https://taskflow-frontend.up.railway.app`
- **Backend API:** `https://taskflow-backend.up.railway.app`

> Replace with your actual Railway URLs after deployment.

---

##  Features

- **Authentication** — Signup/Login with JWT (7-day tokens, bcrypt password hashing)
- **Projects** — Create projects, invite members by email, manage roles
- **Tasks** — Kanban board (To Do / In Progress / Done), priority levels, due dates, assignments
- **Dashboard** — Pie charts, bar charts, completion rate, overdue alerts
- **Role-Based Access Control:**
  - **Admin** — Full control: create/assign/delete tasks, manage members
  - **Member** — Can only update status of their own assigned tasks

---

##  Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Recharts |
| Backend | Node.js, Express, JWT |
| Database | PostgreSQL |
| ORM | Prisma |
| Deployment | Railway |

---

##  Project Structure

```
team-task-manager/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma       # DB models: User, Project, ProjectMember, Task
│   ├── src/
│   │   ├── middleware/
│   │   │   └── auth.js         # JWT + role middleware
│   │   ├── routes/
│   │   │   ├── auth.js         # POST /signup, /login, GET /me
│   │   │   ├── projects.js     # CRUD + member management
│   │   │   ├── tasks.js        # CRUD with RBAC
│   │   │   └── dashboard.js    # Aggregated stats
│   │   ├── prisma.js           # Prisma client singleton
│   │   └── index.js            # Express app entry
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── api/index.js         # Axios instance with token interceptor
    │   ├── context/AuthContext.jsx
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Signup.jsx
    │   │   ├── Home.jsx         # Projects list + global stats
    │   │   └── ProjectDetail.jsx # Kanban + Members + Dashboard
    │   └── components/
    │       └── Layout.jsx       # Navbar + outlet
    └── package.json
```

---

##  API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user |

### Projects
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/projects` | ✅ | List my projects |
| POST | `/api/projects` | ✅ | Create project (caller = Admin) |
| GET | `/api/projects/:id` | ✅ Member | Project details + tasks + members |
| PATCH | `/api/projects/:id` | ✅ Admin | Update project |
| DELETE | `/api/projects/:id` | ✅ Admin | Delete project |
| POST | `/api/projects/:id/members` | ✅ Admin | Add member by email |
| DELETE | `/api/projects/:id/members/:userId` | ✅ Admin | Remove member |
| PATCH | `/api/projects/:id/members/:userId/role` | ✅ Admin | Change role |

### Tasks
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/tasks/project/:projectId` | ✅ Member | List tasks (Members: own only) |
| POST | `/api/tasks/project/:projectId` | ✅ Admin | Create task |
| PATCH | `/api/tasks/:id` | ✅ | Update (Members: status only) |
| DELETE | `/api/tasks/:id` | ✅ Admin | Delete task |

### Dashboard
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/dashboard/project/:id` | ✅ Member | Project stats + charts data |
| GET | `/api/dashboard/me` | ✅ | Personal task stats |

---

##  Local Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL running locally (or use Railway DB)
- npm or yarn

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/team-task-manager.git
cd team-task-manager
```

### 2. Backend Setup
```bash
cd backend
npm install

# Copy and configure environment
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/taskmanager"
JWT_SECRET="any-long-random-string-here"
PORT=5000
FRONTEND_URL="http://localhost:5173"
```

```bash
# Push schema to database
npx prisma db push

# Start backend
npm run dev
```

Backend runs at: `http://localhost:5000`

### 3. Frontend Setup
```bash
cd ../frontend
npm install

# For local dev, no .env needed (proxy handles /api)
# For production, set:
cp .env.example .env.local
# Edit VITE_API_URL to point to your backend

npm run dev
```

Frontend runs at: `http://localhost:5173`

---

## Railway Deployment

### Step 1: Create Railway Account
Go to [railway.app](https://railway.app) and sign up.

### Step 2: Add PostgreSQL
1. New Project → Add a service → Database → PostgreSQL
2. Copy the `DATABASE_URL` from the Variables tab

### Step 3: Deploy Backend
1. New Service → GitHub Repo → select your repo
2. Set **Root Directory** to `backend`
3. Add environment variables:
   ```
   DATABASE_URL=<from PostgreSQL service>
   JWT_SECRET=<generate a secure random string>
   PORT=5000
   FRONTEND_URL=https://your-frontend.up.railway.app
   ```
4. Deploy → copy the generated domain (e.g. `https://backend.up.railway.app`)

### Step 4: Deploy Frontend
1. New Service → same GitHub Repo
2. Set **Root Directory** to `frontend`
3. Add environment variables:
   ```
   VITE_API_URL=https://your-backend.up.railway.app/api
   ```
4. Add to package.json scripts (already included):
   ```json
   "serve": "npx serve dist -p $PORT"
   ```
5. Deploy

### Step 5: Update CORS
Update `FRONTEND_URL` in backend env vars to match the actual frontend Railway URL.

---

##  Database Schema

```
Users ──< ProjectMembers >── Projects
                                 │
                              Tasks
```

- **Users** — id, name, email, password (hashed)
- **Projects** — id, name, description, createdBy
- **ProjectMembers** — userId + projectId (unique), role (ADMIN/MEMBER)
- **Tasks** — id, title, description, dueDate, priority (LOW/MEDIUM/HIGH), status (TODO/IN_PROGRESS/DONE), projectId, createdById, assignedToId

---

##  Security Features

- Passwords hashed with bcrypt (12 rounds)
- JWT tokens expire in 7 days
- All routes protected via `authenticate` middleware
- Role checks happen at both middleware and route handler level
- Input validation using `express-validator`
- CORS restricted to frontend origin

---

##  Author

Built as part of a full-stack development assignment.
