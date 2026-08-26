const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const Replicate = require('replicate');

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// فحص جاهزية السيرفر
app.get('/', (req, res) => {
    res.send('Nivo Backend API is running successfully!');
});

// استقبال أسئلة الشات وتوليد الصور
app.post('/api/chat', async (req, res) => {
    try {
        const { message, model } = req.body;

        if (model === 'replicate-image') {
            const output = await replicate.run(
                "black-forest-labs/flux-schnell",
                { input: { prompt: message } }
            );
            return res.json({ reply: output[0], isImage: true });
        }

        const selectedModel = model === 'o3-mini' ? 'o3-mini' : 'gpt-4o';
        const completion = await openai.chat.completions.create({
            model: selectedModel,
            messages: [{ role: 'user', content: message }],
        });

        res.json({ reply: completion.choices[0].message.content, isImage: false });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'حدث خطأ في الاتصال بالنموذج، يرجى المحاولة لاحقاً.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
