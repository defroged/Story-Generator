// api/generate-story.js

import { OpenAI } from 'openai';

export const config = {
  api: {
    bodyParser: false, // Disable body parsing for file uploads
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
    // Parse the multipart form data
    const imageData = await getImageData(req);
    if (!imageData) {
      res.status(400).json({ error: 'Image file is required.' });
      return;
    }

    // Convert the image to base64 and create a data URL
    const base64Image = imageData.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    // Create the messages array as per OpenAI's latest API
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: "Write a short children's story based on the content of this image." },
          {
            type: 'image_url',
            image_url: {
              url: dataUrl,
            },
          },
        ],
      },
    ];

    // Call the OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const story = response.choices[0].message.content.trim();
    res.status(200).json({ story });
  } catch (error) {
    console.error('OpenAI API Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to generate story.', details: error.message });
  }
}

// Helper function to parse image data from the request
async function getImageData(req) {
  return new Promise((resolve, reject) => {
    let imageData = Buffer.alloc(0);
    let isImageFound = false;

    req.on('data', (chunk) => {
      imageData = Buffer.concat([imageData, chunk]);
    });

    req.on('end', () => {
      // Extract the image data from the multipart form data
      const boundary = getBoundary(req.headers['content-type']);
      if (!boundary) {
        return reject(new Error('Invalid content-type header.'));
      }

      const parts = imageData.toString().split(boundary);
      for (const part of parts) {
        if (part.includes('Content-Disposition') && part.includes('name="image"')) {
          const imageStart = part.indexOf('\r\n\r\n') + 4;
          const imageEnd = part.lastIndexOf('\r\n');
          const imageBuffer = Buffer.from(part.substring(imageStart, imageEnd), 'binary');
          isImageFound = true;
          return resolve(imageBuffer);
        }
      }

      if (!isImageFound) {
        reject(new Error('Image file not found in the request.'));
      }
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

// Function to get the boundary from the content-type header
function getBoundary(contentType) {
  const items = contentType.split(';');
  for (const item of items) {
    const trimmedItem = item.trim();
    if (trimmedItem.startsWith('boundary=')) {
      return `--${trimmedItem.substring(9)}`;
    }
  }
  return null;
}
