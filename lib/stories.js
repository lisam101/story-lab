// Shared helper: read the saved-story library out of Vercel Blob.
// Each saved story is two blobs: stories/<id>.mp3 and stories/<id>.json
// (the JSON sidecar holds title, voice, and the mp3's public URL).
const { list } = require('@vercel/blob');

async function listStories() {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) return [];

  const { blobs } = await list({ prefix: 'stories/' });
  const metas = blobs.filter(b => b.pathname.endsWith('.json'));

  const stories = await Promise.all(metas.map(async (b) => {
    try {
      const r = await fetch(b.url);
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }));

  return stories
    .filter(s => s && s.audioUrl && s.title)
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));   // newest first
}

module.exports = { listStories };
