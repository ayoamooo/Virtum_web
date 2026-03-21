# Virtum — technical notes (supplementary)

> **Primary documentation:** see the repository root [`README.md`](../README.md) for installation, production checklist, and current architecture.

---

## What Changed (historical)

✅ **User can now enter real health metrics** (not just simulated data)
✅ **All data is saved to SQLite database** (virtum.db)
✅ **Data automatically updates every 10 seconds**
✅ **Water intake is now saved** (doesn't disappear when closing app)
✅ **Beautiful modal window for easy data input**

---

## Quick Start

### 1. Start Backend
```bash
cd backend
npm start
```

You should see: `✅ Backend on SQLite started successfully!`

### 2. Open App
- Open React Native app OR
- Open `http://localhost:5001/virtum.html` in browser

### 3. Enter Data
- Click **"✏️ Enter My Data"** on Dashboard
- Fill in your metrics (steps, heart rate, water, etc.)
- Click **"💾 Save Data"**
- ✅ Data is saved and shows on graphs!

---

## New Features

### New API Endpoints

**POST `/api/data/custom`** - Save user health metrics
```json
{
  "steps": 8000,
  "heartRate": 75,
  "waterIntake": 2.5,
  "bloodPressure": "120/80",
  "weight": 75.5,
  "calorieIntake": 2200
}
```

**POST `/api/data/water`** - Quick water intake save
```json
{ "waterIntake": 2.5 }
```

### Dashboard Improvements
- Modal window for data input (6 fields)
- Auto-refresh every 10 seconds
- Water saved to database
- Last update time displayed
- 6 action buttons (was 5)

---

## Technical Details

### Backend Changes (server.js)
- Added 2 new API endpoints
- Added data validation
- Added anomaly detection
- All code is now in English

### Frontend Changes (Dashboard.js)  
- Added Modal component for input
- Added useEffect with setInterval for auto-refresh
- Added saveCustomData() function
- Added saveWaterToDB() function
- All code is now in English
- Updated styles for new UI elements

---

## Database

All data is stored in **virtum.db** (SQLite database in backend folder)

**Biomarkers table fields:**
- id (auto-increment)
- userId (default: 'testUser')
- data (JSON string with all metrics)
- timestamp (when record was created)
- flagged (1 if anomaly detected)

---

## Testing

### Test 1: Manual Data Entry
1. Click "✏️ Enter My Data"
2. Fill form (steps=8000, heart rate=75, water=2.0, etc.)
3. Click "💾 Save Data"
4. ✅ Should see "Success" alert
5. Data appears on graphs

### Test 2: Auto-Update
1. Check "Updated: HH:MM:SS" in header
2. Wait 10 seconds
3. Check time changed → ✅ Auto-update works!

### Test 3: Data Persistence
1. Enter data and save
2. Close app completely
3. Reopen app
4. ✅ Data should still be there!

---

## Troubleshooting

**Backend won't start on port 5001:**
```bash
# Find what's using port 5001
netstat -ano | findstr ":5001"

# Kill the process or change PORT in server.js
```

**"Backend not running or network unavailable?"**
- Check Backend is running: `npm start` in backend folder
- Check API_URL in Dashboard.js is correct (localhost:5001)
- For mobile: replace localhost with PC's IP address

**Data not saving?**
- Check console in Browser/Terminal for errors
- Ensure `virtum.db` file exists in backend folder
- Check write permissions on backend folder

---

## File Changes

**Modified:**
- `backend/server.js` - Added 2 endpoints, all comments in English
- `frontend/screens/Dashboard.js` - Added Modal, auto-update, all comments in English

**Status:** All code is in English

---

## API Endpoints

```
GET  /api/data/history           - Get history (last 14 records)
POST /api/data/store             - Store simulated data
POST /api/data/custom            - Store user input data (NEW)
POST /api/data/water             - Save water intake (NEW)
GET  /api/ai/recommend           - Get AI recommendations
POST /api/ai/chat                - Chat with AI
POST /api/auth/login             - Login
```

---

**Status:** ✅ Ready to use
**Version:** 1.0 with data persistence
**Language:** English only

## 🚀 Quick Start (Detailed)

**The simplest way:**

1. Open a terminal in the `backend` folder
2. Run: `npm install` (first time only)
3. Run: `node server.js`
4. Open in your browser: `http://localhost:5001/virtum.html`

**⚠️ Important:** Do NOT open `virtum.html` by double-clicking it. Open it via the browser address bar.

**Full guide:** see `HOW_TO_RUN.md`

---

## 📋 Step-by-step guide

### Step 1: Install backend dependencies

Open a terminal in the `backend` folder and run:

```bash
cd backend
npm install
```

If dependencies are already installed (the `node_modules` folder exists), you can skip this step.

### Step 2: Start the backend server

In the same `backend` folder, run:

```bash
npm start
```

Or directly:

```bash
node server.js
```

You should see something like:
```
✅ SQLite database connected
✅ Backend on SQLite started successfully!
🌐 Server running on: http://localhost:5001
```

**⚠️ Important:** Keep this terminal open. The server must keep running.

### Step 3: Open the frontend (HTML)

**Important:** The backend now also serves the HTML over HTTP.

1. Open a browser (Chrome, Edge, Firefox)
2. In the address bar, open:
   ```
   http://localhost:5001/virtum.html
   ```

**Or simply:**
```
http://localhost:5001
```

**⚠️ Do NOT open `virtum.html` by double-clicking it.**

If you open the file directly (double-click), it runs as a static `file://` page and won’t be able to connect to the backend server.

The server serves the HTML over HTTP, so everything works correctly.

### Step 4: Using the app

1. **Login / Register:**
   - Create an account or sign in with your username and password

2. **Dashboard:**
   - Click "Generate & Store New Data" to create test data
   - Click "Refresh Data from DB" to refresh data
   - Use the "+ 250ml" button to track water intake

3. **AI Chat:**
   - Open "AI Chat" via the bottom navigation
   - Ask questions about your health data

## 🔧 Troubleshooting

### Backend won’t start

**Error: "Cannot find module"**
```bash
cd backend
npm install
```

**Error: "Port 5001 already in use"**
- Close another app using port 5001
- Or change `PORT` in `backend/.env` and update `API_URL` in `assets/js/virtum.js` if needed

### Frontend can’t connect to backend

**Error: "Cannot connect to backend"**
1. Make sure the backend is running (see Step 2)
2. Check the browser console for CORS errors
3. Make sure port 5001 is free
4. Verify `API_URL` in `assets/js/virtum.js` points to the correct port (5001)

**For LAN (if you use an IP address):**
- Set `API_URL` in `assets/js/virtum.js` to your IP address, e.g.:
  ```javascript
  const API_URL = 'http://192.168.1.XXX:5001';
  ```

### Database

The SQLite database is created automatically in `backend/virtum.db` on first run.

## 📁 Project structure

```
project/
├── backend/              # Backend server (Node.js + Express + SQLite)
│   ├── app.js            # Server entrypoint
│   ├── package.json      # Dependencies
│   └── virtum.db         # Database (auto-created)
│
├── frontend/             # React Native app (optional)
│   └── ...
│
└── virtum.html          # Web version (main)
```

## 🚀 Alternative dev run

### Run with auto-reload (nodemon)

```bash
cd backend
npm install -g nodemon
nodemon app.js
```

## 📝 API endpoints

The backend provides the following APIs:

- `GET /api/data/history` - Data history
- `POST /api/data/store` - Store new data
- `GET /api/ai/recommend` - AI recommendations
- `GET /api/summary/daily` - Daily summary
- `POST /api/auth/login` - Authentication

**Note:** The server runs on port **5001** (changed from 5000 to avoid conflicts)

## 💡 Tips

- For first run, create a few records via "Generate & Store New Data"
- Use the "Large Text" button to increase font size (accessibility)
- All data is stored in the local SQLite database

## 🤖 Deepseek AI (optional)

For smarter AI responses, you can connect the Deepseek API:

1. Get an API key at https://platform.deepseek.com/
2. Set the environment variable:
   ```bash
   # Windows
   set DEEPSEEK_API_KEY=your_key
   
   # Mac/Linux
   export DEEPSEEK_API_KEY=your_key
   ```
3. Restart the server

More details: see `SETUP_DEEPSEEK.md`

## 📱 Mobile phone testing

The app is fully responsive and ready for mobile devices.

**Quick way:**
1. Find your computer’s IP address: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. Change `API_URL` in `virtum.html` (line 734) to your IP (e.g. `http://192.168.1.100:5001`)
3. Start the server: `cd backend && node server.js`
4. On your phone, open: `http://YOUR_IP:5001/virtum.html`

**Detailed guide:** see `MOBILE_TEST.md` or `MOBILE_TESTING.md`

## 🆘 Need help?

If something doesn’t work:
1. Verify Node.js is installed: `node --version`
2. Check that the backend is running and listening on port **5001**
3. Open the browser console (F12) to see errors
4. Make sure all dependencies are installed
5. Confirm `API_URL` in `virtum.html` points to `http://localhost:5001`

---

**Enjoy using Virtum! 🎉**

