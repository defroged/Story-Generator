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
        loadingDiv.textContent = 'Generating story and image...';

        try {
            const base64Image = await convertToBase64(file);
            const result = await generateStory(base64Image, file.type);
            loadingDiv.textContent = '';

            storyDiv.innerHTML = result.story || '<p>No story generated.</p>';

            if (result.imageUrl) {
                const generatedImage = document.createElement('img');
                generatedImage.src = result.imageUrl;
                generatedImage.alt = 'Generated Image';
                generatedImage.style.maxWidth = '100%';
                generatedImage.style.marginTop = '20px';
                storyDiv.appendChild(generatedImage);
            }

            if (result.audioUrl) {
                const qrCodeDiv = document.createElement('div');
                qrCodeDiv.id = 'qrcode';
                qrCodeDiv.style.marginTop = '20px';
                storyDiv.appendChild(qrCodeDiv);

                new QRCode(qrCodeDiv, {
                    text: result.audioUrl,
                    width: 128,
                    height: 128,
                });

                const qrLabel = document.createElement('p');
                qrLabel.textContent = 'Scan to listen to the story';
                qrLabel.style.textAlign = 'center';
                storyDiv.appendChild(qrLabel);
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
