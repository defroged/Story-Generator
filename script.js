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
        storyDiv.innerHTML = '';
        loadingDiv.textContent = 'Extracting text from image...';

        try {
            // Step 1: Convert image to base64
            const base64Image = await convertToBase64(file);
            
            // Show loading message for generating the story
            loadingDiv.textContent = 'Generating story...';
            const result = await generateStory(base64Image, 'image/png'); // Set mimeType to 'image/png'
            
            // Clear loading message for story generation
            loadingDiv.textContent = '';

            storyDiv.innerHTML = result.story || '<p>No story generated.</p>';

            if (result.imageUrl) {
                // Show loading message for image generation
                loadingDiv.textContent = 'Generating image...';

                const generatedImage = document.createElement('img');
                generatedImage.src = result.imageUrl;
                generatedImage.alt = 'Generated Image';
                generatedImage.style.maxWidth = '100%';
                generatedImage.style.marginTop = '20px';
                storyDiv.appendChild(generatedImage);

                // Clear loading message for image generation
                loadingDiv.textContent = '';
            }

            if (result.audioUrl) {
                // Show loading message for audio narration
                loadingDiv.textContent = 'Generating audio narration...';

                const qrCodeDiv = document.createElement('div');
                qrCodeDiv.id = 'qrcode';
                qrCodeDiv.style.marginTop = '20px';
                storyDiv.appendChild(qrCodeDiv);

                const playbackPageUrl = `${window.location.origin}/audio-player.html?audioUrl=${encodeURIComponent(result.audioUrl)}`;

                new QRCode(qrCodeDiv, {
                    text: playbackPageUrl,
                    width: 128,
                    height: 128,
                });

                const qrLabel = document.createElement('p');
                qrLabel.textContent = 'Scan to listen to the story';
                qrLabel.style.textAlign = 'center';
                storyDiv.appendChild(qrLabel);

                // Clear loading message after audio narration is ready
                loadingDiv.textContent = '';
            }

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

function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const maxDimension = 1500;
                let width = img.width;
                let height = img.height;

                // Calculate the new dimensions while maintaining the aspect ratio
                if (width > height) {
                    if (width > maxDimension) {
                        height *= maxDimension / width;
                        width = maxDimension;
                    }
                } else {
                    if (height > maxDimension) {
                        width *= maxDimension / height;
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                // Draw the image onto the canvas
                ctx.drawImage(img, 0, 0, width, height);

                // Convert the canvas to a data URL in PNG format
                const dataURL = canvas.toDataURL('image/png');

                // Get the base64 string (exclude the prefix)
                const base64String = dataURL.split(',')[1];
                resolve(base64String);
            };
            img.onerror = (error) => {
                reject(error);
            };
            img.src = reader.result;
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
        return data;
    } catch (error) {
        console.error('API Error:', error);
        return {
            story: 'An error occurred while generating the story.',
            imageUrl: null,
            audioUrl: null,
        };
    }
}
