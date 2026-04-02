# AI Features - Quick Start (5 Minutes)

## What You Get (100% FREE)
✅ **Automated Insights** - AI analyzes your data and shows key findings  
✅ **Interactive Chatbot** - Ask questions about your data in plain English  
✅ **No Credit Card** - Completely free with Hugging Face  

---

## Setup (3 Steps)

### 1. Get Free API Key (2 minutes)
1. Go to: https://huggingface.co/join
2. Create free account
3. Go to: https://huggingface.co/settings/tokens
4. Click "New token" → Name it "Dashboard" → Select "Read" → Generate
5. Copy the token (starts with `hf_...`)

### 2. Add to Your Backend (1 minute)
1. Open `backend/.env` file
2. Find this line:
   ```
   HUGGINGFACE_API_KEY=your-huggingface-api-key-here
   ```
3. Replace with your token:
   ```
   HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxx
   ```
4. Save the file

### 3. Deploy (2 minutes)
```bash
git add backend/.env
git commit -m "Add Hugging Face API key"
git push origin main
```

Wait 3-5 minutes for Render to redeploy. Done! 🎉

---

## How to Use

### Insights Panel
- Located at top of Overview page
- Automatically analyzes your data
- Shows 5 key insights
- Click 🔄 to refresh
- Updates when you change filters

### Chatbot
- Click 🤖 button (bottom-right corner)
- Type your question or click a suggestion
- Get instant answers about your data

**Try These Questions:**
- "What's our total revenue?"
- "Which campaigns have best margins?"
- "Show top performing products"
- "What's the average CPM?"
- "Compare this month vs last month"

---

## Important Notes

⏱️ **First request takes 10-20 seconds** (model loading)  
⚡ **After that, responses are 2-5 seconds**  
📊 **Chatbot knows your current filters**  
🔄 **Insights update when filters change**  
🆓 **Completely free, no limits for testing**  

---

## Troubleshooting

**"Failed to generate insights"**
→ Check API key is correct in backend/.env

**"Model is loading"**
→ Wait 10-20 seconds, it will retry automatically

**Slow responses**
→ Normal for free tier, consider OpenAI for faster responses

---

## What's Next?

After testing, you can:
- Switch to OpenAI for faster/better responses ($10-30/month)
- Customize the insights prompts
- Add more chatbot features
- Export insights as reports
- Set up automated insight emails

See `AI_SETUP_GUIDE.md` for full documentation.

---

## Cost Comparison

| Service | Cost | Speed | Quality |
|---------|------|-------|---------|
| **Hugging Face (Free)** | $0 | 2-10s | Good ⭐⭐⭐ |
| Hugging Face Pro | $9/mo | 1-3s | Good ⭐⭐⭐ |
| OpenAI GPT-3.5 | $10-30/mo | 1-2s | Excellent ⭐⭐⭐⭐ |
| OpenAI GPT-4 | $50-150/mo | 2-4s | Best ⭐⭐⭐⭐⭐ |

**Recommendation:** Start with free Hugging Face, upgrade if needed.

---

## Need Help?

1. Check `AI_SETUP_GUIDE.md` for detailed docs
2. Check Render logs for errors
3. Verify API key at https://huggingface.co/settings/tokens
4. Ask me! 😊
