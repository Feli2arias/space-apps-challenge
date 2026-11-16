// Adds a spoken voice to a pixel-art demo video with ElevenLabs text to speech.
//
//   node --env-file=.env.local scripts/demo-voiceover.mjs [--film pixel-story|pixel-year|pixel-combined]
//        [--voice chris|will|jessica|george] [--force] [--measure]
//
// Each line of the script is generated once (kept in the video's `voice/` folder; --force makes
// them again), placed at its moment in the film, and mixed over the music, which is turned down
// while the voice speaks. The key is read from ELEVENLABS_API_KEY; it is never written here.
import { spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const DEMO_FOLDER = path.resolve(".context/demo");
/** Ready-made voices every plan can use, picked for sounding like a person talking, not an announcer. */
const VOICES = {
  chris: "iP95p4xoKVk53GoZ742B", // charming, down-to-earth
  will: "bIHbv24MWmeRgasZH58o", // relaxed optimist
  jessica: "cgSgspJ2msm6clMCkdW9", // playful, bright, warm
  george: "JBFqnCBsd6RMkjVDRZzb", // warm storyteller
};
const MODEL = "eleven_v4";
const VIDEO_SECONDS = 29;
/** Shortest pause kept between two lines when one runs past its moment. */
const MIN_GAP_SECONDS = 0.15;
/**
 * Each voice is played a touch faster so its lines fit their scenes; the pitch
 * does not change. Slower speakers need a little more.
 */
const TEMPO_BY_VOICE = { chris: 1.04, will: 1.09, jessica: 1.12, george: 1.08 };
/** Cuts the silence the service leaves before and after each line, so lines start on their moment. */
const TRIM =
  "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse," +
  "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse";

/**
 * What is said in each film, and the second where each line should start. Both
 * state the problem first (deciding about land without information that
 * already exists) and then what the app does about it.
 */
const FILMS = {
  // The farmer at the plot for rent, the satellites overhead, the scan.
  "pixel-story": [
    { at: 0.3, text: "Team Before the Seed." },
    { at: 2.6, text: "Renting land, buying it, or choosing what to plant: farmers often decide without the information they need." },
    { at: 9.0, text: "But that data already exists." },
    { at: 11.3, text: "Before the Seed makes it easy to reach." },
    { at: 13.8, text: "Mark your plot with coordinates, or on the map," },
    { at: 16.6, text: "and get a full report: rain, vegetation, slope, soil and temperature." },
    { at: 22.4, text: "Then compare three crop rotations before planting." },
    { at: 26.2, text: "Before the seed, know the land." },
  ],
  // One visit against the twelve months the land lives through.
  "pixel-year": [
    { at: 0.3, text: "Team Before the Seed." },
    { at: 2.4, text: "You see a plot for one day. But the land lives all year: dry months, soaked months." },
    { at: 8.6, text: "Farmers rent, buy and plant without that picture. Yet satellites already recorded it." },
    { at: 14.2, text: "Before the Seed puts it in your hands." },
    { at: 16.8, text: "Mark your plot and get a full report from NASA data." },
    { at: 21.0, text: "Then compare three rotations before planting." },
    { at: 26.2, text: "Before the seed, know the land." },
  ],
  // The year of the second film as the problem, then everything the first film shows the app doing.
  "pixel-combined": [
    { at: 0.3, text: "Team Before the Seed." },
    { at: 2.4, text: "You see a plot for one day. But the land lives all year." },
    { at: 7.6, text: "Farmers rent, buy and plant without that picture. But the data already exists." },
    { at: 13.5, text: "Before the Seed makes it easy to reach." },
    { at: 15.9, text: "Mark your plot with coordinates, or on the map," },
    { at: 18.3, text: "and get a full report: rain, vegetation, slope, soil and temperature." },
    { at: 23.6, text: "Then compare three crop rotations before planting." },
  ],
};

const args = process.argv.slice(2);
const force = args.includes("--force");
/** Only make the lines and print how long each one is; mix nothing. */
const measureOnly = args.includes("--measure");
const voiceName = args.includes("--voice") ? args[args.indexOf("--voice") + 1] : "chris";
const filmName = args.includes("--film") ? args[args.indexOf("--film") + 1] : "pixel-story";
const LINES = FILMS[filmName];
if (!LINES) {
  console.error(`Unknown film "${filmName}". Use one of: ${Object.keys(FILMS).join(", ")}.`);
  process.exit(1);
}
const FOLDER = path.join(DEMO_FOLDER, filmName);
const voiceId = VOICES[voiceName];
if (!voiceId) {
  console.error(`Unknown voice "${voiceName}". Use one of: ${Object.keys(VOICES).join(", ")}.`);
  process.exit(1);
}
const VOICE_FOLDER = path.join(FOLDER, "voice", voiceName);
const OUTPUT = path.join(FOLDER, `video-voice-${voiceName}.mp4`);

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr.slice(-600)}`);
  return result.stdout;
}

function secondsOf(file) {
  return Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]));
}

if (!process.env.ELEVENLABS_API_KEY) {
  console.error("ELEVENLABS_API_KEY is not set. Run with: node --env-file=.env.local scripts/demo-voiceover.mjs");
  process.exit(1);
}

mkdirSync(VOICE_FOLDER, { recursive: true });
const client = new ElevenLabsClient();

// 1. One audio file per line. The lines around it are passed along so the tone stays even.
for (const [index, line] of LINES.entries()) {
  const file = path.join(VOICE_FOLDER, `line-${index + 1}.mp3`);
  if (existsSync(file) && !force) continue;
  const audio = await client.textToSpeech.convert(voiceId, {
    text: line.text,
    modelId: MODEL,
    languageCode: "en",
    outputFormat: "mp3_44100_128",
    previousText: LINES[index - 1]?.text,
    nextText: LINES[index + 1]?.text,
  });
  await pipeline(Readable.fromWeb(audio), createWriteStream(file));
  console.log(`made line ${index + 1}: "${line.text}"`);
}

// 2. Where each line really starts: at its moment, or right after the line before it.
let cursor = 0;
const placed = LINES.map((line, index) => {
  const source = path.join(VOICE_FOLDER, `line-${index + 1}.mp3`);
  const file = path.join(VOICE_FOLDER, `line-${index + 1}.fit.wav`);
  run("ffmpeg", ["-y", "-loglevel", "error", "-i", source, "-af", `${TRIM},atempo=${TEMPO_BY_VOICE[voiceName]}`, file]);
  const length = secondsOf(file);
  const start = Math.max(line.at, cursor + MIN_GAP_SECONDS);
  cursor = start + length;
  return { ...line, file, length, start };
});
for (const line of placed) {
  const late = line.start - line.at;
  console.log(
    `${line.start.toFixed(2)}–${(line.start + line.length).toFixed(2)} s${late > 0.05 ? ` (starts ${late.toFixed(2)} s late)` : ""}  ${line.text}`,
  );
}
if (measureOnly) process.exit(0);
if (cursor > VIDEO_SECONDS - 0.3) {
  console.error(`The voice ends at ${cursor.toFixed(2)} s, past the end of the film. Shorten a line.`);
  process.exit(1);
}

// 3. Mix: the voice at speaking level, the music pulled down while the voice is heard.
const inputs = placed.flatMap((line) => ["-i", line.file]);
const delays = placed
  .map((line, index) => `[${index + 2}:a]adelay=${Math.round(line.start * 1000)}:all=1[v${index}]`)
  .join(";");
const voiceMix = `${placed.map((_, index) => `[v${index}]`).join("")}amix=inputs=${placed.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=7,apad=whole_dur=${VIDEO_SECONDS},asplit=2[voice][key]`;
const filter = [
  delays,
  voiceMix,
  "[1:a]volume=0.55[music]",
  "[music][key]sidechaincompress=threshold=0.02:ratio=6:attack=40:release=450[ducked]",
  `[ducked][voice]amix=inputs=2:normalize=0,alimiter=limit=0.89,afade=t=out:st=${VIDEO_SECONDS - 0.6}:d=0.6[out]`,
].join(";");
run("ffmpeg", [
  "-y", "-loglevel", "error",
  "-i", path.join(FOLDER, "video.mp4"), "-i", path.join(FOLDER, "music.wav"), ...inputs,
  "-filter_complex", filter, "-map", "0:v", "-map", "[out]",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", String(VIDEO_SECONDS), "-movflags", "+faststart", OUTPUT,
]);
console.log(`done → ${OUTPUT} (${secondsOf(OUTPUT).toFixed(3)} s)`);
