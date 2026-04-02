# AI Insights & Chatbot Setup Guide

## Overview
Your dashboard now includes an AI-powered chatbot feature:
- **Interactive Chatbot**: Answer questions about your data in natural language
- **Admin Control**: Enable/disable chatbot per user from Admin panel

## Setup Instructions

### Option 1: Hugging Face (FREE - Recommended for Testing)

#### Step 1: Get Your API Key
1. Go to [huggingface.co](https://huggingface.co/) and create a free account
2. Navigate to [Settings → Access Tokens](https://huggingface.co/settings/tokens)
3. Click "New token"
4. Give it a name (e.g., "AdOps Dashboard")
5. Select "Read" access
6. Click "Generate token"
7. Copy the token (starts with `hf_...`)

#### Step 2: Add to Backend
1. Open `backend/.env`
2. Find the line: `HUGGINGFACE_API_KEY=your-huggingface-api-key-here`
3. Replace with your actual key: `HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxx`
4. Save the file

#### Step 3: Deploy
```bash
# Commit and push
git add .
git commit -m "Add AI insights and chatbot with Hugging Face"
git push origin main
```

Render and Vercel will automatically deploy the changes.

#### Important Notes:
- **First request may be slow** (10-20 seconds) as the model loads
- Subsequent requests are faster (2-5 seconds)
- Free tier has rate limits but should be sufficient for testing
- Model used: Mistral-7B-Instruct (high quality, open-source)

---

### Option 2: OpenAI (Paid - Better Quality)

If you prefer OpenAI (GPT-4), follow these steps:

#### Step 1: Get API Key
1. Go to [platform.openai.com](https://platform.openai.com/)
2. Sign up and add payment method
3. Go to API Keys section
4. Create new secret key
5. Copy the key (starts with `sk-...`)

#### Step 2: Update Backend Code
1. Install OpenAI package:
```bash
cd backend
npm install openai
```

2. Replace `backend/services/aiService.js` with OpenAI implementation (I can provide this if needed)

3. Add to `.env`:
```
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
```

#### Pricing:
- GPT-3.5-turbo: ~$0.002 per request
- GPT-4: ~$0.03 per request
- Estimated: $10-30/month for moderate usage

---

## Features

### Chatbot Widget
Floating button (🤖) in the bottom-right corner (when enabled for user):

**Example Questions:**
- "What's our total revenue this month?"
- "Which campaigns have the best gross margins?"
- "Show me top performing products"
- "What's the average CPM?"
- "Which regions are underperforming?"
- "Compare revenue vs spend"
- "What's driving the margin decrease?"

**Features:**
- Context-aware (knows your current filters)
- Conversation history
- Suggested questions
- Real-time data analysis

### Admin Control
In the Admin Setup page, you can:
- Enable/disable chatbot for each user
- New checkbox: "Enable AI Chatbot"
- Default: Enabled for all users
- Users without chatbot access won't see the 🤖 button

---

## Testing

### Test Chatbot
1. Login to dashboard
2. Look for 🤖 button in bottom-right corner
3. Click to open chat interface
4. Try a suggested question or type your own
5. Wait for response (10-20 seconds first time, faster after)
6. Ask follow-up questions

### Test Admin Control
1. Go to Admin Setup page
2. Edit a user
3. Uncheck "Enable AI Chatbot"
4. Save changes
5. Login as that user - chatbot button should not appear
6. Re-enable and verify button appears again

---

## Troubleshooting

### "Failed to generate insights"
- Check that `HUGGINGFACE_API_KEY` is set correctly in backend/.env
- Verify the key is valid at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
- Check Render logs for error messages

### "Model is loading" message
- This is normal for first request
- Wait 10-20 seconds and it will retry automatically
- Subsequent requests will be faster

### Slow responses
- Hugging Face free tier can be slow during peak times
- Consider upgrading to OpenAI for faster responses
- Or use Hugging Face Pro ($9/month) for faster inference

### API rate limits
- Hugging Face free tier: ~1000 requests/day
- If you hit limits, wait 24 hours or upgrade
- OpenAI has higher limits with pay-as-you-go

---

## Customization

### Change AI Model
Edit `backend/services/aiService.js`:
```javascript
// Current model
const HF_API_URL = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';

// Alternative models:
// Llama 3 (faster, good quality)
const HF_API_URL = 'https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct';

// Mixtral (slower, better quality)
const HF_API_URL = 'https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1';
```

### Customize Insights
Edit the prompt in `backend/services/aiService.js` → `generateInsights()` function

### Add More Context to Chatbot
Edit `backend/routes/ai.js` → `/chat` endpoint to include more data

---

## Cost Estimates

### Hugging Face (Free Tier)
- **Cost**: $0/month
- **Requests**: ~1000/day
- **Speed**: 2-10 seconds per request
- **Quality**: Good (Mistral-7B)

### Hugging Face Pro
- **Cost**: $9/month
- **Requests**: Unlimited
- **Speed**: 1-3 seconds per request
- **Quality**: Good (Mistral-7B)

### OpenAI GPT-3.5
- **Cost**: ~$10-30/month (moderate usage)
- **Requests**: Pay per use
- **Speed**: 1-2 seconds per request
- **Quality**: Excellent

### OpenAI GPT-4
- **Cost**: ~$50-150/month (moderate usage)
- **Requests**: Pay per use
- **Speed**: 2-4 seconds per request
- **Quality**: Best

---

## Next Steps

1. **Get Hugging Face API key** (5 minutes)
2. **Add to backend/.env** (1 minute)
3. **Push to Git** (1 minute)
4. **Wait for deployment** (3-5 minutes)
5. **Test the features** (10 minutes)

Total setup time: ~20 minutes

---

## Support

If you encounter issues:
1. Check Render logs for backend errors
2. Check browser console for frontend errors
3. Verify API key is correct
4. Try regenerating the API key
5. Contact me for help!

---

## Future Enhancements

Possible additions:
- Export insights as PDF reports
- Schedule automated insight emails
- Voice input for chatbot
- Multi-language support
- Custom insight templates
- Integration with Slack/Teams
- Predictive analytics
- Anomaly detection alerts
