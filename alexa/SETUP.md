# Alexa Skill Setup — Story Lab

One-time setup, ~30 minutes. The skill stays in **development mode** forever —
it works on any Echo device signed into your Amazon account, invisible to
everyone else, and never needs Amazon's review.

## Prerequisites

- The app deployed on Vercel with a **Blob store** connected (see step 1)
- An Echo device registered to your Amazon account

## Step 1 — Vercel Blob storage

1. Go to your project on **vercel.com** → **Storage** tab → **Create Database** → **Blob**
2. Name it anything (e.g. `story-audio`) and connect it to the `story-lab` project
3. This automatically adds a `BLOB_READ_WRITE_TOKEN` environment variable
4. Redeploy (Deployments → ⋯ on the latest → Redeploy) so the functions pick it up
5. Test: open the web app, generate a story, tap ❤️ to save it — you should see
   a "✓ Sent to Echo" toast. Visit `https://<your-app>.vercel.app/api/stories`
   and confirm the story appears in the JSON.

## Step 2 — Create the skill

1. Go to **developer.amazon.com/alexa/console/ask** and sign in with the
   **same Amazon account your Echo is registered to** (this is what makes
   dev mode work on your device)
2. Click **Create Skill**
   - Name: `Story Lab`
   - Primary locale: English (US)
   - Type of experience: **Other** → Model: **Custom**
   - Hosting: **Provision your own**
   - Template: **Start from Scratch**
3. Once it opens, go to the **Build** tab

## Step 3 — Interaction model

1. In the left sidebar: **Interaction Model → JSON Editor**
2. Delete what's there and paste the contents of `interaction-model.json`
   (from this folder)
3. Click **Save Model**, then **Build Model** (takes ~1 minute)

## Step 4 — Enable audio playback

1. Left sidebar: **Interfaces**
2. Toggle ON **Audio Player**
3. Click **Save Interfaces** (rebuild the model if prompted)

## Step 5 — Point the skill at Vercel

1. Left sidebar: **Endpoint**
2. Select **HTTPS**
3. Default Region: `https://<your-app>.vercel.app/api/alexa`
4. SSL certificate type: **"My development endpoint has a certificate from a
   trusted certificate authority"**
5. Click **Save Endpoints**

## Step 6 — Lock the endpoint to your skill (recommended)

1. At the top of the Alexa console, copy **Your Skill ID**
   (looks like `amzn1.ask.skill.xxxx-xxxx`)
2. In Vercel → project → **Settings → Environment Variables**, add:
   - `ALEXA_SKILL_ID` = the skill ID you copied
3. Redeploy

## Step 7 — Test it

1. In the Alexa console, go to the **Test** tab and switch the dropdown from
   "Off" to **Development**
2. Type `open story lab` — it should announce and "play" your newest story
3. Now say to the real Echo: **"Alexa, open Story Lab"** 🎉

## What Enzo (or you) can say

| Say | What happens |
|-----|--------------|
| "Alexa, open Story Lab" | Plays the newest saved story |
| "Alexa, ask Story Lab to play the story about dinosaurs" | Finds it by title |
| "Alexa, next" | Skips to the next (older) story |
| "Alexa, pause" / "Alexa, resume" | Pauses / picks up where it left off |
| "Alexa, stop" | Stops for the night |
| (nothing) | When a story ends, the next one auto-plays |

## How stories get to the Echo

Saving a story in the web app (tapping ❤️) uploads its MP3 to Vercel Blob.
The Alexa skill reads that library. Stories saved **before** this feature
existed get uploaded automatically the first time you play them from a
playlist. Deleting a story in the app removes it from the Echo too.
