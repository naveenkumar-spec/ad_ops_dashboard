# Quick Start: Deploy to Internal Server in 30 Minutes

## 🎯 Super Simple Version (Copy-Paste Commands)

This is the fastest way to get your dashboard running on an internal server. Just copy and paste these commands!

---

## ✅ Prerequisites

- Ubuntu server (physical or VM)
- Server IP: `192.168.1.100` (replace with yours)
- SSH access: `ssh username@192.168.1.100`

---

## 🚀 30-Minute Deployment

### Step 1: Connect to Server (1 minute)

```bash
# From your laptop
ssh username@192.168.1.100
# Enter password
```

### Step 2: Install Everything (5 minutes)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs nginx git

# Install PM2
sudo npm install -g pm2

# Verify
node --version  # Should show v18.x.x
nginx -v        # Should show nginx version
pm2 --version   # Should show PM2 version
```

### Step 3: Clone Your Code (2 minutes)

```bash
# Create directory
sudo mkdir -p /var/www/dashboard
sudo chown -R $USER:$USER /var/www/dashboard

# Clone repository
cd /var/www/dashboard
git clone https://github.com/naveenkumar-spec/ad_ops_dashboard.git
cd ad_ops_dashboard
```

### Step 4: Setup Backend (5 minutes)

```bash
# Go to backend
cd backend

# Install dependencies
npm install

# Create .env file
cat > .env << 'EOF'
NODE_ENV=production
PORT=5000
DATA_SOURCE=bigquery
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./secrets/google-sa.json
GCP_PROJECT_ID=tactile-petal-820
BIGQUERY_DATASET_ID=adops_dashboard
BIGQUERY_TABLE_ID=campaign_tracker_consolidated
BIGQUERY_TRANSITION_TABLE_ID=overview_transition_metrics
BIGQUERY_LOCATION=US
BIGQUERY_SYNC_ENABLED=true
BIGQUERY_SYNC_CRON=0 * * * *
BIGQUERY_SYNC_FULL_REFRESH=false
BIGQUERY_SKIP_IF_UNCHANGED=true
BIGQUERY_SYNC_STATE_TABLE_ID=campaign_tracker_sync_state
BIGQUERY_READ_CACHE_MS=120000
BIGQUERY_USER_CACHE_MS=3600000
USE_SEMANTIC_CACHE=true
SEMANTIC_CACHE_TTL=300000
SEMANTIC_CACHE_AUTO_REFRESH=true
SEMANTIC_CACHE_REFRESH_INTERVAL=3600000
ALERT_EMAIL_ENABLED=false
GROQ_API_KEY=your-groq-api-key-here
JWT_SECRET=your-strong-random-secret-change-this
JWT_EXPIRES_IN=8h
ADMIN_DEFAULT_PASSWORD=Admin@123
ADMIN_LOGIN_EMAIL=admin@silverpush.local
FRONTEND_URL=http://192.168.1.100
EOF

# Copy Google service account file
# (You need to upload this file first - see below)
mkdir -p secrets
# Upload google-sa.json to secrets/ folder

# Start backend
pm2 start server.js --name adops-backend
pm2 save
pm2 startup  # Copy and run the command it shows
```

### Step 5: Build Frontend (10 minutes)

```bash
# Go to frontend
cd ../frontend

# Install dependencies
npm install

# Create .env.production
cat > .env.production << 'EOF'
REACT_APP_API_URL=http://192.168.1.100/api
EOF

# Build (takes 5-10 minutes)
npm run build

