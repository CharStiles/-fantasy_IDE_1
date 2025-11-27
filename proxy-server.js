const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

// First endpoint proxy
app.post('/proxy1', async (req, res) => {
    try {
        const response = await fetch('https://char-bot-talk-contact661.replit.app/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Second endpoint proxy
app.post('/proxy2', async (req, res) => {
    try {
        const response = await fetch('https://888ecb87-fe0b-42ed-90da-73c16accac4d-00-n2w5l9wwt9rq.riker.replit.dev/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => {
    console.log('Proxy server running on http://localhost:3000');
}); 