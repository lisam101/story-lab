function formatForSpeech(text) {
  return text
    .trim()
    // Ensure double newlines between paragraphs
    .replace(/([.!?]['"]?)\n([^\n])/g, '$1\n\n$2')
    // Ellipsis after ! mid-story — dramatic pause before the next sentence
    .replace(/!(\s+)([A-Z“])/g, '!... $2')
    // Em dash before narrative pivot words within a sentence
    .replace(/\. (Suddenly|But then|And then|Just then|Still|Yet)\b/g, '. — $1')
    // Ellipsis before wind-down and sleep phrases
    .replace(/\b(finally|at last|drifted off|fell fast asleep|fell asleep|closed (?:his|her|their|both) eyes)\b/gi,
      (m) => `... ${m}`)
    // Tidy up any doubled spaces or excess blank lines
    .replace(/  +/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { text, voice } = JSON.parse(event.body || '{}');

  // Voice name → ElevenLabs Voice ID (set these as env vars in Netlify)
  const voiceIds = {
    mom:     process.env.VOICE_ID_MOM,
    dad:     process.env.VOICE_ID_DAD,
    grandma: process.env.VOICE_ID_GRANDMA,
    grandpa: process.env.VOICE_ID_GRANDPA,
  };

  const voiceId = voiceIds[voice];

  if (!voiceId) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: `No voice ID configured for "${voice}". Add VOICE_ID_${voice.toUpperCase()} to your Netlify environment variables.`
      })
    };
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
          model_id: 'eleven_turbo_v2_5',   // Better prosody and expressiveness than flash
          speed: 0.8,
          voice_settings: {
            stability:        0.45,
            similarity_boost: 0.85,
            style:            0.40,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('ElevenLabs error:', errText);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `ElevenLabs ${response.status}: ${errText}` })
      };
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: base64Audio })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error: ' + err.message })
    };
  }
};
