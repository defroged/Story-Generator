// Import necessary modules
import OpenAI from 'openai';
import axios from 'axios';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { BlobServiceClient } from '@azure/storage-blob';

// Import the html-to-text package to convert HTML to plain text
import { htmlToText } from 'html-to-text';

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
    // Extract base64 image from request body
    const { base64Image, mimeType } = req.body;

    if (!base64Image || !mimeType) {
      console.error('No base64 image data or MIME type found!');
      res
        .status(400)
        .json({ error: 'Image file and MIME type are required.' });
      return;
    }

    // Prepare the OpenAI request for story generation
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Write a short story based on the details found in the image of this page. Please generate the story in HTML. Provide only the HTML code without any Markdown formatting or code block delimiters.
    Follow these guidelines for writing the story:

1. **Vocabulary and Grammar**: 
   - Use as many words as possible from the vocabulary list on the left side of the page.
   - Construct your sentences using ONLY the grammar points listed on the left side. Do not use any other grammar!!! Avoid using any grammar that is more advanced than those provided.

2. **Word Limit**:
   - Adjust the length of the story according to the level indicated on the left side of the page:
     - For "Level 1 - Easy": Limit the story to 150 words, but not less than 100. Use very simple English aimed at young esl learners.
     - For "Level 2 - Medium": Write up to 250 words, but not less than 180. Use very simple English aimed at young esl learners.
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
   - After completing the story, think of an appropriate title for the story, and add it to your output as <title>.`,
          },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64Image}` },
          },
        ],
      },
    ];

    // Send the request to OpenAI API for story generation
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    // Get the story in HTML format
    const storyHtml = response.choices[0].message.content.trim();

    // If the story generation failed, throw an error
    if (!storyHtml) {
      throw new Error('Story generation failed.');
    }

    // Convert HTML to plain text for audio narration
    const storyText = htmlToText(storyHtml, {
      wordwrap: false,
    });

    // Generate a concise prompt for DALL·E 3 based on the story
    const promptResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that creates prompts for image generation.',
        },
        {
          role: 'user',
          content: `Based on the following story, create a detailed and vivid description suitable for generating an image. Focus on positive, family-friendly elements, and avoid any disallowed content. The description should be less than 1000 characters.

Story:
${storyText}`, // Use plain text version of the story
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    let prompt = promptResponse.choices[0].message.content.trim();

    if (!prompt) {
      throw new Error('Prompt generation failed.');
    }

    // Ensure the prompt is less than 1000 characters
    if (prompt.length > 1000) {
      prompt = prompt.substring(0, 1000);
    }

    // Check the prompt with the Moderation API (optional)
    const moderationResponse = await axios.post(
      'https://api.openai.com/v1/moderations',
      { input: prompt },
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

    // Generate an image based on the prompt using DALL·E 3
    const imageResponse = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        prompt: prompt,
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

    // **MODIFIED HERE**
    // Generate audio narration for the story using plain text
    const audioUrl = await generateAudioNarration(storyText);

    // Send the story (HTML), image URL, and audio URL back to the client
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

// Function to generate audio narration using Azure Speech Service
async function generateAudioNarration(text) {
  return new Promise((resolve, reject) => {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY,
      process.env.AZURE_SPEECH_REGION
    );

    // Set the speech synthesis output format to MP3
    speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

    // Function to construct SSML with different voices based on quotation marks
    const constructSSML = (inputText) => {
      let ssml = `
        <speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xmlns:emo="http://www.w3.org/2009/10/emotionml" version="1.0" xml:lang="de-DE">
          <voice name="de-DE-SeraphinaMultilingualNeural">
            <prosody rate="-20.00%">`;
      
      // Regex to find parts of the text that are inside and outside of quotes
      const parts = inputText.split(/(".*?")/g);

      parts.forEach((part) => {
        if (part.startsWith('"') && part.endsWith('"')) {
          // Text inside quotation marks -> Use the second voice
          ssml += `
            </prosody>
            </voice>
            <voice name="de-DE-FlorianMultilingualNeural">
              <prosody rate="-20.00%">
              ${part}
            </prosody>
            </voice>
            <voice name="de-DE-SeraphinaMultilingualNeural">
              <prosody rate="-20.00%">`;
        } else {
          // Text outside quotation marks -> Use the first voice with prosody
          ssml += `${part}`;
        }
      });

      // Close the SSML tags
      ssml += `</prosody></voice></speak>`;
      return ssml;
    };

    // Generate SSML for the given text
    const ssml = constructSSML(text);

    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

    // Synthesize the SSML to generate the audio
    synthesizer.speakSsmlAsync(
      ssml,
      async (result) => {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          // Get the audio data as a buffer
          const audioBuffer = result.audioData;

          // Upload the audio to Azure Blob Storage
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


// Function to upload audio buffer to Azure Blob Storage and get a URL
async function uploadAudioToStorage(audioBuffer) {
  const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
  );
  const containerClient = blobServiceClient.getContainerClient(
    process.env.AZURE_STORAGE_CONTAINER_NAME
  );

  // Generate a unique name for the audio file
  const blobName = `audio-${Date.now()}.mp3`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  // Upload the audio buffer
  await blockBlobClient.uploadData(audioBuffer, {
    blobHTTPHeaders: { blobContentType: 'audio/mpeg' },
  });

  // Generate the URL of the uploaded audio file
  const audioUrl = blockBlobClient.url; // If the container is public
  // If the container is private, generate a SAS token or use another method to provide access

  return audioUrl;
}
