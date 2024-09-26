import OpenAI from 'openai';

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

    // Prepare the OpenAI request
    const messages = [
  {
    role: "user",
    content: [
      { 
        type: "text", text: `Write a short story based on the details found in the image of this page. When crafting the story, follow these guidelines:
        
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
		   - After completing the story, think of an appropriate title for the story, and add it to your output.

        By following these instructions, create a story that remains true to the student’s ideas while staying within the limits of the vocabulary, grammar, and word count provided.`
      },
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