// Promote a freshly generated tmp/ audio blob into the permanent Echo
// library: copy the mp3 to stories/<id>.mp3 and write a JSON sidecar
// with the metadata the Alexa skill needs.
const { copy, put } = require('@vercel/blob');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'Blob storage not configured. Add a Blob store to this project in Vercel.' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { id, title, voice, tmpUrl } = body;

  if (!id || !title || !voice || !tmpUrl) {
    return res.status(400).json({ error: 'Missing id, title, voice, or tmpUrl.' });
  }

  // Only copy audio that this app itself uploaded to tmp/.
  let parsed;
  try { parsed = new URL(tmpUrl); } catch { parsed = null; }
  if (!parsed || !parsed.hostname.endsWith('.public.blob.vercel-storage.com') || !parsed.pathname.startsWith('/tmp/')) {
    return res.status(400).json({ error: 'Invalid tmpUrl.' });
  }

  try {
    const mp3 = await copy(tmpUrl, `stories/${id}.mp3`, {
      access:          'public',
      contentType:     'audio/mpeg',
      addRandomSuffix: false,
      allowOverwrite:  true
    });

    await put(`stories/${id}.json`, JSON.stringify({
      id,
      title,
      voice,
      audioUrl: mp3.url,
      savedAt:  Date.now()
    }), {
      access:             'public',
      contentType:        'application/json',
      addRandomSuffix:    false,
      allowOverwrite:     true,
      cacheControlMaxAge: 60
    });

    return res.status(200).json({ audioUrl: mp3.url });
  } catch (err) {
    console.error('save-story error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
