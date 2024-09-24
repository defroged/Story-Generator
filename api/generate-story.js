// api/generate-story.js

import OpenAI from 'openai';

export const config = {
  api: {
    bodyParser: false, // Disable built-in body parser to handle multipart form data
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
    const imageData = await getImageData(req);
    if (!imageData) {
      res.status(400).json({ error: 'Image file is required.' });
      return;
    }

    // Validate image format and size
    const { buffer, mimeType } = imageData;
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)) {
      res.status(400).json({ error: 'Unsupported image format. Please upload a JPEG, PNG, GIF, or WEBP image.' });
      return;
    }

    if (buffer.length > 20 * 1024 * 1024) { // 20 MB limit
      res.status(400).json({ error: 'Image is too large. Please upload an image smaller than 20 MB.' });
      return;
    }

    // Convert image buffer to base64 data URL
    const base64Image = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    // Construct the messages array
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: "Write a short children's story based on the content of this image." },
          {
            type: 'image',
            image: {
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
    res.status(500).json({
      error: 'Failed to generate story.',
      details: error.response ? error.response.data : error.message,
    });
  }
}

// Helper function to parse image data from the request
async function getImageData(req) {
  return new Promise((resolve, reject) => {
    let imageData = Buffer.alloc(0);
    let mimeType = '';
    let contentDisposition = '';

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
          // Get Content-Type
          const mimeMatch = part.match(/Content-Type: (.+)/);
          if (mimeMatch) {
            mimeType = mimeMatch[1].trim();
          }

          const imageStart = part.indexOf('\r\n\r\n') + 4;
          const imageEnd = part.lastIndexOf('\r\n--');
          const imageBuffer = Buffer.from(part.substring(imageStart, imageEnd), 'binary');

          return resolve({ buffer: imageBuffer, mimeType });
        }
      }

      reject(new Error('Image file not found in the request.'));
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
