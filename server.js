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
    const { message, model } = req.body;

    // 1. توليد الصور عبر Replicate (اسم الموديل المباشر بدون هاش)
    if (model === 'sdxl-lightning') {
        try {
            const output = await replicate.run(
                "bytedance/sdxl-lightning-4step",
                {
                    input: {
                        prompt: message
                    }
                }
            );

            let imageUrl = '';
            if (Array.isArray(output) && output.length > 0) {
                const first = output[0];
                imageUrl = (typeof first === 'object' && first.url) ? (typeof first.url === 'function' ? first.url() : first.url) : String(first);
            } else if (typeof output === 'string') {
                imageUrl = output;
            } else if (output && typeof output.url === 'function') {
                imageUrl = output.url();
            }

            if (!imageUrl) {
                throw new Error('لم يتم استلام رابط صورة صالح من Replicate');
            }

            return res.json({ reply: imageUrl, isImage: true });
        } catch (imgError) {
            console.error('Replicate Error:', imgError);
            return res.status(500).json({ error: imgError.message || 'فشل توليد الصورة من Replicate' });
        }
    }

    // 2. المحادثات النصية عبر OpenAI
    try {
        let targetModel = 'gpt-4o-mini';
        if (model === 'gpt-4o') targetModel = 'gpt-4o';
        if (model === 'o3-mini') targetModel = 'o3-mini';
        if (model === 'o3') targetModel = 'o1';

        const completion = await openai.chat.completions.create({
            model: targetModel,
            messages: [{ role: 'user', content: message }],
        });

        return res.json({ reply: completion.choices[0].message.content, isImage: false });
    } catch (textError) {
        console.error('OpenAI Error:', textError);
        return res.status(500).json({ error: textError.message || 'فشل الاتصال بـ OpenAI' });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
