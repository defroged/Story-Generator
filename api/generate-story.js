import OpenAI from 'openai';

export const config = {
  api: {
    bodyParser: true, // Enable body parsing for JSON data
  },
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Extract base64 image from request body
    const { base64Image, mimeType } = req.body;

    if (!base64Image || !mimeType) {
      console.error("No base64 image data or MIME type found!");
      res.status(400).json({ error: 'Image file and MIME type are required.' });
      return;
    }

    // Prepare the OpenAI request
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: "Write a short children's story based on this image." },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64Image}` },
          }
        ],
      }
    ];

    // Send the request to OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use the correct model
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const story = response.choices[0].message.content.trim();
    res.status(200).json({ story });
  } catch (error) {
    console.error('OpenAI API Error:', error.response ? error.response.data : error.message);
    res.status(500).json({
      error: 'Failed to generate story.',
      details: error.response ? error.response.data : error.message,
    });
  }
}
