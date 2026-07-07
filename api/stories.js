// List the Echo library (used for debugging; the Alexa skill reads the
// same data through lib/stories.js).
const { listStories } = require('../lib/stories');

module.exports = async (req, res) => {
  try {
    const stories = await listStories();
    return res.status(200).json({ stories });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
