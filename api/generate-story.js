import OpenAI from 'openai';
import axios from 'axios';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
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
      console.error('No base64 image data or MIME type found!');
      res
        .status(400)
        .json({ error: 'Image file and MIME type are required.' });
      return;
    }

    // Step 1: Extract text from image using Azure Vision OCR
    const extractedText = await extractTextFromImage(base64Image);

    if (!extractedText) {
      throw new Error('Text extraction failed.');
    }

    console.log('Extracted text from image:', extractedText);

    // Step 2: Construct the prompt using the extracted text
    const prompt = `
Write a short story based on the details found in the text below. Please generate the story in HTML. Provide only the HTML code without any Markdown formatting or code block delimiters.
Follow these guidelines for writing the story:

1. **Vocabulary and Grammar**: 
   - Use as many words as possible from the vocabulary list on the left side of the page.
   - Construct your sentences using ONLY the grammar points listed on the left side. Do not use any other grammar!!! Avoid using any grammar that is more advanced than those provided.

2. **Word Limit**:
   - Adjust the length of the story according to the level indicated on the left side of the page:
     - For "Level 1 - Easy": Limit the story to 150 words, but not less than 100. Use very simple English aimed at young ESL learners.
     - For "Level 2 - Medium": Write up to 250 words, but not less than 180. Use very simple English aimed at young ESL learners.
     - For "Level 3 - Hard": Write no more than 400 words, but not less than 300. Use simple English aimed at young ESL learners.

3. **Story Details**: 
   - On the right side of the page, you'll find the student's ideas for the story, including the time, place, characters, and plot, under the headings “who,” “where,” “when,” and “other details.”
   - If any of these fields are incomplete or missing, feel free to fill in the gaps creatively.

4. **Incorporating Visuals**: 
   - In the bottom right section of the page, there is a drawing that represents the student’s concept of the setting or characters. Do your best to incorporate elements from this drawing into the story.

5. **Following the story map**:
   - Write your story in a way that follows the following general outline: 
     a) Exposition
     b) Conflict
     c) Climax
     d) Resolution

6. **Creating a title**:
   - After completing the story, think of an appropriate title for the story, and add it to your output as <title>.

Here is the text extracted from the image:

${extractedText}
`;

    console.log('Prompt for story generation:', prompt);

    // Step 3: Generate the story using OpenAI GPT-4
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    });

    const storyHtml = response.choices[0].message.content.trim();

    if (!storyHtml) {
      throw new Error('Story generation failed.');
    }

    console.log('Generated story HTML:', storyHtml);

    // Convert HTML to text for image and audio generation
    const storyText = htmlToText(storyHtml, {
      wordwrap: false,
    });

    console.log('Story text for image and audio generation:', storyText);

    // Generate image prompt (Optional, but currently not used in image generation)
    const imagePromptMessages = [
      {
        role: 'system',
        content:
          'You are a helpful assistant that creates prompts for image generation.',
      },
      {
        role: 'user',
        content: `Based on the following story, create a detailed and vivid description suitable for generating an image. Focus on positive, family-friendly elements, and avoid any disallowed content. The description should be less than 1000 characters. The desired image output should be simple without too many details in the background.

Story:
${storyText}`,
      },
    ];

    console.log('Messages for image prompt generation:', imagePromptMessages);

    const promptResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: imagePromptMessages,
      max_tokens: 150,
      temperature: 0.7,
    });

    let imagePrompt = promptResponse.choices[0].message.content.trim();

    if (!imagePrompt) {
      throw new Error('Prompt generation failed.');
    }

    if (imagePrompt.length > 1000) {
      imagePrompt = imagePrompt.substring(0, 1000);
    }

    console.log('Generated image prompt:', imagePrompt);

    // Image moderation (optional, but recommended)
    const moderationResponse = await axios.post(
      'https://api.openai.com/v1/moderations',
      { input: imagePrompt },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    const moderationResult = moderationResponse.data.results[0];

    if (moderationResult.flagged) {
      throw new Error('The generated prompt contains disallowed content.');
    }

    // Generate image using DALL·E (Using 'prompt' as per your request)
    console.log('Sending prompt to DALL·E:', prompt);

    const imageResponse = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        prompt: prompt, // Using 'prompt' variable here
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

    const imageUrl = imageResponse.data.data[0].url;

    if (!imageUrl) {
      throw new Error('Image generation failed.');
    }

    console.log('Generated image URL:', imageUrl);

    // Generate audio narration
    const audioUrl = await generateAudioNarration(storyHtml);

    console.log('Generated audio URL:', audioUrl);

    res.status(200).json({ story: storyHtml, imageUrl, audioUrl });
  } catch (error) {
    console.error(
      'Error:',
      error.response ? error.response.data : error.message
    );
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

    console.log('Extracted OCR text:', extractedText);

    return extractedText;
  } catch (error) {
    console.error('Error in extractTextFromImage:', error.message);
    throw error;
  }
}

async function generateAudioNarration(storyHtml) {
  return new Promise((resolve, reject) => {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY,
      process.env.AZURE_SPEECH_REGION
    );

    speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

    const constructSSML = (inputHtml) => {
      // Parse the input HTML to extract text content
      const $ = load(inputHtml);

      // Extract the text content from the HTML
      const textContent = $.text();

      // Construct the SSML with a single voice and prosody
      const ssml = `
        <speak xmlns="http://www.w3.org/2001/10/synthesis"
               xmlns:mstts="http://www.w3.org/2001/mstts"
               xmlns:emo="http://www.w3.org/2009/10/emotionml"
               version="1.0" xml:lang="de-DE">
          <voice name="de-DE-SeraphinaMultilingualNeural">
            <prosody rate="-20.00%" pitch="-10.00%">
              ${textContent}
            </prosody>
          </voice>
        </speak>`;
      return ssml;
    };

    const ssml = constructSSML(storyHtml);

    console.log('SSML for speech synthesis:', ssml);

    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

    synthesizer.speakSsmlAsync(
      ssml,
      async (result) => {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          const audioBuffer = result.audioData;
          const audioUrl = await uploadAudioToStorage(audioBuffer);
          resolve(audioUrl);
        } else {
          reject(result.errorDetails);
        }
        synthesizer.close();
      },
      (error) => {
        synthesizer.close();
        reject(error);
      }
    );
  });
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

  console.log('Uploaded audio to storage:', audioUrl);

  return audioUrl;
}
