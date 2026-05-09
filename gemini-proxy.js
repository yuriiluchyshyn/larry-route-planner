import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = 3002;

// Enable CORS for all routes
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Gemini API proxy endpoint
app.post('/api/gemini', async (req, res) => {
  try {
    const { apiKey, ...requestBody } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    console.log('🤖 Gemini Proxy: Forwarding request to Google Gemini API...');
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('🤖 Gemini Proxy: API error:', data);
      return res.status(response.status).json(data);
    }

    console.log('🤖 Gemini Proxy: Success!');
    res.json(data);
    
  } catch (error) {
    console.error('🤖 Gemini Proxy: Server error:', error);
    res.status(500).json({ 
      error: 'Proxy server error', 
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Gemini Proxy', port: PORT });
});

app.listen(PORT, () => {
  console.log(`🤖 Gemini Proxy Server running on http://localhost:${PORT}`);
  console.log(`🤖 Health check: http://localhost:${PORT}/health`);
});