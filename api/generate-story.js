import OpenAI from 'openai';
import Busboy from 'busboy';

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
    const { imageData, mimeType } = await getImageData(req);
    
    if (!imageData) {
      console.error("No image data found!");
      res.status(400).json({ error: 'Image file is required.' });
      return;
    }

    // Convert the image to base64 and create a data URL
    const base64Image = imageData.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    console.log("Image processed and converted to base64:", dataUrl); // Log the data URL

    // Create the messages array as per OpenAI's latest API
    const messages = [
      {
        role: 'user',
        content: `Write a short children's story based on this image: ${dataUrl}`,
      },
    ];

    // Call the OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
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

// Helper function to parse image data and MIME type from the request
function getImageData(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers });
    let imageData = null;
    let mimeType = null;

    bb.on('file', (fieldname, file, filename, encoding, mimetype) => {
      if (fieldname === 'image') {
        const chunks = [];
        mimeType = mimetype;
        file.on('data', (data) => {
          console.log('Receiving data chunk'); // Log to see if data is being received
          chunks.push(data);
        });
        file.on('end', () => {
          imageData = Buffer.concat(chunks);
          console.log('File received, size:', imageData.length); // Log file size
        });
      } else {
        console.log('Unexpected field:', fieldname); // Log any other unexpected fields
      }
    });

    bb.on('finish', () => {
      if (imageData && mimeType) {
        resolve({ imageData, mimeType });
      } else {
        console.error("Image data or MIME type not found");
        reject(new Error('Image file not found in the request.'));
      }
    });

    bb.on('error', (err) => {
      reject(err);
    });

    req.pipe(bb);
  });
}
