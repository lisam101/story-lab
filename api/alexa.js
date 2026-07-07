// Alexa skill endpoint for "Story Lab".
// "Alexa, open Story Lab" plays the newest saved story; next/previous
// move through the library, and each story auto-queues the next one so
// a bedtime playlist runs start to finish.
const { listStories } = require('../lib/stories');

const VOICE_NAMES = { mom: 'Mom', dad: 'Dad', grandma: 'Grandma', grandpa: 'Grandpa' };

function speak(text, endSession = true) {
  return {
    version: '1.0',
    response: {
      outputSpeech: { type: 'PlainText', text },
      shouldEndSession: endSession
    }
  };
}

function play(story, { speech, behavior = 'REPLACE_ALL', prevToken, offset = 0 } = {}) {
  const response = {
    shouldEndSession: true,
    directives: [{
      type: 'AudioPlayer.Play',
      playBehavior: behavior,
      audioItem: {
        stream: {
          url: story.audioUrl,
          token: String(story.id),
          offsetInMilliseconds: offset,
          ...(prevToken ? { expectedPreviousToken: prevToken } : {})
        },
        metadata: {
          title: story.title,
          subtitle: `Read by ${VOICE_NAMES[story.voice] || story.voice}`
        }
      }
    }]
  };
  if (speech) response.outputSpeech = { type: 'PlainText', text: speech };
  return { version: '1.0', response };
}

function stop() {
  return {
    version: '1.0',
    response: { shouldEndSession: true, directives: [{ type: 'AudioPlayer.Stop' }] }
  };
}

function empty() {
  return { version: '1.0', response: {} };
}

function introFor(story) {
  return `Here's “${story.title}”, read by ${VOICE_NAMES[story.voice] || story.voice}.`;
}

function findByToken(stories, token) {
  return stories.findIndex(s => String(s.id) === String(token));
}

function matchStory(stories, query) {
  if (!query) return null;
  const q = query.toLowerCase();
  // Full-title match first, then any title containing a query word.
  let hit = stories.find(s => s.title.toLowerCase().includes(q));
  if (hit) return hit;
  const words = q.split(/\s+/).filter(w => w.length > 3);
  return stories.find(s => words.some(w => s.title.toLowerCase().includes(w))) || null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const request = body.request || {};

  // Only answer requests from our own skill.
  const appId = body.session?.application?.applicationId
             || body.context?.System?.application?.applicationId;
  if (process.env.ALEXA_SKILL_ID && appId !== process.env.ALEXA_SKILL_ID) {
    return res.status(403).json({ error: 'Unknown skill.' });
  }

  const type   = request.type;
  const intent = request.intent?.name;

  try {
    // ── Playback lifecycle events (no speech allowed in these) ──
    if (type === 'AudioPlayer.PlaybackNearlyFinished') {
      const stories = await listStories();
      const idx = findByToken(stories, request.token);
      const next = idx >= 0 ? stories[idx + 1] : null;
      if (!next) return res.status(200).json(empty());
      return res.status(200).json(play(next, { behavior: 'ENQUEUE', prevToken: String(request.token) }));
    }
    if (type && type.startsWith('AudioPlayer.')) {
      return res.status(200).json(empty());
    }
    if (type === 'SessionEndedRequest') {
      return res.status(200).json(empty());
    }

    const stories = await listStories();

    // ── "Alexa, open Story Lab" ──
    if (type === 'LaunchRequest') {
      if (!stories.length) {
        return res.status(200).json(speak(
          "You don't have any stories saved yet. Create one in the Story Lab app and tap the heart to send it here."
        ));
      }
      return res.status(200).json(play(stories[0], { speech: introFor(stories[0]) }));
    }

    if (type === 'IntentRequest') {
      switch (intent) {
        case 'PlayStoryIntent': {
          if (!stories.length) {
            return res.status(200).json(speak("You don't have any stories saved yet."));
          }
          const query = request.intent?.slots?.query?.value;
          const hit = matchStory(stories, query);
          if (hit) return res.status(200).json(play(hit, { speech: introFor(hit) }));
          return res.status(200).json(play(stories[0], {
            speech: `I couldn't find a story about ${query}. ${introFor(stories[0])}`
          }));
        }

        case 'AMAZON.NextIntent':
        case 'AMAZON.PreviousIntent': {
          const token = body.context?.AudioPlayer?.token;
          const idx = findByToken(stories, token);
          const step = intent === 'AMAZON.NextIntent' ? 1 : -1;
          const target = idx >= 0 ? stories[idx + step] : stories[0];
          if (!target) {
            return res.status(200).json(speak(
              step > 0 ? 'That was the last story. Sweet dreams!' : 'This is already the newest story.'
            ));
          }
          return res.status(200).json(play(target, { speech: introFor(target) }));
        }

        case 'AMAZON.ResumeIntent': {
          const token  = body.context?.AudioPlayer?.token;
          const offset = body.context?.AudioPlayer?.offsetInMilliseconds || 0;
          const idx = findByToken(stories, token);
          if (idx < 0) {
            if (!stories.length) return res.status(200).json(speak("You don't have any stories saved yet."));
            return res.status(200).json(play(stories[0], { speech: introFor(stories[0]) }));
          }
          return res.status(200).json(play(stories[idx], { offset }));
        }

        case 'AMAZON.PauseIntent':
        case 'AMAZON.StopIntent':
        case 'AMAZON.CancelIntent':
          return res.status(200).json(stop());

        case 'AMAZON.HelpIntent':
          return res.status(200).json(speak(
            'Story Lab plays bedtime stories your family saved for you. Say "open Story Lab" to hear the newest one, or "next" to skip to another story.',
            false
          ));

        default:
          return res.status(200).json(speak("Sorry, I didn't catch that. Say \"open Story Lab\" to hear a story."));
      }
    }

    return res.status(200).json(empty());
  } catch (err) {
    console.error('alexa error:', err);
    return res.status(200).json(speak('Something went wrong loading your stories. Please try again.'));
  }
};
