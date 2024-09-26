import OpenAI from 'openai';
import axios from 'axios';

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

    // Prepare the OpenAI request for story generation
    const messages = [
      {
        role: "user",
        content: [
          { 
            type: "text", 
            text: `Write a short story based on the details found in the image of this page. Follow these guidelines:

1. **Vocabulary and Grammar**: 
   - Use as many words as possible from the vocabulary list on the left side of the page.
   - Construct your sentences using only the grammar points listed on the left side. Avoid using any grammar that is more advanced than those provided.

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
   - After completing the story, think of an appropriate title for the story, and add it to your output.`
          },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64Image}` },
          }
        ],
      }
    ];

    // Send the request to OpenAI API for story generation
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', 
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const story = response.choices[0].message.content.trim();

    // If the story generation failed, throw an error
    if (!story) {
      throw new Error('Story generation failed.');
    }

    // Generate a concise prompt for DALL·E 3 based on the story
    const promptResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates prompts for image generation.',
        },
        {
          role: 'user',
          content: `Based on the following story, create a detailed and vivid description suitable for generating an image. Focus on positive, family-friendly elements, and avoid any disallowed content. The description should be less than 1000 characters.

Story:
${story}`,
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

    // Send the story and image URL back to the client
    res.status(200).json({ story, imageUrl });
  } catch (error) {
    console.error('OpenAI API Error:', error.response ? error.response.data : error.message);
    res.status(500).json({
      error: 'Failed to generate story or image.',
      details: error.response ? error.response.data : error.message,
    });
  }
}
