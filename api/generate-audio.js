function formatForSpeech(text) {
  return text
    .trim()
    .replace(/([.!?]['"]?)\n([^\n])/g, '$1\n\n$2')
    .replace(/!(\s+)([A-Z"])/g, '!... $2')
    .replace(/\. (Suddenly|But then|And then|Just then|Still|Yet)\b/g, '. — $1')
    .replace(/\b(finally|at last|drifted off|fell fast asleep|fell asleep|closed (?:his|her|their|both) eyes)\b/gi,
      (m) => `... ${m}`)
    .replace(/  +/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { text, voice } = body;

  const voiceIds = {
    mom:     process.env.VOICE_ID_MOM,
    dad:     process.env.VOICE_ID_DAD,
    grandma: process.env.VOICE_ID_GRANDMA,
    grandpa: process.env.VOICE_ID_GRANDPA,
  };

  const voiceId = voiceIds[voice];

  if (!voiceId) {
    return res.status(400).json({
      error: `No voice ID configured for "${voice}". Add VOICE_ID_${String(voice).toUpperCase()} to your Vercel environment variables.`
    });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key':   process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept':       'audio/mpeg'
        },
        body: JSON.stringify({
          text: formatForSpeech(text),
          model_id: 'eleven_turbo_v2_5',
          speed: 0.8,
          voice_settings: {
            stability:         0.45,
            similarity_boost:  0.85,
            style:             0.40,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('ElevenLabs error:', errText);
      return res.status(500).json({ error: `ElevenLabs ${response.status}: ${errText}` });
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    return res.status(200).json({ audio: base64Audio });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
