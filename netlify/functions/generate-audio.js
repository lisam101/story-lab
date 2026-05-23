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
          text,
          model_id: 'eleven_flash_v2_5',   // Fastest ElevenLabs model — stays well within timeout
          voice_settings: {
            stability:        0.70,
            similarity_boost: 0.85,
            style:            0.10,
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
