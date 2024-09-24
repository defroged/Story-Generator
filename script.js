const captureBtn = document.getElementById('capture-btn');
const uploadInput = document.getElementById('upload-input');
const preview = document.getElementById('preview');
const storyDiv = document.getElementById('story');

captureBtn.addEventListener('click', () => {
    uploadInput.click();
});

uploadInput.addEventListener('change', async () => {
    const file = uploadInput.files[0];
    if (file) {
        // Display the image preview
        const reader = new FileReader();
        reader.onload = function (e) {
            preview.src = e.target.result;
        };
        reader.readAsDataURL(file);

        // Perform OCR on the image
        storyDiv.textContent = 'Processing image...';
        const text = await extractTextFromImage(file);

        // Send the extracted text to the server
        const story = await generateStory(text);
        storyDiv.textContent = story;
    }
});

async function extractTextFromImage(imageFile) {
    try {
        const {
            data: { text },
        } = await Tesseract.recognize(imageFile, 'eng', {
            logger: (m) => console.log(m),
        });
        return text;
    } catch (error) {
        console.error('OCR Error:', error);
        return '';
    }
}

async function generateStory(promptText) {
    try {
        const response = await fetch('/api/generate-story', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: promptText }),
        });
        const data = await response.json();
        return data.story || 'No story generated.';
    } catch (error) {
        console.error('API Error:', error);
        return 'An error occurred while generating the story.';
    }
}
