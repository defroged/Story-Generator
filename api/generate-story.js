import OpenAI from 'openai';
import axios from 'axios';
import { BlobServiceClient } from '@azure/storage-blob';
import { htmlToText } from 'html-to-text';
import { load } from 'cheerio';

export const config = {
  api: {
    bodyParser: true,
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
    const { base64Image, mimeType } = req.body;

    if (!base64Image || !mimeType) {
      res.status(400).json({ error: 'Image file and MIME type are required.' });
      return;
    }

    // Step 1: Extract text from image using Azure Vision OCR
console.log('Starting text extraction from image');
    const extractedText = await extractTextFromImage(base64Image);
    console.log('Text extracted:', extractedText);
	
    if (!extractedText) {
      throw new Error('Text extraction failed.');
    }

    // Step 2: Construct the prompt using the extracted text
    const prompt = `
Write a short story based on the details found in the text below. Please generate the story in HTML. Provide only the HTML code without any Markdown formatting or code block delimiters.
Follow these guidelines for writing the story:

1. **Vocabulary, Grammar and Sentence Patterns**: 
   - Use as many words as possible from the vocabulary list.
   - Construct your sentences using ONLY the grammar points listed. Do not use any other grammar!!! Avoid using any grammar that is more advanced than those provided. Use the sentence patterns to construct sentences that are in the same pattern.

2. **Word Limit**:
   - Adjust the length of the story according to the "Student level" indicated:
     - For "Level 1 - Easy": Limit the story to 150 words, but not less than 100. Use very simple English aimed at young ESL learners.
     - For "Level 2 - Medium": Write up to 250 words, but not less than 180. Use very simple English aimed at young ESL learners.
     - For "Level 3 - Hard": Write no more than 400 words, but not less than 300. Use simple English aimed at young ESL learners.

3. **Story Details**: 
   - On the right side of the page, you'll find the student's ideas for the story, including the time, place, characters, and plot, under the headings “who,” “where,” “when,” and “other details.”
   - If any of these fields are incomplete or missing, feel free to fill in the gaps creatively.

4. **Following the story map**:
   - Write your story in a way that follows the following general outline: 
     a) Exposition
     b) Conflict
     c) Climax
     d) Resolution

5. Try to make the story exciting with some elements of surprise. Use humour in the story and try to make the reader laugh if the general theme of the story permits it.

6. **Creating a title**:
   - After completing the story, think of an appropriate title for the story, and add it to your output as <title>.

Here is the text extracted from the image:

${extractedText}
`;
console.log('Starting story generation');
    // Step 3: Generate the story using OpenAI gpt-4o
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    });
    console.log('Story generation response:', response);
	
    const storyHtml = response.choices[0].message.content.trim();

    if (!storyHtml) {
      throw new Error('Story generation failed.');
    }

    // Convert HTML to text for image and audio generation
    const storyText = htmlToText(storyHtml, {
      wordwrap: false,
    });

    // Generate image prompt 
	    console.log('Starting image prompt generation');
    const imagePromptMessages = [
  {
    role: 'system',
    content: 'You are a helpful assistant that creates prompts for image generation.',
  },
  {
    role: 'user',
    content: `Based on the following story, create a short image generation prompt describing one of the main scenes from the story.

Story:
${storyText}`,
  },
];

const promptResponse = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: imagePromptMessages,
  max_tokens: 150,
  temperature: 0.7,
});
    console.log('Image prompt response:', promptResponse);
	
let imagePrompt = promptResponse.choices[0].message.content.trim();

if (!imagePrompt) {
  throw new Error('Prompt generation failed.');
}

if (imagePrompt.length > 1000) {
  imagePrompt = imagePrompt.substring(0, 1000); // Truncate if too long
}

    // Generate image using DALL·E 
	    console.log('Starting image generation');
