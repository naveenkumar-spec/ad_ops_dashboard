# Internal Server Deployment Guide - Complete Beginner's Guide

## 🎯 Overview

This guide will help you move your dashboard from Vercel (frontend) + Render (backend) to your own internal server.

**Current Setup:**
```
Frontend: Vercel (React app) → https://your-app.vercel.app
Backend: Render (Node.js API) → https://your-api.onrender.com
```

**Target Setup:**
```
Frontend + Backend: Internal Server → http://192.168.1.100 (or company domain)
```

---

## 📋 What You'll Need

### Hardware Requirements

**Minimum Server Specs:**
- CPU: 4 cores
- RAM: 8 GB
- Storage: 50 GB SSD
- OS: Ubuntu 22.04 LTS (recommended) or Windows Server

**Network Requirements:**
- Static IP address (internal network)
- Port 80 (HTTP) and 443 (HTTPS) open
- Access to company network

### Software You'll Install

1. **Node.js** - Runs your backend
2. **Nginx** - Serves your frontend and routes traffic
3. **PM2** - Keeps backend running 24/7
4. **Certbot** (optional) - For HTTPS/SSL

---

## 🏗️ Architecture Overview

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    INTERNAL SERVER                           │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Nginx (Web Server)                                 │    │
│  │  Port 80/443                                        │    │
│  └────────────────────────────────────────────────────┘    │
│         │                                                    │
│         ├─→ Static Files (React Frontend)                   │
│         │   /var/www/dashboard/                             │
│         │   - index.html                                    │
│         │   - JavaScript bundles                            │
│         │   - CSS files                                     │
│         │                                                    │
│         └─→ API Proxy (Backend)                             │
│             http://localhost:5000                           │
│             ┌──────────────────────────────────────┐        │
│             │  Node.js Backend (PM2)               │        │
│             │  - Express server                    │        │
│             │  - BigQuery connection               │        │
│             │  - Semantic cache                    │        │
│             └──────────────────────────────────────┘        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         │
         ↓
    Users access: http://192.168.1.100
    or: http://dashboard.company.local
```

### What Nginx Does

**Nginx is like a traffic cop:**

1. **Serves Frontend Files**
   - User visits: `http://192.168.1.100/`
   - Nginx serves: `index.html` from `/var/www/dashboard/`

2. **Routes API Calls**
   - Frontend calls: `http://192.168.1.100/api/overview/kpis`
   - Nginx forwards to: `http://localhost:5000/api/overview/kpis`
   - Backend responds
   - Nginx sends response back to frontend

3. **Handles HTTPS** (optional)
   - Encrypts traffic with SSL certificate
   - Redirects HTTP → HTTPS

---

## 🚀 Step-by-Step Deployment

### Phase 1: Prepare Your Server

#### Step 1.1: Install Ubuntu (if not already installed)

**Option A: Physical Server**
1. Download Ubuntu 22.04 LTS: https://ubuntu.com/download/server
2. Create bootable USB with Rufus (Windows) or Etcher (Mac)
3. Boot from USB and follow installation wizard
4. Set username/password
5. Note the IP address shown after installation

**Option B: Virtual Machine (VMware/VirtualBox)**
1. Create new VM with 4 CPU, 8 GB RAM, 50 GB disk
2. Mount Ubuntu ISO
3. Install Ubuntu
4. Configure network (bridged mode for network access)

**Option C: Cloud VM (if not truly internal)**
- AWS EC2: t3.large (2 vCPU, 8 GB RAM)
- Google Cloud: e2-standard-2
- DigitalOcean: $24/month droplet

#### Step 1.2: Connect to Server

**From Windows:**
```bash
# Install PuTTY or use Windows Terminal
ssh username@192.168.1.100
# Enter password when prompted
```

**From Mac/Linux:**
```bash
ssh username@192.168.1.100
# Enter password when prompted
```

#### Step 1.3: Update System

