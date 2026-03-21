# ⚡ QUICK START: FUNCTIONALITY CHECK

## 🚀 STEP 1: Start the backend
```bash
cd backend
npm start
```

You should see:
```
✅ Backend on SQLite started successfully!
🌐 Server running on: http://localhost:5001
✅ SQLite database connected
```

## 📱 STEP 2: Open the app
- Start the React Native app, OR
- Open `virtum.html` in your browser

## ✏️ STEP 3: Test 1 — Manual data entry

1. **On the Dashboard, click:** "✏️ Enter My Data"
2. **Fill in the fields** (examples):
   - 🚶 Steps: `8000`
   - ❤️ Heart rate: `80`
   - 💧 Water: `2.0`
   - 🩺 Blood pressure: `120/80`
   - ⚖️ Weight: `75`
   - 🍎 Calories: `2200`

3. **Click:** "💾 Save Data"
4. **Expected:** You should see "✅ Success"
5. **Verify:** Data appears on the charts

## 💧 STEP 4: Test 2 — Add water

1. **Click:** "💧 Add water (+250ml)" a few times
2. **Expected:** The water counter increases
3. **Verify:** After refresh, the value is still saved

## 🎲 STEP 5: Test 3 — Simulated data

1. **Click:** "🎲 Generate & Save"
2. **Expected:** You should see "✅ Success"
3. **Verify:** New random data appears on the charts

## 🔄 STEP 6: Auto-refresh check

1. **Look at the time:** "Updated: HH:MM:SS"
2. **Wait 10 seconds**
3. **Verify:** The time updates
4. **Result:** Data auto-refreshed! ✅

## 🔍 STEP 7: Database persistence check

1. **Close the app completely**
2. **Open it again**
3. **Go to the Dashboard**
4. **Verify:** All data is still there! ✅

---

## ✅ TEST RESULTS

| Test | Result | Status |
|------|-----------|--------|
| Manual data entry | Data is saved to the DB | ✅ |
| Adding water | Water is saved to the DB | ✅ |
| Random data generation | Data is saved | ✅ |
| Auto refresh | Refresh every 10 sec | ✅ |
| Persistence after restart | Data is restored | ✅ |

---

## 🐛 IF SOMETHING DOESN’T WORK

### Backend won’t start
```
❌ ERROR: Port 5001 is already in use
```
**Fix:**
```bash
# Find the process using port 5001
netstat -ano | findstr ":5001"

# Kill the process (replace PID)
taskkill /PID <PID> /F

# Or change the port in server.js
# const PORT = 5002; (instead of 5001)
```

### Error: "Backend not running or network?"
1. Make sure the backend is running
2. Check that API_URL in Dashboard.js is correct
3. If using a phone, replace localhost with the PC’s IP address

### Data isn’t saving
1. Check backend console for errors
2. Make sure the `backend/` folder is writable
3. Verify the `virtum.db` file exists

### The modal window doesn’t open
1. Check the app console for errors
2. Make sure imports are correct (Modal from react-native)

---

## 📊 ARCHITECTURE

```
┌─────────────────────────────────────────┐
│      Frontend (React Native/Web)        │
│  Dashboard.js + Modal window            │
├─────────────────────────────────────────┤
│                                         │
│  useEffect → setInterval → loadData()   │
│  Refreshes data every 10 sec ⏱️         │
│                                         │
└──────────────┬──────────────────────────┘
               │
        ┌──────▼────────┐
        │  Axios API    │
        │  Requests     │
        └──────┬────────┘
               │
        ┌──────▼──────────────────────┐
        │  Backend Express.js          │
        │  /api/data/custom            │
        │  /api/data/water             │
        │  /api/data/history           │
        └──────┬──────────────────────┘
               │
        ┌──────▼──────────────────────┐
        │   SQLite Database            │
        │   virtum.db                  │
        │   (real data)               │
        └─────────────────────────────┘
```

---

## 📝 LOGGING

Backend logs to the console:
```
📊 Data auto-refreshed (every 10 sec)
INSERT INTO biomarkers ...           (save)
SELECT data FROM biomarkers ...      (load)
```

Frontend logs:
```
console.log('📊 Data auto-refreshed')
```

Check the console for debugging! 🔍

---

## 🎉 ALL SET!

Your app is now fully functional for saving and displaying data.

**Start testing and enjoy dynamic data!** 🚀
