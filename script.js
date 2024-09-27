// script.js

const captureBtn = document.getElementById('capture-btn');
const uploadInput = document.getElementById('upload-input');

const storyDiv = document.getElementById('story');
const loadingDiv = document.getElementById('loading');

captureBtn.addEventListener('click', () => {
    uploadInput.click();
});

uploadInput.addEventListener('change', async () => {
    const file = uploadInput.files[0];
    if (file) {
        // Display loading message
        storyDiv.innerHTML = '';
        loadingDiv.textContent = 'Generating story and image...';

        try {
            // Convert the image to base64 and send it to the server
            const base64Image = await convertToBase64(file);
            const result = await generateStory(base64Image, file.type);
            loadingDiv.textContent = '';

            // Display the story
            const storyParagraph = document.createElement('p');
            storyParagraph.textContent = result.story || 'No story generated.';
            storyDiv.appendChild(storyParagraph);

            // Display the generated image if available
            if (result.imageUrl) {
                const generatedImage = document.createElement('img');
                generatedImage.src = result.imageUrl;
                generatedImage.alt = 'Generated Image';
                generatedImage.style.maxWidth = '100%';
                generatedImage.style.marginTop = '20px';
                storyDiv.appendChild(generatedImage);
            }

            // Create and append the Print button
            const printButton = document.createElement('button');
            printButton.textContent = 'Print';
            printButton.id = 'print-btn';
            printButton.style.marginTop = '20px';
            printButton.addEventListener('click', () => {
                window.print();
            });
            storyDiv.appendChild(printButton);

        } catch (error) {
            loadingDiv.textContent = '';
            const errorParagraph = document.createElement('p');
            errorParagraph.textContent = 'Failed to generate story and image.';
            storyDiv.appendChild(errorParagraph);
            console.error('Error:', error);
        }
    }
});

// Helper function to convert image to base64
function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // Remove the "data:image/png;base64," part to just get the raw base64 string
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
    });
}

async function generateStory(base64Image, mimeType) {
    try {
        const response = await fetch('/api/generate-story', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ base64Image, mimeType }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Unknown error');
        }

        const data = await response.json();
        return data; // Return both story and imageUrl
    } catch (error) {
        console.error('API Error:', error);
        return { story: 'An error occurred while generating the story.', imageUrl: null };
    }
}
