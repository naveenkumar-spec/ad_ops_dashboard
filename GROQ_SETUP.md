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

### Rate Limits (Per Minute):
- **30 requests per minute** per API key
- **14,400 requests per day** (if maxed out every minute)
- **432,000 requests per month** (theoretical maximum)

### Token Limits:
- **llama-3.1-8b-instant**: 30,000 tokens/minute
- **llama-3.1-70b-versatile**: 6,000 tokens/minute
- **mixtral-8x7b**: 5,000 tokens/minute

### Context Window:
- Up to **8,192 tokens** per request (input + output)

---

## Is It Really Free?

**YES! 100% FREE as long as you stay under 30 requests/minute!**

### What's FREE:
✅ Unlimited daily requests (up to 14,400/day)  
✅ Unlimited monthly requests (up to 432,000/month)  
✅ Unlimited users  
✅ Unlimited duration (use for years)  
✅ No credit card required  
✅ No expiration  

### The Only Limit:
❌ Maximum 30 requests per minute

**If you stay under 30 req/min, it's FREE FOREVER!**

---

## Real-World Usage Examples

### Small Team (10 users):
- Each user asks 5 questions/day = 50 queries/day
- Average: **0.03 requests/minute**
- **Usage: 0.1% of free limit** ✅
- **Cost: $0/month**

### Medium Team (50 users):
- Each user asks 10 questions/day = 500 queries/day
- Average: **0.35 requests/minute**
- **Usage: 1.2% of free limit** ✅
- **Cost: $0/month**

### Heavy Usage (100 users):
- Each user asks 20 questions/day = 2,000 queries/day
- Average: **1.4 requests/minute**
- **Usage: 4.7% of free limit** ✅
- **Cost: $0/month**

### When You'd Hit the Limit:
❌ 30+ people asking questions in the same minute  
❌ Someone spamming (30 clicks in 60 seconds)  
❌ Very unlikely in normal use!

---

## What Happens If You Hit the Limit?

**Rate Limit Response:**
```json
{
  "error": {
    "message": "Rate limit exceeded",
    "type": "rate_limit_error"
  }
}
```

**User Experience:**
- Sees: "I'm having trouble processing your question right now. Please try again in a moment."
- Wait 1 minute
- Works again automatically

**No charges, no penalties, just a temporary pause!**

---

## Monitoring Your Usage

Check your usage at [Groq Console](https://console.groq.com/):
- Go to Usage tab
- See requests per day/hour/minute
- Get alerts if approaching limits
- View token consumption

---

## If You Need More (Paid Tier)

### Groq Paid Tier:
- **Cost**: Pay-as-you-go ($0.10 per 1M tokens)
- **Limits**: Much higher (thousands of requests/min)
- **Billing**: Only pay for what you use
- **No monthly fees**: Pay only for actual usage

### Estimated Costs (If You Upgrade):
- 10,000 queries/month ≈ **$1-2**
- 100,000 queries/month ≈ **$10-20**
- 1,000,000 queries/month ≈ **$100-200**

Still much cheaper than OpenAI or Anthropic!

---

## Comparison with Other Providers

| Provider | Free Tier | Rate Limit | Cost After Free |
|----------|-----------|------------|-----------------|
| **Groq** | ✅ Unlimited (30/min) | 30 req/min | $0.10 per 1M tokens |
| OpenAI | ❌ $5 trial (expires) | Varies | $0.50-$15 per 1M tokens |
| Anthropic | ❌ None | N/A | $3-$15 per 1M tokens |
| Google AI | ⚠️ Limited | 60 req/min | $0.50-$7 per 1M tokens |

**Groq is the best free option!** 🏆

---

## Recommendations

### For Testing/Small Teams (< 50 users):
✅ Free tier is perfect  
✅ No credit card needed  
✅ No worries about costs  
✅ Can use for years  

### For Growing Teams (50-200 users):
✅ Still likely within free tier  
✅ Monitor usage in console  
✅ Upgrade only if hitting limits regularly  

### For Large Teams (200+ users):
⚠️ May hit rate limits during peak times  
💡 Consider upgrading to paid tier  
💰 Still very affordable ($10-50/month)  

---

## Bottom Line

**Your dashboard with ~10 users will be 100% FREE indefinitely!**

The free tier is designed for exactly this - small to medium teams testing and using AI features. Groq makes money from large enterprises with thousands of requests per minute, not from small teams.

**Enjoy your free AI chatbot!** 🚀

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
