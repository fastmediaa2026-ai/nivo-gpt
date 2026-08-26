const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const Replicate = require('replicate');

const app = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));

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

    const { message, model, attachment } = req.body;

    if (!message && !attachment) {
        return res.status(400).json({
            error: 'الرسالة مطلوبة'
        });
    }

    // ==========================================
    // 1. SDXL LIGHTNING (كود شات جي بي تي كما هو تماماً)
    // GPT-4o-mini → English Prompt
    // → Replicate → Image
    // ==========================================

    if (model === 'sdxl-lightning') {

        try {

            console.log('Original user prompt:', message);

            // ------------------------------------------
            // STEP 1: Translate / Optimize Prompt
            // using GPT-4o-mini
            // ------------------------------------------

            const promptCompletion =
                await openai.chat.completions.create({

                    model: 'gpt-4o-mini',

                    messages: [
                        {
                            role: 'system',
                            content: `
You are an expert AI image prompt translator and optimizer.

The user may write their image request in Arabic or any other language.

Your job is to understand exactly what the user wants and convert it into a detailed, high-quality English prompt for an SDXL image generation model.

IMPORTANT RULES:
- Do NOT answer the user.
- Do NOT explain anything.
- Return ONLY the final English image-generation prompt.
- Preserve the user's requested subject, objects, people, environment, clothing, colors, composition, camera angle, lighting, mood and style.
- If the user requests Arabic text inside the image, preserve that text exactly and explicitly tell the image model that the text must appear in Arabic.
- Do not add unrelated objects or ideas.
- Improve the prompt with useful visual details when appropriate.
- Make the prompt clear and optimized for SDXL.
`
                        },
                        {
                            role: 'user',
                            content: message || 'high quality photo'
                        }
                    ],

                    temperature: 0.3
                });

            const translatedPrompt =
                promptCompletion?.choices?.[0]?.message?.content?.trim();

            if (!translatedPrompt) {
                throw new Error(
                    'فشل GPT-4o-mini في تجهيز الـ Prompt'
                );
            }

            console.log(
                'Optimized English prompt:',
                translatedPrompt
            );

            // ------------------------------------------
            // STEP 2: Generate Image with Replicate
            // ------------------------------------------

            const output = await replicate.run(
                'bytedance/sdxl-lightning-4step:6f7a773af6fc3e8de9d5a3c00be77c17308914bf67772726aff83496ba1e3bbe',
                {
                    input: {
                        prompt: translatedPrompt,
                        width: 1024,
                        height: 1024,
                        num_outputs: 1
                    }
                }
            );

            console.log(
                'Replicate output:',
                output
            );

            // ------------------------------------------
            // STEP 3: Extract Image URL
            // ------------------------------------------

            let imageUrl = '';

            if (
                Array.isArray(output) &&
                output.length > 0
            ) {

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

                else if (
                    typeof first === 'string'
                ) {
                    imageUrl = first;
                }
            }

            else if (
                output &&
                typeof output.url === 'function'
            ) {
                imageUrl = output.url();
            }

            else if (
                typeof output === 'string'
            ) {
                imageUrl = output;
            }

            if (!imageUrl) {

                console.error(
                    'Could not extract image URL:',
                    output
                );

                throw new Error(
                    'فشل استخراج رابط الصورة من Replicate'
                );
            }

            console.log(
                'Generated image:',
                imageUrl
            );

            return res.json({
                reply: imageUrl,
                isImage: true,
                model: 'sdxl-lightning',
                prompt: translatedPrompt
            });

        } catch (imgError) {

            console.error(
                'Image Generation Error:',
                imgError
            );

            return res.status(500).json({
                error:
                    imgError.message ||
                    'فشل توليد الصورة'
            });
        }
    }

    // ==========================================
    // 2. OPENAI TEXT & VISION MODELS
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
            targetModel = 'o1';
        }

        console.log(
            `OpenAI model: ${targetModel}`
        );

        // تجهيز المدخلات: نصوص + صور إن وجدت
        let userContent = [];
        if (message && message.trim()) {
            userContent.push({ type: "text", text: message.trim() });
        } else {
            userContent.push({ type: "text", text: "حلل هذه الصورة بالتفصيل واشرح ما تحتويه." });
        }

        if (attachment && attachment.dataUrl) {
            userContent.push({
                type: "image_url",
                image_url: { url: attachment.dataUrl }
            });
        }

        const completion =
            await openai.chat.completions.create({

                model: targetModel,

                messages: [
                    {
                        role: 'user',
                        content: userContent
                    }
                ]
            });

        const reply =
            completion?.choices?.[0]?.message?.content;

        if (!reply) {
            throw new Error(
                'OpenAI لم يرجع نصاً'
            );
        }

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
