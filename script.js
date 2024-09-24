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

        // Send the image file to the server
        const story = await generateStory(file);
        loadingDiv.textContent = '';
        storyDiv.textContent = story;
    }
});

async function generateStory(imageFile) {
  try {
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await fetch('/api/generate-story', {
      method: 'POST',
      body: formData,
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

