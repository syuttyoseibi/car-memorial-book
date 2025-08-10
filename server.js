require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const puppeteer = require('puppeteer');
const fs = require('fs');

const app = express();
const port = 3000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

app.post('/generate-story', async (req, res) => {
    try {
        const userInput = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});

        const prompt = `
            あなたは、長年連れ添った愛車との別れを惜しむ人のための、感動的な物語を生成する作家です。
            以下のユーザー入力を元に、温かく、少しノスタルジックで、心に響く物語を作成してください。
            ですます調の、自然で美しい日本語で記述してください。
            HTMLの<p>タグで段落を分けて、全体で3つの段落にまとめてください。
            キーワードは<span class="highlight"></span>で囲んでください。

            # ユーザー入力:
            - 車種: ${userInput.carName}
            - ニックネーム: ${userInput.carNickname || '(設定なし)'}
            - 出会い、第一印象: ${userInput.firstMemory}
            - 一番の思い出のドライブ: ${userInput.memorableDrive}
            - よく聴いた曲: ${userInput.favoriteSong || '(設定なし)'}
            - 最後の言葉: ${userInput.finalWords}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const story = response.text();

        res.json({ story: story });

    } catch (error) {
        console.error("Error generating story:", error);
        res.status(500).json({ error: 'AIによる物語の生成に失敗しました。' });
    }
});

app.post('/download-pdf', async (req, res) => {
    try {
        const { title, subtitle, storyHtml, imageDataUrls } = req.body; // Changed to imageDataUrls (plural)
        const css = fs.readFileSync('style.css', 'utf8'); // Use style.css

        // Generate multiple image tags
        let imageTagsHtml = '';
        if (imageDataUrls && imageDataUrls.length > 0) {
            imageTagsHtml = '<div id="image-gallery-display">'; // Use existing display ID
            imageDataUrls.forEach(url => {
                imageTagsHtml += `<img class="memorial-photo" src="${url}">`;
            });
            imageTagsHtml += '</div>';
        }

        const fullHtml = `
            <!DOCTYPE html>
            <html lang="ja">
            <head>
                <meta charset="UTF-8">
                <style>${css}</style>
            </head>
            <body>
                <div id="memorial-book-container">
                    <div id="memorial-content">
                        <h2 class="memorial-title">${title}</h2>
                        <p class="memorial-subtitle">${subtitle}</p>
                        ${imageTagsHtml} <!-- Insert multiple images here -->
                        <div class="memorial-story">${storyHtml}</div>
                    </div>
                </div>
            </body>
            </html>
        `;

        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(fullHtml, { waitUntil: 'load', timeout: 0 });
        const pdf = await page.pdf({
            format: 'A4', // Revert to A4 format
            printBackground: true,
            margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
        });
        await browser.close();

        res.contentType("application/pdf");
        const fileName = '愛車メモリアルブック.pdf';
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        res.send(pdf);

    } catch (error) {
        console.error("PDF Generation Error (Final Build):", error);
        res.status(500).send('PDFの生成に失敗しました。');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
