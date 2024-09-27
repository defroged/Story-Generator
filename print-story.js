<script>
  async function generateStoryAndPrint(base64Image, mimeType) {
    const response = await fetch('/api/generate-story', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Image: base64Image,
        mimeType: mimeType
      }),
    });

    const data = await response.json();
    if (response.ok) {
      const printWindow = window.open('', '', 'height=600,width=800');
      printWindow.document.write(data.printHTML);
      printWindow.document.close();
      printWindow.onload = function () {
        printWindow.print();
        printWindow.close();
      };
    } else {
      console.error('Error generating story:', data.error);
    }
  }

  // Example usage: Pass the base64 image and MIME type to the function
  // generateStoryAndPrint(base64Image, mimeType);
</script>
