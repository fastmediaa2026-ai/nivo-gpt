const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const Replicate = require('replicate');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

app.get('/', (req, res) => {
    res.status(200).send('OK');
});

app.post('/api/chat', async (req, res) => {
    const { message, model, attachment } = req.body;

    // 1. مسار توليد الصور عبر Replicate (نموذج SDXL المعتمد)
    if (model === 'sdxl-lightning') {
        try {
            const output = await replicate.run(
                "stability-ai/sdxl:7762fd07cf82c948538e41f63ee7d35cc0e06224442abb055b870a09e97ce5b9",
                {
                    input: {
                        prompt: message,
                        width: 1024,
                        height: 1024
                    }
                }
            );

            let imageUrl = '';
            if (Array.isArray(output) && output.length > 0) {
                imageUrl = typeof output[0] === 'string' ? output[0] : (output[0].url ? output[0].url() : String(output[0]));
            } else if (typeof output === 'string') {
                imageUrl = output;
            }

            return res.json({ reply: imageUrl, isImage: true });
        } catch (imgErr) {
            console.error('Replicate Error:', imgErr);
            return res.status(500).json({ error: 'تعذر توليد الصورة من Replicate: ' + (imgErr.message || '') });
        }
    }

    // 2. مسار OpenAI (محادثات نصية + فحص وتحليل الصور المرفوعة)
    try {
        let targetModel = 'gpt-4o-mini';
        if (model === 'gpt-4o') targetModel = 'gpt-4o';
        if (model === 'o3-mini') targetModel = 'o3-mini';
        if (model === 'o3') targetModel = 'o1';

        let userContent = [];
        const textPrompt = message && message.trim() ? message.trim() : "حلل محتوى هذه الصورة بدقة واشرح ما تحتويه.";
        userContent.push({ type: "text", text: textPrompt });

        if (attachment && attachment.dataUrl) {
            userContent.push({
                type: "image_url",
                image_url: { url: attachment.dataUrl }
            });
        }

        const completion = await openai.chat.completions.create({
            model: targetModel,
            messages: [{ role: 'user', content: userContent }],
        });

        return res.json({ reply: completion.choices[0].message.content, isImage: false });
    } catch (openAiErr) {
        console.error('OpenAI Error:', openAiErr);
        return res.status(500).json({ error: 'تعذر الاتصال بـ OpenAI: ' + (openAiErr.message || '') });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
