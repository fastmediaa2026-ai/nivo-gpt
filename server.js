const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const Replicate = require('replicate');

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// فحص الجاهزية لـ Railway
app.get('/', (req, res) => {
    res.status(200).send('OK');
});

// استقبال الطلبات
app.post('/api/chat', async (req, res) => {
    try {
        const { message, model } = req.body;

        // 1. توليد الصور عبر SDXL-Lightning
        if (model === 'sdxl-lightning') {
            const output = await replicate.run(
                "bytedance/sdxl-lightning-4step:5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc24237e78a67f35",
                {
                    input: {
                        prompt: message,
                        width: 1024,
                        height: 1024,
                        num_outputs: 1,
                        scheduler: "K_EULER",
                        guidance_scale: 0
                    }
                }
            );
            const imageUrl = Array.isArray(output) ? output[0] : output;
            return res.json({ reply: imageUrl, isImage: true });
        }

        // 2. نماذج المحادثة والتفكير من OpenAI
        const validModels = ['gpt-4o-mini', 'gpt-4o', 'o3-mini', 'o3'];
        const selectedModel = validModels.includes(model) ? model : 'gpt-4o-mini';

        const completion = await openai.chat.completions.create({
            model: selectedModel,
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
