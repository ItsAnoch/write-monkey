"use server"
import words from "../lib/words.json";
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";

const MAX_SENTENCE_LENGTH = 100;

function randomWord() {
    return words[Math.floor(Math.random() * words.length)];
}

export async function randomSentence(length: number): Promise<string> {
    length = Math.min(length, MAX_SENTENCE_LENGTH);
    if (length <= 0) return "";

    const sentence = Array.from({ length }, randomWord).join(" ");
    return sentence;
}

type Quote = {
  id: number,
  quote: string,
  author: string,
}

export async function randomQuote() {
  const res = await fetch('https://dummyjson.com/quotes/random');
  const json = await res.json() as Quote;
  return json.quote;
}

const Google = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE,
    },
];

const geminiFlash = Google.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    safetySettings: safetySettings,
    generationConfig: {
        temperature: 0,
        maxOutputTokens: 1024,
        responseMimeType: "application/json"
    }
});

type TextExtractionResponse = {
  text: string,
  legibility: number,
}

export async function extractText(img: string, expectedText: string): Promise<TextExtractionResponse> {
    const ocrPrompt = `Extract the written text from the provided image without correcting any grammatical or spelling errors. Additionally, you will provide a section for the intended text to improve its legibility for easier understanding. Ensure all content remains on a single line. Don't respond with the intended text.

Include both the extracted text and an assessment of the legibility as a numerical score from 0 to 100, where:
- 0 represents completely unreadable text.
- 100 stands for perfectly legible handwriting.

# Steps

1. **Extract Text**: Identify and transcribe all written content from the image without editing any grammar or spelling. If no text is visible, keep this empty.
2. **Legibility Assessment**: Evaluate how clear or readable the handwriting is and assign a score from 0 to 100.

# Intended Text
${ expectedText }

# Output Format

Provide the output in JSON format:
- "text": A string containing the transcribed text from the image, written on a single line. If no text is visible, keep this empty.
- "legibility": A numerical value (0-100), representing how legible the text is.

Example:
\`\`\`
{
  "text": "this is what the image says with any typos included",
  "legibility": 8,
}
\`\`\`

# Notes

- The "text" string should not contain line breaks, formatting, or corrected errors. Don't respond with the intended text.
- The "legibility" score should be based solely on the ease of understanding the handwriting.`;


    const image = {
        inlineData: {
          data: img,
          mimeType: "image/png",
        },
    };

    const result = await geminiFlash.generateContent([ocrPrompt, image]);
    const text = JSON.parse(result.response.text()) as TextExtractionResponse;

    return text;
}