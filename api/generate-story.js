// api/generate-story.js

import { Configuration, OpenAIApi } from 'openai';

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export default async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { prompt } = req.body;

    if (!prompt) {
        res.status(400).json({ error: 'Prompt text is required.' });
        return;
    }

    try {
        const response = await openai.createCompletion({
            model: 'text-davinci-003',
            prompt: `Write a short children's story based on the following request:\n\n${prompt}`,
            max_tokens: 500,
            temperature: 0.7,
        });

        const story = response.data.choices[0].text.trim();
        res.status(200).json({ story });
    } catch (error) {
        console.error('OpenAI API Error:', error);
        res.status(500).json({ error: 'Failed to generate story.' });
    }
};
