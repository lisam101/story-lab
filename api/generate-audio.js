const { put, list, del } = require('@vercel/blob');

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

// Freshly generated audio lands in tmp/ until the user saves the story;
// anything older than a day gets swept out here.
async function cleanupTmp() {
  try {
    const { blobs } = await list({ prefix: 'tmp/' });
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const old = blobs.filter(b => new Date(b.uploadedAt).getTime() < dayAgo).map(b => b.url);
    if (old.length) await del(old);
  } catch (e) {
    console.error('tmp cleanup failed:', e);
  }
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

    // Preferred path: upload to Blob and return a URL (small response,
    // and saving the story to the Echo library becomes a cheap copy).
    // Blob auth is either a classic token or OIDC (BLOB_STORE_ID + runtime token).
    let blobError = null;
    if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
      try {
        await cleanupTmp();
        const blob = await put(`tmp/${Date.now()}.mp3`, Buffer.from(audioBuffer), {
          access:          'public',
          contentType:     'audio/mpeg',
          addRandomSuffix: false
        });
        return res.status(200).json({ url: blob.url });
      } catch (e) {
        console.error('Blob upload failed, falling back to base64:', e);
        blobError = e.message;
      }
    }

    // Fallback (Blob store not configured): return audio inline.
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    return res.status(200).json({ audio: base64Audio, blobError });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
