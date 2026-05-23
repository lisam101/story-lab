exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { theme } = JSON.parse(event.body || '{}');
  const childName = process.env.CHILD_NAME || 'Enzo';

  if (!theme) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No theme provided.' }) };
  }

  const prompt = `You are a warm, imaginative children's storyteller. Write a soothing bedtime story for a 4-year-old boy named ${childName}.

Tonight's theme or character: ${theme}

Requirements:
- Exactly 600–650 words
- Gentle, calming tone — perfect for drifting off to sleep
- Simple language a 4-year-old can follow and enjoy
- One small, easily-resolved adventure or discovery (no scary moments)
- End peacefully with the main character (and ${childName}) feeling cozy, safe, and sleepy
- Do NOT include a title. Write ONLY the story text itself.

Also respond with a short title (3–6 words) for the story in this exact JSON format:
{"title": "...", "story": "..."}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic error:', data);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Story generation failed. Check your ANTHROPIC_API_KEY.' })
      };
    }

    let raw = data.content[0].text.trim();

    // Strip markdown code fences if Claude wraps the JSON in ```json ... ```
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    // Try to parse JSON response; fall back gracefully
    try {
      const parsed = JSON.parse(raw);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: parsed.title, story: parsed.story })
      };
    } catch (_) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `${theme} Story`, story: raw })
      };
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error: ' + err.message })
    };
  }
};
