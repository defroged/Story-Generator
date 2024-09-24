const busboy = require('busboy');
const { Configuration, OpenAIApi } = require('openai');

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

  try {
    // Parse the multipart form data
    const imageData = await getImageData(req);
    if (!imageData) {
      res.status(400).json({ error: 'Image file is required.' });
      return;
    }

    // Send the image to the OpenAI API
    const response = await openai.createChatCompletion({
      model: 'gpt-4-vision',
      messages: [
        {
          role: 'user',
          content: "Write a short children's story based on the content of this image.",
        },
      ],
      functions: [
        {
          name: 'add_image',
          description: 'Add an image to the prompt.',
          parameters: {
            type: 'object',
            properties: {
              image: {
                type: 'string',
                description: 'Base64-encoded image data.',
              },
            },
            required: ['image'],
          },
        },
      ],
      function_call: {
        name: 'add_image',
        arguments: JSON.stringify({
          image: imageData.toString('base64'),
        }),
      },
    });

    const story = response.data.choices[0].message.content.trim();
    res.status(200).json({ story });
  } catch (error) {
    console.error('OpenAI API Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to generate story.' });
  }
}

// Helper function to parse image data from the request
function getImageData(req) {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers });
    let imageData = null;

    bb.on('file', (fieldname, file, filename, encoding, mimetype) => {
      const chunks = [];
      file.on('data', (data) => {
        chunks.push(data);
      });
      file.on('end', () => {
        imageData = Buffer.concat(chunks);
      });
    });

    bb.on('finish', () => {
      resolve(imageData);
    });

    bb.on('error', (err) => {
      reject(err);
    });

    req.pipe(bb);
  });
}
