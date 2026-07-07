// Remove a story's mp3 + metadata from the Echo library in Blob storage.
const { list, del } = require('@vercel/blob');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(200).json({ ok: true });   // nothing stored, nothing to delete
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const id = String(body.id || '');

  // ids are Date.now() timestamps — refuse anything else so a malformed
  // id can't match (and delete) other stories by prefix.
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid id.' });
  }

  try {
    const { blobs } = await list({ prefix: `stories/${id}.` });
    if (blobs.length) await del(blobs.map(b => b.url));
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('delete-story error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
