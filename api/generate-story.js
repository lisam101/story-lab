module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { theme, lesson } = body;
  const childName = process.env.CHILD_NAME || 'Enzo';

  if (!theme) {
    return res.status(400).json({ error: 'No theme provided.' });
  }

  const prompt = `You are a warm, imaginative children's storyteller. Write a soothing bedtime story for a 4-year-old boy named ${childName}.

Tonight's theme or character: ${theme}${lesson ? `\nStory lesson to weave in naturally (don't state it explicitly): ${lesson}` : ''}

Requirements:
- Exactly 600–650 words
- Gentle, calming tone — perfect for drifting off to sleep
- Simple language a 4-year-old can follow and enjoy
- One small, easily-resolved adventure or discovery (no scary moments)
- Include 3–4 short lines of gentle spoken dialogue between characters (e.g. "Goodnight," she said softly) — this helps the story feel alive and gives the narrator's voice natural variety
- Vary sentence length: mix short punchy sentences with longer flowing ones to create natural rhythm
- End peacefully with the main character (and ${childName}) feeling cozy, safe, and sleepy
- Do NOT include a title. Write ONLY the story text itself.

Also respond with a short title (3–6 words) for the story in this exact JSON format:
{"title": "...", "story": "..."}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':          process.env.ANTHROPIC_API_KEY,
        'anthropic-version':  '2023-06-01',
        'content-type':       'application/json'
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages:   [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic error:', data);
      return res.status(500).json({ error: 'Story generation failed. Check your ANTHROPIC_API_KEY.' });
    }

    let raw = data.content[0].text.trim();
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    try {
      const parsed = JSON.parse(raw);
      return res.status(200).json({ title: parsed.title, story: parsed.story });
    } catch (_) {
      return res.status(200).json({ title: `${theme} Story`, story: raw });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
