const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const Replicate = require('replicate');

const app = express();

app.use(cors());
app.use(express.json());

// ==========================================
// API CLIENTS
// ==========================================

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/', (req, res) => {
    res.status(200).send('OK');
});

// ==========================================
// CHAT / IMAGE API
// ==========================================

app.post('/api/chat', async (req, res) => {

    const { message, model } = req.body;

    if (!message) {
        return res.status(400).json({
            error: 'الرسالة مطلوبة'
        });
    }

    // ==========================================
    // 1. IMAGE GENERATION - REPLICATE
    // SDXL LIGHTNING 4 STEP
    // ==========================================

    if (model === 'sdxl-lightning') {

        try {

            const output = await replicate.run(
                'bytedance/sdxl-lightning-4step:6f7a773af6fc3e8de9d5a3c00be77c17308914bf67772726aff83496ba1e3bbe',
                {
                    input: {
                        prompt: message,
                        width: 1024,
                        height: 1024,
                        num_outputs: 1
                    }
                }
            );

            console.log('Replicate output:', output);

            let imageUrl = '';

            // Replicate returns an array
            if (Array.isArray(output) && output.length > 0) {

                const first = output[0];

                if (
                    first &&
                    typeof first === 'object' &&
                    typeof first.url === 'function'
                ) {
                    imageUrl = first.url();
                }

                else if (
                    first &&
                    typeof first === 'object' &&
                    typeof first.url === 'string'
                ) {
                    imageUrl = first.url;
                }

                else if (typeof first === 'string') {
                    imageUrl = first;
                }
            }

            // Replicate returns a single FileOutput
            else if (
                output &&
                typeof output.url === 'function'
            ) {
                imageUrl = output.url();
            }

            // Replicate returns a direct URL
            else if (typeof output === 'string') {
                imageUrl = output;
            }

            if (!imageUrl) {
                console.error(
                    'Could not extract image URL:',
                    output
                );

                throw new Error(
                    'فشل استخراج رابط الصورة من استجابة Replicate'
                );
            }

            console.log(
                'Replicate image URL:',
                imageUrl
            );

            return res.json({
                reply: imageUrl,
                isImage: true,
                model: 'sdxl-lightning'
            });

        } catch (imgError) {

            console.error(
                'Replicate Error:',
                imgError
            );

            return res.status(500).json({
                error:
                    imgError.message ||
                    'فشل توليد الصورة باستخدام Replicate'
            });
        }
    }

    // ==========================================
    // 2. TEXT GENERATION - OPENAI
    // ==========================================

    try {

        let targetModel = 'gpt-4o-mini';

        if (model === 'gpt-4o') {
            targetModel = 'gpt-4o';
        }

        if (model === 'gpt-4o-mini') {
            targetModel = 'gpt-4o-mini';
        }

        if (model === 'o3-mini') {
            targetModel = 'o3-mini';
        }

        if (model === 'o3') {
            targetModel = 'o3';
        }

        console.log(
            `OpenAI model: ${targetModel}`
        );

        const completion =
            await openai.chat.completions.create({

                model: targetModel,

                messages: [
                    {
                        role: 'user',
                        content: message
                    }
                ]
            });

        const reply =
            completion.choices[0].message.content;

        return res.json({
            reply: reply,
            isImage: false,
            model: targetModel
        });

    } catch (textError) {

        console.error(
            'OpenAI Error:',
            textError
        );

        return res.status(500).json({
            error:
                textError.message ||
                'فشل الاتصال بـ OpenAI'
        });
    }
});

// ==========================================
// SERVER
// ==========================================

const PORT = process.env.PORT || 8080;

app.listen(
    PORT,
    '0.0.0.0',
    () => {
        console.log(
            `Server running on port ${PORT}`
        );
    }
);