# Copy to web directory
sudo mkdir -p /var/www/dashboard/frontend
sudo cp -r build/* /var/www/dashboard/frontend/
sudo chown -R www-data:www-data /var/www/dashboard/frontend
```

### Step 6: Configure Nginx (5 minutes)

```bash
# Create Nginx config
sudo tee /etc/nginx/sites-available/dashboard > /dev/null << 'EOF'
server {
    listen 80;
    server_name 192.168.1.100;
    
    location / {
        root /var/www/dashboard/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }
    
    location /health {
        proxy_pass http://localhost:5000/health;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/dashboard /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### Step 7: Test (2 minutes)

```bash
# Test backend
curl http://localhost:5000/health

# Test frontend
curl http://localhost/

# Open browser and visit:
# http://192.168.1.100
```

---

## 📤 How to Upload google-sa.json

### Option 1: Using SCP (From Your Laptop)

```bash
# From your laptop (not server)
scp /path/to/google-sa.json username@192.168.1.100:/var/www/dashboard/ad_ops_dashboard/backend/secrets/
```

### Option 2: Copy-Paste (If Small File)

```bash
# On server
nano /var/www/dashboard/ad_ops_dashboard/backend/secrets/google-sa.json
# Paste the JSON content
# Press Ctrl+X, then Y, then Enter
```

### Option 3: Using FileZilla (GUI)

1. Download FileZilla: https://filezilla-project.org/
2. Connect to: `sftp://192.168.1.100`
3. Navigate to: `/var/www/dashboard/ad_ops_dashboard/backend/secrets/`
4. Drag and drop `google-sa.json`

---

## 🔧 Common Issues & Fixes

### Issue: "Permission denied"

```bash
# Fix permissions
sudo chown -R $USER:$USER /var/www/dashboard
```

### Issue: "Port 5000 already in use"

```bash
# Kill process on port 5000
sudo lsof -ti:5000 | xargs kill -9

# Restart backend
pm2 restart adops-backend
```

### Issue: "Cannot connect to backend"

```bash
# Check backend status
pm2 status
pm2 logs adops-backend

# Restart if needed
pm2 restart adops-backend
```

### Issue: "Nginx 502 Bad Gateway"

```bash
# Check backend is running
pm2 status

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Restart both
pm2 restart adops-backend
sudo systemctl restart nginx
```

### Issue: "Blank page in browser"

```bash
# Check if files exist
ls -la /var/www/dashboard/frontend/

# Rebuild frontend
cd /var/www/dashboard/ad_ops_dashboard/frontend
npm run build
sudo cp -r build/* /var/www/dashboard/frontend/
```

---

## 🔄 How to Update

### Update Backend

```bash
cd /var/www/dashboard/ad_ops_dashboard/backend
git pull
npm install
pm2 restart adops-backend
```

### Update Frontend

```bash
cd /var/www/dashboard/ad_ops_dashboard/frontend
git pull
npm install
npm run build
sudo cp -r build/* /var/www/dashboard/frontend/
```

---

## 📊 Useful Commands

### Check Status

```bash
# Backend status
pm2 status
pm2 logs adops-backend

# Nginx status
sudo systemctl status nginx

# Server resources
htop  # Press q to quit
```

### View Logs

```bash
# Backend logs
pm2 logs adops-backend

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Restart Services

```bash
# Restart backend
pm2 restart adops-backend

# Restart Nginx
sudo systemctl restart nginx

# Restart both
pm2 restart adops-backend && sudo systemctl restart nginx
```

---

## 🎯 What You Just Did

1. ✅ Installed Node.js, Nginx, PM2
2. ✅ Cloned your code
3. ✅ Built React frontend
4. ✅ Started Node.js backend with PM2
5. ✅ Configured Nginx to serve frontend and proxy API
6. ✅ Dashboard is now running at `http://192.168.1.100`

---

## 🚀 Next Steps

### Immediate
- [ ] Test all dashboard features
- [ ] Verify hourly sync is working
- [ ] Check semantic cache is loading

### This Week
- [ ] Setup HTTPS (optional)
- [ ] Configure firewall
- [ ] Setup monitoring
- [ ] Create backup script

### This Month
- [ ] Train team on new URL
- [ ] Document update procedures
- [ ] Setup automated backups
- [ ] Monitor performance

---

## 📞 Need Help?

### Check Logs First

```bash
# Backend logs (most common issues)
pm2 logs adops-backend --lines 100

# Nginx logs
sudo tail -100 /var/log/nginx/error.log
```

### Common Log Messages

**"EADDRINUSE: Port 5000 already in use"**
```bash
sudo lsof -ti:5000 | xargs kill -9
pm2 restart adops-backend
```

**"Cannot find module"**
```bash
cd /var/www/dashboard/ad_ops_dashboard/backend
npm install
pm2 restart adops-backend
```

**"Permission denied"**
```bash
sudo chown -R $USER:$USER /var/www/dashboard
```

---

## 🎉 Success!

Your dashboard is now running on your internal server!

**Access it at:** `http://192.168.1.100`

**What's working:**
- ✅ React frontend (instant loading)
- ✅ Node.js backend (API calls)
- ✅ BigQuery connection (data queries)
- ✅ Semantic cache (fast responses)
- ✅ Hourly sync (automatic updates)
- ✅ User authentication (login system)

**You're done!** 🎊

For detailed explanations, see `INTERNAL_SERVER_DEPLOYMENT_GUIDE.md`
