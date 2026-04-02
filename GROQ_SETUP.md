# Groq API Setup (FREE & FAST!)

## Why Groq?
- ✅ **Completely FREE** - Generous free tier
- ✅ **Super FAST** - Fastest AI inference available (10x faster than others)
- ✅ **Good Quality** - Llama 3, Mixtral models
- ✅ **No Credit Card** - Just sign up and get API key
- ✅ **Easy Setup** - 2 minutes

## Get Your Free API Key

### Step 1: Sign Up (1 minute)
1. Go to [console.groq.com](https://console.groq.com/)
2. Click "Sign Up" or "Get Started"
3. Sign up with Google/GitHub or email
4. No credit card required!

### Step 2: Get API Key (30 seconds)
1. After login, go to [API Keys](https://console.groq.com/keys)
2. Click "Create API Key"
3. Give it a name: "AdOps Dashboard"
4. Click "Submit"
5. Copy the API key (starts with `gsk_...`)

### Step 3: Add to Render (1 minute)
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click your backend service
3. Go to "Environment" tab
4. Click "Add Environment Variable"
5. Add:
   - **Key:** `GROQ_API_KEY`
   - **Value:** `gsk_xxxxxxxxxxxxx` (your key)
6. Click "Save Changes"
7. Render will auto-redeploy (2-3 minutes)

### Step 4: Test! (30 seconds)
1. Wait for Render to finish deploying
2. Open your dashboard
3. Click the 🤖 chatbot button
4. Ask: "What's our total revenue?"
5. Get instant response! ⚡

---

## Available Models (All FREE)

Groq supports these models on free tier:

1. **llama3-8b-8192** (Default) - Fast, good quality ⭐
2. **llama3-70b-8192** - Best quality, slower
3. **mixtral-8x7b-32768** - Good balance
4. **gemma-7b-it** - Fast, lightweight

Current default: `llama3-8b-8192` (best for chatbot)

To change model, add to Render environment:
- **Key:** `GROQ_MODEL`
- **Value:** `llama3-70b-8192` (or any model above)

---

## Free Tier Limits

**Groq Free Tier:**
- 30 requests per minute
- 14,400 requests per day
- Unlimited for reasonable use

**More than enough for:**
- Testing
- Small teams
- Personal projects
- Your dashboard usage

---

## Local Testing (Optional)

To test locally, add to `backend/.env`:
```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxx
GROQ_MODEL=llama3-8b-8192
```

Then run:
```bash
cd backend
npm start
```

---

## Comparison

| Provider | Free Tier | Speed | Quality | Setup |
|----------|-----------|-------|---------|-------|
| **Groq** | ✅ Yes | ⚡⚡⚡ | ⭐⭐⭐⭐ | 2 min |
| OpenAI | ❌ No | ⚡⚡ | ⭐⭐⭐⭐⭐ | 5 min |
| Hugging Face | ⚠️ Limited | ⚡ | ⭐⭐⭐ | 5 min |

**Winner:** Groq for free testing! 🏆

---

## Troubleshooting

### "API key not set" error
- Check Render environment variables
- Make sure key starts with `gsk_`
- Redeploy after adding key

### "Rate limit exceeded"
- Free tier: 30 requests/minute
- Wait 1 minute and try again
- Or upgrade to paid tier ($0.10 per million tokens)

### Slow responses
- Try changing model to `llama3-8b-8192` (fastest)
- Check Render logs for errors
- Groq is usually very fast (< 1 second)

---

## Next Steps

1. ✅ Get Groq API key (2 minutes)
2. ✅ Add to Render environment
3. ✅ Wait for deployment
4. ✅ Test chatbot
5. ✅ Enjoy FREE AI! 🎉

Later, if you need more:
- Upgrade to Groq paid tier (very cheap)
- Or switch to OpenAI for best quality
- I can update code anytime

---

## Support

- Groq Docs: [console.groq.com/docs](https://console.groq.com/docs)
- Groq Discord: [groq.com/discord](https://groq.com/discord)
- Need help? Just ask me!

**Total setup time: 2-3 minutes** ⏱️