```bash
# Update package list
sudo apt update

# Upgrade installed packages
sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget git build-essential
```

---

### Phase 2: Install Required Software

#### Step 2.1: Install Node.js

```bash
# Install Node.js 18 (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x
```

#### Step 2.2: Install Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx

# Test: Open browser and visit http://192.168.1.100
# You should see "Welcome to nginx!" page
```

#### Step 2.3: Install PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version
```

---

### Phase 3: Deploy Backend

#### Step 3.1: Clone Repository

```bash
# Create directory for your app
sudo mkdir -p /var/www/dashboard
sudo chown -R $USER:$USER /var/www/dashboard

# Clone your repository
cd /var/www/dashboard
git clone https://github.com/your-username/adops-dashboard.git
cd adops-dashboard
```

#### Step 3.2: Setup Backend

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Create production .env file
nano .env
```

**Copy this into .env:**
```bash
# Connection
NODE_ENV=production
PORT=5000
DATA_SOURCE=bigquery

# Google Cloud / BigQuery
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./secrets/google-sa.json
GCP_PROJECT_ID=tactile-petal-820
BIGQUERY_DATASET_ID=adops_dashboard
BIGQUERY_TABLE_ID=campaign_tracker_consolidated
BIGQUERY_TRANSITION_TABLE_ID=overview_transition_metrics
BIGQUERY_LOCATION=US

# BigQuery Sync Settings
BIGQUERY_SYNC_ENABLED=true
BIGQUERY_SYNC_CRON=0 * * * *
BIGQUERY_SYNC_FULL_REFRESH=false
BIGQUERY_SKIP_IF_UNCHANGED=true
BIGQUERY_SYNC_STATE_TABLE_ID=campaign_tracker_sync_state
BIGQUERY_READ_CACHE_MS=120000
BIGQUERY_USER_CACHE_MS=3600000

# Semantic Cache
USE_SEMANTIC_CACHE=true
SEMANTIC_CACHE_TTL=300000
SEMANTIC_CACHE_AUTO_REFRESH=true
SEMANTIC_CACHE_REFRESH_INTERVAL=3600000

# Email Alerts
ALERT_EMAIL_ENABLED=false

# Groq AI
GROQ_API_KEY=your-groq-api-key

# Auth
JWT_SECRET=your-strong-random-secret-here
JWT_EXPIRES_IN=8h
ADMIN_DEFAULT_PASSWORD=Admin@123
ADMIN_LOGIN_EMAIL=admin@silverpush.local

# Frontend URL (for CORS)
FRONTEND_URL=http://192.168.1.100
```

**Save and exit:** Press `Ctrl+X`, then `Y`, then `Enter`

#### Step 3.3: Copy Google Service Account

```bash
# Create secrets directory
mkdir -p secrets

# Copy your google-sa.json file
# Option A: Use SCP from your local machine
# From your local machine (not server):
scp /path/to/google-sa.json username@192.168.1.100:/var/www/dashboard/adops-dashboard/backend/secrets/

# Option B: Create file manually
nano secrets/google-sa.json
# Paste the JSON content, save and exit
```

#### Step 3.4: Start Backend with PM2

```bash
# Start backend
pm2 start server.js --name adops-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Copy and run the command it shows

# Check status
pm2 status
pm2 logs adops-backend

# Useful PM2 commands:
# pm2 restart adops-backend  # Restart backend
# pm2 stop adops-backend     # Stop backend
# pm2 logs adops-backend     # View logs
# pm2 monit                  # Monitor resources
```

---

### Phase 4: Deploy Frontend

#### Step 4.1: Build React App

```bash
# Navigate to frontend
cd /var/www/dashboard/adops-dashboard/frontend

# Install dependencies
npm install

# Create production .env file
nano .env.production
```

**Copy this into .env.production:**
```bash
# API URL - point to your internal server
REACT_APP_API_URL=http://192.168.1.100/api

