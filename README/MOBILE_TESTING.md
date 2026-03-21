# 📱 Testing Virtum on a mobile phone

## 🚀 Quick start

### Option 1: Local network (recommended)

#### Step 1: Find your computer’s IP address

**Windows:**
```bash
ipconfig
```
Find "IPv4 Address" (for example, `192.168.1.100`)

**Mac/Linux:**
```bash
ifconfig
# or
ip addr show
```

#### Step 2: Start the backend server

```bash
cd backend
node server.js
```

The server should start at `http://localhost:5001`

#### Step 3: Configure network access

Make sure that:
- Your computer and phone are on the same Wi-Fi network
- Windows Firewall allows inbound connections to port 5001

**Open the port in Windows Firewall:**
1. Open "Windows Defender Firewall"
2. Advanced settings → Inbound Rules
3. New Rule → Port → TCP → 5001 → Allow the connection

#### Step 4: Change API_URL in the HTML

Open `virtum.html` and find line **734**:
```javascript
const API_URL = 'http://localhost:5001';
```

Replace it with your IP address:
```javascript
const API_URL = 'http://192.168.1.100:5001';  // Replace 192.168.1.100 with your IP
```

**Save the file!**

#### Step 5: Open it on your phone

1. On your phone, open a browser (Chrome, Safari, Firefox)
2. Enter in the address bar:
   ```
   http://192.168.1.100:5001/virtum.html
   ```
   (Replace `192.168.1.100` with your IP address)

**Important:** Keep the `:5001` port in the URL.

**Or use a file server:**

### Option 2: File server

#### Start a simple HTTP server

**Python (if installed):**
```bash
# In the project folder
python -m http.server 8000
```

**Node.js:**
```bash
npm install -g http-server
http-server -p 8000
```

#### Open it on your phone

In your phone’s browser, open:
```
http://192.168.1.100:8000/virtum.html
```

### Option 3: ngrok (external access)

1. Install ngrok: https://ngrok.com/
2. Run:
   ```bash
   ngrok http 5001
   ```
3. Use the provided URL (for example, `https://abc123.ngrok.io`)
4. Change `API_URL` in `virtum.html` to that URL

## 🔧 Deepseek API setup (optional)

### Step 1: Get an API key

1. Sign up at https://platform.deepseek.com/
2. Create an API key in the API Keys section

### Step 2: Set environment variables

**Windows (PowerShell):**
```powershell
$env:DEEPSEEK_API_KEY="your_key_here"
cd backend
node server.js
```

**Windows (CMD):**
```cmd
set DEEPSEEK_API_KEY=your_key_here
cd backend
node server.js
```

**Mac/Linux:**
```bash
export DEEPSEEK_API_KEY="your_key_here"
cd backend
node server.js
```

**Or create a `.env` file in the `backend` folder:**
```
DEEPSEEK_API_KEY=your_key_here
```

And install the package to load .env:
```bash
npm install dotenv
```

Then add this near the top of `server.js`:
```javascript
require('dotenv').config();
```

## 📱 Mobile optimization

The app is already optimized for mobile devices:

✅ Responsive design
✅ Touch-friendly buttons
✅ Optimized font sizes
✅ Mobile navigation
✅ Optimized chat

## 🧪 Feature testing

### Check on your phone:

1. **Login/Registration** — touch interactions should work
2. **Dashboard** — metrics should render correctly
3. **Chart** — should be readable on a small screen
4. **AI Chat** — keyboard should work correctly
5. **Navigation** — bottom buttons should be accessible

## ⚠️ Troubleshooting

### Can’t connect to the server

1. Make sure your computer and phone are on the same Wi-Fi network
2. Make sure the backend is running
3. Check your IP address: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
4. Check the firewall

### CORS errors

The backend is configured with `cors({ origin: '*' })`, but if you still have issues:
- Make sure you are using the correct IP address
- Make sure port 5001 is open

### Slow loading

- Use local Wi-Fi (not mobile data)
- Make sure the Wi-Fi signal is strong
- Close other apps on your phone

## 🎯 Quick sanity check

1. Open on your computer: `http://localhost:5001/api/data/history`
   - You should get JSON back

2. Open on your phone: `http://YOUR_IP:5001/api/data/history`
   - You should get the same JSON back

3. If it works, open `virtum.html` on your phone

## 💡 Tips

- Use Chrome or Safari on your phone for best compatibility
- Add the site to your Home Screen for full-screen mode
- Use landscape orientation to view charts more comfortably

---

**Done! You can now test Virtum on your phone.**

