import OpenAI from 'openai';
import axios from 'axios';

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
      console.error("No base64 image data or MIME type found!");
      res.status(400).json({ error: 'Image file and MIME type are required.' });
      return;
    }

    // Generate the story based on the uploaded image (keep your existing code)
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: "user",
          content: `Write a short story based on the details found in the image. Follow these guidelines:

1. **Vocabulary and Grammar**: 
   - Use as many words as possible from the vocabulary list on the left side of the page.
   - Construct your sentences using only the grammar points listed on the left side. Avoid using any grammar that is more advanced than those provided.

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
   - After completing the story, think of an appropriate title for the story, and add it to your output.

By following these instructions, create a story that remains true to the student’s ideas while staying within the limits of the vocabulary, grammar, and word count provided.`
        },
        {
          role: "system",
          content: `The image is attached below.`,
        },
        {
          role: "user",
          content: "",
          name: "image",
          attachments: [
            {
              type: "image",
              data: base64Image,
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const story = response.choices[0].message.content.trim();

    // Now, generate an image based on the story using DALL·E 3
    const imageResponse = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        prompt: story,
        n: 1,
        size: '1024x1024',
        model: 'image-alpha-001', // For DALL·E 3
        // quality: 'hd', // Uncomment if you want HD quality
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    const imageUrl = imageResponse.data.data[0].url;

    res.status(200).json({ story, imageUrl });
  } catch (error) {
    console.error('OpenAI API Error:', error.response ? error.response.data : error.message);
    res.status(500).json({
      error: 'Failed to generate story or image.',
      details: error.response ? error.response.data : error.message,
    });
  }
}