# Or if using domain:
# REACT_APP_API_URL=http://dashboard.company.local/api
```

**Save and exit:** Press `Ctrl+X`, then `Y`, then `Enter`

#### Step 4.2: Build for Production

```bash
# Build React app
npm run build

# This creates a 'build' folder with optimized files
# Takes 2-5 minutes
```

#### Step 4.3: Copy Build to Nginx Directory

```bash
# Create directory for frontend
sudo mkdir -p /var/www/dashboard/frontend

# Copy build files
sudo cp -r build/* /var/www/dashboard/frontend/

# Set permissions
sudo chown -R www-data:www-data /var/www/dashboard/frontend
```

---

### Phase 5: Configure Nginx

#### Step 5.1: Create Nginx Configuration

```bash
# Create new site configuration
sudo nano /etc/nginx/sites-available/dashboard
```

**Copy this configuration:**
```nginx
server {
    listen 80;
    server_name 192.168.1.100;  # Replace with your server IP or domain
    
    # Frontend - Serve React app
    location / {
        root /var/www/dashboard/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Backend API - Proxy to Node.js
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeout for long-running queries
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:5000/health;
    }
}
```

**Save and exit:** Press `Ctrl+X`, then `Y`, then `Enter`

#### Step 5.2: Enable Site

```bash
# Create symbolic link to enable site
sudo ln -s /etc/nginx/sites-available/dashboard /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

---

### Phase 6: Test Deployment

#### Step 6.1: Test Backend

```bash
# Test backend directly
curl http://localhost:5000/health

# Should return JSON with status
```

#### Step 6.2: Test Frontend

```bash
# From your local machine, open browser:
http://192.168.1.100

# You should see your dashboard!
```

#### Step 6.3: Test API Connection

```bash
# Check browser console (F12)
# Should see API calls to http://192.168.1.100/api/...
# No CORS errors
```

---

## 🔒 Optional: Setup HTTPS (SSL)

### If You Have a Domain Name

#### Step 1: Install Certbot

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx
```

#### Step 2: Get SSL Certificate

```bash
# Replace with your domain
sudo certbot --nginx -d dashboard.company.com

# Follow prompts:
# - Enter email
# - Agree to terms
# - Choose redirect HTTP to HTTPS (recommended)
```

#### Step 3: Auto-Renewal

```bash
# Test auto-renewal
sudo certbot renew --dry-run

# Certbot automatically sets up cron job for renewal
```

### If Using Internal IP Only

**Option A: Self-Signed Certificate** (browsers will show warning)
```bash
# Generate self-signed certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/dashboard.key \
  -out /etc/ssl/certs/dashboard.crt

# Update Nginx config to use SSL
sudo nano /etc/nginx/sites-available/dashboard
```

**Option B: Use HTTP Only** (simpler, but not encrypted)
- Keep current configuration
- Only accessible on internal network anyway

---

## 🔄 Updating Your Application

### Update Backend

```bash
# SSH to server
ssh username@192.168.1.100

# Navigate to backend
cd /var/www/dashboard/adops-dashboard/backend

# Pull latest code
git pull origin main

# Install new dependencies (if any)
npm install

# Restart backend
pm2 restart adops-backend

# Check logs
pm2 logs adops-backend
```

### Update Frontend

```bash
# Navigate to frontend
cd /var/www/dashboard/adops-dashboard/frontend

# Pull latest code
git pull origin main

# Install new dependencies (if any)
npm install

# Rebuild
npm run build

# Copy new build
sudo cp -r build/* /var/www/dashboard/frontend/

# Clear browser cache or hard refresh (Ctrl+Shift+R)
```

---

## 🛠️ Troubleshooting

### Issue 1: Can't Access Dashboard

**Check Nginx:**
```bash
sudo systemctl status nginx
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

**Check Firewall:**
```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

### Issue 2: API Calls Failing

**Check Backend:**
```bash
pm2 status
pm2 logs adops-backend
curl http://localhost:5000/health
```

**Check Nginx Proxy:**
```bash
sudo tail -f /var/log/nginx/error.log
```

### Issue 3: Blank Page

**Check Build:**
```bash
ls -la /var/www/dashboard/frontend/
# Should see index.html, static/, etc.
```

**Check Browser Console:**
- Open browser DevTools (F12)
- Look for errors in Console tab
- Check Network tab for failed requests

### Issue 4: Hourly Sync Not Running

**Check PM2:**
```bash
pm2 logs adops-backend | grep "BigQuery Scheduler"
```

**Check Cron:**
```bash
# Cron runs inside Node.js process
# Check logs for sync messages
pm2 logs adops-backend --lines 100
```

---

## 📊 Monitoring

### Check Server Resources

```bash
# CPU and Memory
htop

# Disk space
df -h

# Network
sudo netstat -tulpn | grep LISTEN
```

### Check Application Health

```bash
# Backend status
pm2 status
pm2 monit

# Nginx status
sudo systemctl status nginx

# View logs
pm2 logs adops-backend
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Setup Monitoring (Optional)

**Install Netdata (Real-time monitoring):**
```bash
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# Access at: http://192.168.1.100:19999
```

---

## 🔐 Security Best Practices

### 1. Firewall

```bash
# Enable firewall
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

### 2. Secure SSH

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Change these settings:
PermitRootLogin no
PasswordAuthentication no  # After setting up SSH keys
Port 2222  # Change default port

# Restart SSH
sudo systemctl restart sshd
```

### 3. Regular Updates

```bash
# Update system weekly
sudo apt update && sudo apt upgrade -y

# Update Node.js packages monthly
cd /var/www/dashboard/adops-dashboard/backend
npm update
pm2 restart adops-backend
```

### 4. Backup

```bash
# Backup script
sudo nano /usr/local/bin/backup-dashboard.sh
```

**Backup script content:**
```bash
#!/bin/bash
BACKUP_DIR="/backup/dashboard"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup application
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /var/www/dashboard/adops-dashboard

# Backup database (if any)
# pg_dump or mysqldump commands here

# Keep only last 7 days
find $BACKUP_DIR -name "app_*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

**Make executable and schedule:**
```bash
sudo chmod +x /usr/local/bin/backup-dashboard.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add line:
0 2 * * * /usr/local/bin/backup-dashboard.sh
```

---

## 📝 Quick Reference Commands

### Backend Management
```bash
pm2 start server.js --name adops-backend  # Start
pm2 restart adops-backend                 # Restart
pm2 stop adops-backend                    # Stop
pm2 logs adops-backend                    # View logs
pm2 monit                                 # Monitor
```

### Nginx Management
```bash
sudo systemctl start nginx      # Start
sudo systemctl stop nginx       # Stop
sudo systemctl restart nginx    # Restart
sudo systemctl reload nginx     # Reload config
sudo nginx -t                   # Test config
```

### View Logs
```bash
pm2 logs adops-backend                    # Backend logs
sudo tail -f /var/log/nginx/access.log    # Nginx access
sudo tail -f /var/log/nginx/error.log     # Nginx errors
```

---

## 🎯 Summary

**What You've Deployed:**
- ✅ React frontend served by Nginx
- ✅ Node.js backend running with PM2
- ✅ Nginx proxying API calls to backend
- ✅ Hourly BigQuery sync working
- ✅ Semantic cache enabled
- ✅ Everything on one internal server

**Access Your Dashboard:**
- URL: `http://192.168.1.100` (or your server IP)
- Or: `http://dashboard.company.local` (if DNS configured)

**Next Steps:**
1. Test all dashboard features
2. Setup HTTPS (optional)
3. Configure monitoring
4. Setup automated backups
5. Train team on updates

You're now running your own internal dashboard server! 🎉
