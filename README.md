# Construction ERP Web Application

A complete modern Construction Management & Accounting ERP Web Application for a building construction business.

This project uses a separated frontend and backend architecture, ready for Vercel (Frontend) and Render/Railway (Backend) deployment.

## Tech Stack
- **Frontend**: Next.js 15 (App Router), Tailwind CSS, ShadCN UI, React Query, Framer Motion, jsPDF, XLSX
- **Backend**: Node.js, Express.js, TypeScript, Prisma ORM, JWT Authentication
- **Database**: PostgreSQL (NeonDB/Supabase)

---

## 🚀 How to Run Locally

### 1. Database Setup
1. Create a PostgreSQL database (e.g., using NeonDB or Supabase).
2. Get your connection string (DATABASE_URL).

### 2. Backend Setup
```bash
cd backend
npm install
```

Update your `backend/.env` file:
```env
PORT=5000
DATABASE_URL="postgresql://your_user:your_password@your_host/your_db?schema=public"
JWT_SECRET="your_super_secret_key"
```

Push the database schema and start the server:
```bash
npx prisma db push
npm run dev
```

### 3. Frontend Setup
Open a new terminal window:
```bash
cd frontend
npm install
```

If you changed the backend port, update `frontend/src/lib/axios.ts`. Otherwise, it defaults to `http://localhost:5000/api`.

Start the frontend server:
```bash
npm run dev
```

### 4. Application Access
1. Open your browser and go to `http://localhost:3000`.
2. You will be redirected to `/dashboard` and then to `/login`.
3. To set up your first admin account, you can use Postman to send a POST request to `http://localhost:5000/api/admin/setup` with:
   ```json
   {
     "username": "admin",
     "email": "admin@example.com",
     "password": "password123"
   }
   ```
   *(Note: This setup route only works if there are 0 admins in the database)*.
4. Login using the created credentials.

---

## 🌟 Modules Included
1. **Dashboard**: Financial overview, active sites, recent transactions.
2. **Site Management**: Add/Edit/Delete construction sites, set budgets, track statuses.
3. **Day Book**: Manage daily expenses categorized by Labour, Cement, Transport, etc.
4. **Ledger Management**: Manage accounts for Parties, Suppliers, and Contractors with automated outstanding balance tracking.
5. **Material Management**: Inventory tracking, stock in/out usage tracking, and low-stock alerts.
6. **Reports**: Generate formatted Day Book records and export them as PDF or Excel files natively in the browser.

---

## ☁️ Deployment Instructions

### Deploying the Backend (Render/Railway)
1. Push your code to GitHub.
2. Create a new Web Service on Render/Railway pointing to the `backend` folder.
3. Add the Environment Variables (`DATABASE_URL`, `JWT_SECRET`, `PORT`).
4. Set the Build Command to `npm install && npx prisma generate && npx tsc`.
5. Set the Start Command to `node dist/server.js`.

### Deploying the Frontend (Vercel)
1. Import your GitHub repository to Vercel.
2. Set the Root Directory to `frontend`.
3. Add the Environment Variable `NEXT_PUBLIC_API_URL` pointing to your deployed backend URL (e.g., `https://your-backend.onrender.com/api`).
4. Deploy!

---

## 🖥️ Desktop Application (Electron)

You can run and build the application as a standalone desktop software wrapper using Electron.

### 1. Run in Development Mode
To run the Electron wrapper alongside your local development servers:
1. Ensure both your frontend (`npm run dev` in `frontend` folder) and backend (`npm run dev` in `backend` folder) are running in their respective terminals.
2. Open a new terminal in the root directory and run:
   ```bash
   npm run electron:dev
   ```

### 2. Package for Production (Standalone Executable)
To compile and package both the backend and frontend into a standalone desktop application:
1. Ensure that the database connection string and other environment variables are configured in `backend/.env`.
2. Run the following command in the root directory:
   ```bash
   npm run electron:build
   ```
3. This will compile all files and generate the packaged desktop application folder inside the `dist-desktop/Construction ERP-win32-x64` directory.

---

*Built by Antigravity*

