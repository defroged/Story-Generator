const captureBtn = document.getElementById('capture-btn');
const uploadInput = document.getElementById('upload-input');
const preview = document.getElementById('preview');
const storyDiv = document.getElementById('story');
const loadingDiv = document.getElementById('loading');

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

        // Display loading message
        storyDiv.textContent = '';
        loadingDiv.textContent = 'Generating story...';

        // Convert the image to base64 and send it to the server
        const base64Image = await convertToBase64(file);
        const story = await generateStory(base64Image, file.type);
        loadingDiv.textContent = '';
        storyDiv.textContent = story;
    }
});

// Helper function to convert image to base64
function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
}

async function generateStory(base64Image, mimeType) {
    try {
        const response = await fetch('/api/generate-story', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ base64Image, mimeType })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Unknown error');
        }

        const data = await response.json();
        return data.story || 'No story generated.';
    } catch (error) {
        console.error('API Error:', error);
        return 'An error occurred while generating the story.';
    }
}
