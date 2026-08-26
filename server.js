const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const Replicate = require('replicate');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

app.get('/', (req, res) => {
    res.status(200).send('OK');
});

app.post('/api/chat', async (req, res) => {
    const { message, model, attachment } = req.body;

    // 1. توليد الصور عبر Replicate بالنسخة الصحيحة
    if (model === 'sdxl-lightning') {
        try {
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

            let imageUrl = '';
            if (Array.isArray(output) && output.length > 0) {
                imageUrl = typeof output[0] === 'string' ? output[0] : (output[0].url ? output[0].url() : String(output[0]));
            } else if (typeof output === 'string') {
                imageUrl = output;
            } else if (output && typeof output.url === 'function') {
                imageUrl = output.url();
            }

            return res.json({ reply: imageUrl, isImage: true });
        } catch (imgError) {
            console.error('Replicate Error:', imgError);
            return res.status(500).json({ error: imgError.message || 'فشل توليد الصورة' });
        }
    }

    // 2. المحادثات وتحليل الصور المرفوعة عبر OpenAI
    try {
        let targetModel = 'gpt-4o-mini';
        if (model === 'gpt-4o') targetModel = 'gpt-4o';
        if (model === 'o3-mini') targetModel = 'o3-mini';
        if (model === 'o3') targetModel = 'o1';

        let contentParts = [{ type: "text", text: message || "ما هذا؟" }];

        if (attachment && attachment.dataUrl) {
            contentParts.push({
                type: "image_url",
                image_url: { url: attachment.dataUrl }
            });
        }

        const completion = await openai.chat.completions.create({
            model: targetModel,
            messages: [{ role: 'user', content: contentParts }],
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
