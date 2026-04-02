# AI Features - Quick Start (3 Minutes)

## What You Get (100% FREE)
✅ **Interactive Chatbot** - Ask questions about your data in plain English  
✅ **Super Fast** - Groq is 10x faster than other free APIs  
✅ **Admin Control** - Enable/disable per user  
✅ **No Credit Card** - Completely free with Groq  

---

## Setup (3 Steps)

### 1. Get Free API Key (1 minute)
1. Go to: https://console.groq.com/
2. Sign up with Google/GitHub (no credit card!)
3. Go to: https://console.groq.com/keys
4. Click "Create API Key" → Name it "Dashboard" → Submit
5. Copy the key (starts with `gsk_...`)

### 2. Add to Render (1 minute)
1. Go to: https://dashboard.render.com/
2. Click your backend service
3. Go to "Environment" tab
4. Click "Add Environment Variable"
5. Add:
   - **Key:** `GROQ_API_KEY`
   - **Value:** `gsk_xxxxxxxxxxxxx` (paste your key)
6. Click "Save Changes"

### 3. Wait for Deploy (1 minute)
Render will auto-redeploy (takes 2-3 minutes). Done! 🎉

---

## How to Use

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

### Admin Control
- Go to Admin Setup page
- Edit any user
- Check/uncheck "Enable AI Chatbot"
- Save changes
- User will see/not see the 🤖 button

---

## Important Notes

⚡ **Super Fast** - Responses in under 1 second!  
📊 **Chatbot knows your current filters**  
🆓 **Completely free** - 30 requests/minute (more than enough!)  
🔒 **Secure** - API key stored in Render environment  

---

## Troubleshooting

**"Failed to process query"**
→ Check API key is correct in Render environment variables

**"Rate limit exceeded"**
→ Wait 1 minute (only if 30+ requests in same minute)

**Chatbot button not showing**
→ Admin needs to enable it for your user in Admin Setup

---

## What's Next?

After testing, you can:
- Monitor usage at https://console.groq.com/
- Upgrade to paid tier if you need more than 30 req/min
- Customize chatbot prompts in `backend/services/aiService.js`
- Add more data sources to chatbot context

See `GROQ_SETUP.md` for detailed limits and `AI_SETUP_GUIDE.md` for full documentation.

---

## Cost Comparison

| Service | Cost | Speed | Quality | Free Tier |
|---------|------|-------|---------|-----------|
| **Groq (Current)** | $0 | ⚡⚡⚡ | ⭐⭐⭐⭐ | 30 req/min |
| OpenAI GPT-3.5 | $10-30/mo | ⚡⚡ | ⭐⭐⭐⭐ | None |
| OpenAI GPT-4 | $50-150/mo | ⚡ | ⭐⭐⭐⭐⭐ | None |
| Anthropic Claude | $30-100/mo | ⚡⚡ | ⭐⭐⭐⭐⭐ | None |

**Recommendation:** Groq is perfect for small-medium teams (free forever!). Only upgrade if you need 30+ requests per minute.

---

## Need Help?

1. Check `GROQ_SETUP.md` for detailed free tier info
2. Check `AI_SETUP_GUIDE.md` for full documentation
3. Check Render logs for errors
4. Verify API key at https://console.groq.com/keys
5. Ask me! 😊
