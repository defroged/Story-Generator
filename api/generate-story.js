// api/generate-story.js

import formidable from 'formidable';
import fs from 'fs';
import { Configuration, OpenAIApi } from 'openai';

export const config = {
    api: {
        bodyParser: false,
    },
};

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('Form parse error:', err);
            res.status(500).json({ error: 'Failed to parse form data.' });
            return;
        }

        const imageFile = files.image;
        if (!imageFile) {
            res.status(400).json({ error: 'Image file is required.' });
            return;
        }

        try {
            // Read the image file
            const imageData = fs.readFileSync(imageFile.filepath);

            // Send the image to the OpenAI API using GPT-4 with vision
            const response = await openai.createChatCompletion({
                model: 'gpt-4-vision',
                messages: [
                    {
                        role: 'user',
                        content: 'Write a short children\'s story based on the content of this image.',
                    },
                ],
                functions: [
                    {
                        name: "add_image",
                        description: "Add an image to the prompt.",
                        parameters: {
                            type: "object",
                            properties: {
                                image: {
                                    type: "string",
                                    description: "Base64-encoded image data.",
                                },
                            },
                            required: ["image"],
                        },
                    },
                ],
                function_call: {
                    name: "add_image",
                    arguments: JSON.stringify({
                        image: imageData.toString('base64'),
                    }),
                },
            });

            const story = response.data.choices[0].message.content.trim();
            res.status(200).json({ story });
        } catch (error) {
            console.error('OpenAI API Error:', error);
            res.status(500).json({ error: 'Failed to generate story.' });
        } finally {
            // Clean up temporary files
            fs.unlink(imageFile.filepath, (err) => {
                if (err) console.error('Failed to delete temporary file:', err);
            });
        }
    });
}
