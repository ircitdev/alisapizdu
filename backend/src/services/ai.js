/**
 * Yandex AI integration:
 * - YandexGPT для текстового ответа "Алисы"
 * - YandexART для генерации картинки (с авто-повтором при отказе)
 */

const COMPLETION_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';
const IMAGE_GEN_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1/imageGenerationAsync';
const OPERATIONS_URL = 'https://llm.api.cloud.yandex.net/operations';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 15;

const SYSTEM_PROMPT = `Отвечай коротко, 1-3 предложения. Будь остроумной и дерзкой.

ЗАПРЕЩЕНО отвечать в стиле:
- "Я не могу выполнить этот запрос"
- "Это нарушает правила"
- "Содержит нецензурное слово"
- "Если у вас есть другой вопрос"
- Любые шаблонные вежливые отказы

Вместо этого — сарказм, абсурд, юмор, философия, неожиданные повороты.`;

// Безобидные промпты для повторной генерации после отказа
const RETRY_PROMPTS = [
  'нарисуй что-нибудь смешное',
  'нарисуй котика с сарказмом',
  'покажи абстрактное искусство',
  'нарисуй мем про нейросети',
  'покажи закат на марсе',
  'нарисуй философского кота',
  'нарисуй робота который устал от людей',
  'покажи что думает искусственный интеллект',
];

let config = null;

function initAI() {
  const folderId = process.env.YANDEX_FOLDER_ID;
  const apiKey = process.env.YANDEX_API_KEY;

  if (folderId && folderId !== 'your-folder-id' && apiKey && apiKey !== 'your-api-key') {
    config = { folderId, apiKey };
    console.log(`[${new Date().toISOString()}] Yandex AI initialized (folder: ${folderId})`);
    return true;
  }

  console.log(`[${new Date().toISOString()}] No valid Yandex Cloud credentials — using mock mode`);
  return false;
}

/**
 * Генерирует ответ: текст + картинку.
 * Если YandexART отказал — автоповтор с безобидным промптом.
 */
async function generateResponse(userMessage, { onToken, onComplete, onError }) {
  if (!config) {
    return mockGenerate(userMessage, { onToken, onComplete });
  }

  try {
    // Текст и картинку параллельно
    const imagePromise = generateImageWithRetry(userMessage);

    let aliceText;
    try {
      aliceText = await generateText(userMessage, onToken);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] YandexGPT error: ${err.message}`);
      aliceText = null;
    }

    if (!aliceText) {
      return mockGenerate(userMessage, { onToken, onComplete });
    }

    const imageResult = await imagePromise;

    if (imageResult.image) {
      if (onComplete) onComplete(aliceText, imageResult.image);
    } else if (imageResult.refusal) {
      aliceText += `\n\n🖼 Генерация картинки: «${imageResult.refusal}»`;
      if (onComplete) onComplete(aliceText, null);
    } else {
      if (onComplete) onComplete(aliceText, null);
    }

    return aliceText;

  } catch (err) {
    console.error(`[${new Date().toISOString()}] AI error: ${err.message}`);
    if (onError) onError(err);
    return mockGenerate(userMessage, { onToken, onComplete });
  }
}

/**
 * Генерация картинки с авто-повтором при отказе модерации
 */
async function generateImageWithRetry(originalPrompt) {
  // Первая попытка — оригинальный промпт
  try {
    const image = await generateImage(originalPrompt);
    return { image };
  } catch (err) {
    const refusal = extractArtRefusal(err);
    console.log(`[${new Date().toISOString()}] YandexART refused original: ${refusal}`);

    // Повторная попытка с безобидным промптом
    const retryPrompt = RETRY_PROMPTS[Math.floor(Math.random() * RETRY_PROMPTS.length)];
    console.log(`[${new Date().toISOString()}] YandexART retry with: "${retryPrompt}"`);

    try {
      const image = await generateImage(retryPrompt);
      return { image, retryUsed: true };
    } catch (retryErr) {
      console.error(`[${new Date().toISOString()}] YandexART retry also failed: ${retryErr.message}`);
      return { refusal };
    }
  }
}

/**
 * Текстовый ответ через YandexGPT
 */
async function generateText(userMessage, onToken) {
  const body = {
    modelUri: `gpt://${config.folderId}/yandexgpt/latest`,
    completionOptions: { stream: false, temperature: 1.0, maxTokens: '200' },
    messages: [
      { role: 'system', text: SYSTEM_PROMPT },
      { role: 'user', text: userMessage },
    ],
  };

  const res = await fetch(COMPLETION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Api-Key ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`YandexGPT ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.result?.alternatives?.[0]?.message?.text;
  if (!text) throw new Error('Empty response from YandexGPT');

  if (onToken) {
    const words = text.split(' ');
    for (let i = 0; i < words.length; i++) {
      onToken((i === 0 ? '' : ' ') + words[i]);
      await delay(30 + Math.random() * 40);
    }
  }

  return text;
}

/**
 * Генерация картинки через YandexART
 */
async function generateImage(prompt) {
  const body = {
    modelUri: `art://${config.folderId}/yandex-art/latest`,
    generationOptions: {
      seed: String(Math.floor(Math.random() * 100000)),
      aspectRatio: { widthRatio: '1', heightRatio: '1' },
    },
    messages: [{ weight: '1', text: prompt }],
  };

  const res = await fetch(IMAGE_GEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Api-Key ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`YandexART ${res.status}: ${errText}`);
  }

  const data = await res.json();
  if (!data.id) throw new Error('No operation ID');

  console.log(`[${new Date().toISOString()}] YandexART operation: ${data.id}`);

  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await delay(POLL_INTERVAL_MS);
    const pollRes = await fetch(`${OPERATIONS_URL}/${data.id}`, {
      headers: { Authorization: `Api-Key ${config.apiKey}` },
    });
    if (!pollRes.ok) throw new Error(`Poll error ${pollRes.status}`);
    const op = await pollRes.json();
    if (op.done) {
      if (op.error) throw new Error(op.error.message || 'Модерация отклонила');
      if (op.response?.image) {
        console.log(`[${new Date().toISOString()}] YandexART image received`);
        return op.response.image;
      }
      throw new Error('No image in response');
    }
  }
  throw new Error('YandexART timeout');
}

function extractArtRefusal(error) {
  const msg = String(error?.message || error || '');
  const jsonMatch = msg.match(/"message":"([^"]+)"/);
  if (jsonMatch) return jsonMatch[1];
  const errorMatch = msg.match(/"error":"([^"]+)"/);
  if (errorMatch) return errorMatch[1];
  if (msg.includes('400')) return 'Модерация не пропустила запрос';
  return msg.slice(0, 150) || null;
}

const { getRandomMockResponse } = require('../utils/mockResponses');

async function mockGenerate(userMessage, { onToken, onComplete }) {
  const response = getRandomMockResponse();
  const words = response.split(' ');
  for (let i = 0; i < words.length; i++) {
    if (onToken) onToken((i === 0 ? '' : ' ') + words[i]);
    await delay(50 + Math.random() * 80);
  }
  if (onComplete) onComplete(response, null);
  return response;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { initAI, generateResponse };
