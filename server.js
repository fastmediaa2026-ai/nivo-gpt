const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const Replicate = require('replicate');

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

app.get('/', (req, res) => {
    res.status(200).send('OK');
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message, model } = req.body;

        // 1. توليد الصور عبر Replicate
        if (model === 'sdxl-lightning') {
            const output = await replicate.run(
                "bytedance/sdxl-lightning-4step:5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc24237e78a67f35",
                {
                    input: {
                        prompt: message,
                        width: 1024,
                        height: 1024,
                        num_outputs: 1
                    }
                }
            );
            const imageUrl = Array.isArray(output) ? output[0] : output;
            return res.json({ reply: imageUrl, isImage: true });
        }

        // 2. توجيه الموديلات النصية لأسماء الـ API الرسمية
        let targetModel = 'gpt-4o-mini';
        if (model === 'gpt-4o') targetModel = 'gpt-4o';
        if (model === 'o3-mini') targetModel = 'o3-mini';
        if (model === 'o3') targetModel = 'o1';

        const completion = await openai.chat.completions.create({
            model: targetModel,
            messages: [{ role: 'user', content: message }],
        });

        res.json({ reply: completion.choices[0].message.content, isImage: false });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء الاتصال بالنموذج المحدد.' });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
