document.getElementById('memorial-form').addEventListener('submit', async function(event) {
    event.preventDefault();

    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'AIが物語を生成中です...';

    const formData = {
        carName: document.getElementById('car-name').value,
        carNickname: document.getElementById('car-nickname').value,
        firstMemory: document.getElementById('first-memory').value,
        memorableDrive: document.getElementById('memorable-drive').value,
        favoriteSong: document.getElementById('favorite-song').value,
        finalWords: document.getElementById('final-words').value,
    };

    try {
        const response = await fetch('/generate-story', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
        });

        if (!response.ok) { throw new Error(`Server error: ${response.statusText}`); }

        const result = await response.json();
        const storyFromServer = result.story; // This is raw HTML from the AI
        const nickname = formData.carNickname || formData.carName.split('・')[1] || formData.carName;

        // Store the raw story HTML for PDF generation
        document.body.setAttribute('data-story-html', storyFromServer);

        const photoInput = document.getElementById('car-photo');
        let filesToProcess = Array.from(photoInput.files);

        // Enforce 3-image limit also on submission, in case user bypassed change event
        if (filesToProcess.length > 3) {
            filesToProcess = filesToProcess.slice(0, 3);
        }

        const imageDataUrls = [];

        // Read all selected files as Data URLs
        const readers = filesToProcess.map(file => {
            return new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
        });

        // Wait for all files to be read
        const allImageDataUrls = await Promise.all(readers);
        imageDataUrls.push(...allImageDataUrls);

        // Store all image data URLs in a single data attribute as a JSON string
        document.body.setAttribute('data-image-urls', JSON.stringify(imageDataUrls));

        // Build the HTML for display, including all images
        let imagesHtml = '';
        if (imageDataUrls.length > 0) {
            imagesHtml = '<div id="image-gallery-display">';
            imageDataUrls.forEach(url => {
                imagesHtml += `<img class="memorial-photo" src="${url}">`;
            });
            imagesHtml += '</div>';
        }

        const storyHTML = `
            <div id="memorial-content">
                <h2 class="memorial-title">${nickname}との物語</h2>
                <p class="memorial-subtitle">君と走った道のりは、永遠に</p>
                ${imagesHtml} <!-- Insert all images here -->
                <div class="memorial-story">${storyFromServer}</div>
            </div>
        `;

        const bookContainer = document.getElementById('memorial-book-container');
        bookContainer.innerHTML = storyHTML;

        document.getElementById('input-form').classList.add('hidden');
        bookContainer.classList.remove('hidden');
        document.getElementById('download-area').classList.remove('hidden');

        bookContainer.scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        console.error('Error:', error);
        alert('物語の生成中にエラーが発生しました。サーバーが起動しているか確認してください。');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'AIにメモリアルブックの作成を依頼する';
    }
});

// Image preview logic
document.getElementById('car-photo').addEventListener('change', function() {
    const previewContainer = document.getElementById('image-preview');
    previewContainer.innerHTML = ''; // Clear previous previews

    let files = Array.from(this.files);

    // Limit to 3 files
    if (files.length > 3) {
        alert('添付できる画像は3枚までです。最初の3枚のみが選択されます。');
        files = files.slice(0, 3); // Take only the first 3 files
    }

    if (files.length === 0) {
        previewContainer.innerHTML = '<p style="color:#888; font-size:0.9em;">選択された画像はありません</p>';
        return;
    }

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            previewContainer.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
});

document.getElementById('download-pdf').addEventListener('click', async function() {
    this.disabled = true;
    this.textContent = 'PDFを生成中...';

    try {
        // Get all the raw data needed to build the PDF from scratch
        const payload = {
            title: document.querySelector('.memorial-title').textContent,
            subtitle: document.querySelector('.memorial-subtitle').textContent,
            storyHtml: document.body.getAttribute('data-story-html'),
            imageDataUrls: JSON.parse(document.body.getAttribute('data-image-urls') || '[]') // Get array of image URLs
        };

        const response = await fetch('/download-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) { throw new Error(`PDF generation failed: ${response.statusText}`); }

        const pdfBlob = await response.blob();
        const url = window.URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = '愛車メモリアルブック.pdf';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

    } catch (error) {
        console.error('PDF Download Error:', error);
        alert('PDFのダウンロードに失敗しました。');
    } finally {
        this.disabled = false;
        this.textContent = 'PDFとしてダウンロード';
    }
});