const imageResponse = await axios.post(
  'https://api.openai.com/v1/images/generations',
  {
    prompt: imagePrompt,  
    model: 'dall-e-3',
    n: 1,
    size: '1024x1024',
  },
  {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
  }
);
    console.log('Image generation response:', imageResponse);
	
	
const imageUrl = imageResponse.data.data[0].url;

if (!imageUrl) {
  throw new Error('Image generation failed.');
}

    // Generate audio narration using ElevenLabs
    console.log('Starting audio narration generation');
    const audioUrl = await generateAudioNarration(storyHtml);
    console.log('Audio narration URL:', audioUrl);

res.status(200).json({ story: storyHtml, imageUrl, audioUrl });
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).json({
      error: 'Failed to generate story, image, or audio narration.',
      details: error.response ? error.response.data : error.message,
    });
  }
}

// Function to extract text from image using Azure Vision OCR
async function extractTextFromImage(base64Image) {
  const endpoint = process.env.AZURE_VISION_ENDPOINT;
  const apiKey = process.env.AZURE_VISION_KEY;

  const imageBuffer = Buffer.from(base64Image, 'base64');

  const url = `${endpoint}/vision/v3.2/read/analyze`;

  try {
    const response = await axios.post(url, imageBuffer, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/octet-stream',
      },
    });

    const operationLocation = response.headers['operation-location'];

    if (!operationLocation) {
      throw new Error('No operation-location header found.');
    }

    // Polling for the results
    let result;
    let isCompleted = false;
    let pollCount = 0;

    while (!isCompleted && pollCount < 10) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second
      const getResultResponse = await axios.get(operationLocation, {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
        },
      });

      result = getResultResponse.data;
      if (result.status === 'succeeded') {
        isCompleted = true;
      } else if (result.status === 'failed') {
        throw new Error('Text extraction failed.');
      }
      pollCount++;
    }

    if (!isCompleted) {
      throw new Error('Text extraction timed out.');
    }

    // Extract text from result
    let extractedText = '';
    for (const readResult of result.analyzeResult.readResults) {
      for (const line of readResult.lines) {
        extractedText += line.text + '\n';
      }
    }

    return extractedText;
  } catch (error) {
    throw error;
  }
}

async function generateAudioNarration(storyHtml) {
  // Load the HTML and extract the text content
  const $ = load(storyHtml);
  
  // Extract the title from the <title> tag
  const storyTitle = $('title').text();

  // Check if <h1> exists and remove it if it's the same as the title
  const h1Text = $('h1').text();
  if (h1Text === storyTitle) {
    $('h1').remove();  // Remove the <h1> tag if it duplicates the title
  }

  // Now, remove the <title> from the HTML to avoid duplication
  $('title').remove();

  // Get the remaining text content after removing the title and <h1> if necessary
  const textContent = $.text().trim();

  // Prepare the final text for narration
  const finalTextContent = `${storyTitle}\n${textContent}`;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '9MkKhy7tpXju7BilX1p8'; 

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const requestBody = {
    text: finalTextContent,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.50,
      similarity_boost: 0.80,
	  speaker_boost: true
    },
  };

  try {
    const response = await axios.post(url, requestBody, {
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer', // Important to receive binary data
    });

    const audioBuffer = response.data;

    // Upload the audio buffer to your storage
    const audioUrl = await uploadAudioToStorage(audioBuffer);

    return audioUrl;
  } catch (error) {
    throw new Error(
      `Failed to generate audio narration: ${error.response ? error.response.data : error.message}`
    );
  }
}

async function uploadAudioToStorage(audioBuffer) {
  const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
  );
  const containerClient = blobServiceClient.getContainerClient(
    process.env.AZURE_STORAGE_CONTAINER_NAME
  );

  const blobName = `audio-${Date.now()}.mp3`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(audioBuffer, {
    blobHTTPHeaders: { blobContentType: 'audio/mpeg' },
  });

  const audioUrl = blockBlobClient.url;

  return audioUrl;
}
