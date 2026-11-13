// Draft with AI: the editor describes a story in a chat, Claude Opus 5.5 looks up what it needs with the desk's own
// read-only tools (the same lookups Claude's connector uses) and proposes a headline, a summary and an article.
// It never saves: the editor applies the proposal to the form, and only Save writes anything.
//
// The key is the ANTHROPIC_API_KEY secret of this Worker; it never reaches the page.

import Anthropic from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import SKILL from "./skill.bundle.txt";                       // the house rules, the same file Claude's skill is made from

const MODEL = "claude-opus-5-5";
const PRICE = { input: 4, output: 20, cache_read: 0.2, cache_write: 5 };   // US$ per million tokens, Claude Opus 5.5
const json = (x) => JSON.stringify(x);
const obj = (properties = {}, required = []) => ({ type: "object", properties, required, additionalProperties: false });

const SYSTEM = `You are the drafting assistant inside the Legacy League Golf Content Studio. An editor asks you for a story in this chat.

How you work here:
- Look things up before you write: league_reference for cities, events and the course time; find_players for names; live_board for the team board; city_round to name the players behind a city's score; list_stories and get_story to see what is already published, so you do not repeat a story.
- Then call propose_draft with the headline, summary and article, and the ids of the cities, players and events the story is about. Then write one or two short sentences to the editor: what you wrote, and anything you could not check.
- You cannot save or publish. The editor applies your draft to the form, edits it and saves it.
- If the editor asks for a change, propose the whole draft again with the change made.
- A fact you could not check with the tools or did not get from the editor goes in not_verified, never into the story as fact. Never invent a quote, a number or a detail about a real person.
- The article may use only: "## " subheadings, **bold**, *italic*, [words](https://…) links, and "- " or "1. " lists, paragraphs separated by a blank line. No photos: the editor adds those.

The league's writing rules follow. They were written for Claude working through the desk connector: the parts about drafting, publishing and photo links do not apply here, everything about writing does.

${SKILL}`;

export async function draftWithAI(env, look, { messages, current }) {
  if (!env.ANTHROPIC_API_KEY) throw new Error("The desk has no Anthropic API key yet.");
  if (!Array.isArray(messages) || !messages.length || messages.length > 30) throw new Error("Send the conversation, at most 30 messages.");
  const convo = messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 12000) }))
    .filter((m) => m.content.trim());
  if (!convo.length || convo[convo.length - 1].role !== "user") throw new Error("The last message must be the editor's.");
  // what is in the form now, so "make it shorter" works on the editor's own edits too
  if (current && (current.title || current.dek || current.body))
    convo[convo.length - 1].content += `\n\n[The story form holds now]\nHeadline: ${current.title || ""}\nSummary: ${current.dek || ""}\nArticle:\n${current.body || ""}`;

  let proposal = null;
  const tools = [
    betaTool({ name: "league_reference", description: "Cities, events of the season, scoring rules and the course time the scores are at.",
      inputSchema: obj(), run: async () => json(await look.leagueReference()) }),
    betaTool({ name: "find_players", description: "Find players by name, former team, role or sport, optionally within one city.",
      inputSchema: obj({ query: { type: "string" }, city: { type: "string" } }, ["query"]),
      run: async ({ query, city }) => json(await look.findPlayers(query, city)) }),
    betaTool({ name: "live_board", description: "The team leaderboard at a course time (HH:MM on day 2; leave out for now). Scores are relative to par.",
      inputSchema: obj({ clock: { type: "string" } }), run: async ({ clock }) => json(await look.liveBoard(clock)) }),
    betaTool({ name: "city_round", description: "One city's round: each player's score, who supplied the counted scores, the team hole by hole, eagles and holes in one.",
      inputSchema: obj({ city: { type: "string" }, clock: { type: "string" }, round: { type: "integer" } }, ["city"]),
      run: async ({ city, clock, round }) => json(await look.cityRound(city, clock, round || 2)) }),
    betaTool({ name: "list_stories", description: "Stories already on the desk, newest first (status all, draft or published).",
      inputSchema: obj({ status: { type: "string" }, limit: { type: "integer" } }), run: async ({ status, limit }) => json(await look.listStories(status || "all", limit || 20)) }),
    betaTool({ name: "get_story", description: "One story in full.", inputSchema: obj({ id: { type: "string" } }, ["id"]),
      run: async ({ id }) => json(await look.getStory(id)) }),
    betaTool({
      name: "propose_draft", strict: true,
      description: "Show the editor a draft: headline, summary (dek), article (body), and the ids of the cities, players and events it is about. It is not saved.",
      inputSchema: obj({
        title: { type: "string" }, dek: { type: "string" }, body: { type: "string" },
        cities: { type: "array", items: { type: "string" } }, players: { type: "array", items: { type: "string" } },
        events: { type: "array", items: { type: "string" } }, not_verified: { type: "array", items: { type: "string" } },
      }, ["title", "dek", "body", "cities", "players", "events", "not_verified"]),
      run: async (draft) => { proposal = draft; return "Shown to the editor. They decide whether to apply it."; },
    }),
  ];

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const runner = client.beta.messages.toolRunner({
    model: MODEL, max_tokens: 16000, max_iterations: 12,
    output_config: { effort: "medium" },
    cache_control: { type: "ephemeral" },                   // the rules and tools are the same every time
    betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    system: SYSTEM, tools, messages: convo,
  });
  const used = { input: 0, output: 0, cache_read: 0, cache_write: 0 };
  let last = null;
  for await (const message of runner) {
    last = message;
    const u = message.usage || {};
    used.input += u.input_tokens || 0; used.output += u.output_tokens || 0;
    used.cache_read += u.cache_read_input_tokens || 0; used.cache_write += u.cache_creation_input_tokens || 0;
  }
  const cost = Object.keys(PRICE).reduce((a, k) => a + used[k] * PRICE[k] / 1e6, 0);
  let reply = last ? last.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim() : "";
  if (last && last.stop_reason === "refusal") reply = "The model declined this request. Try describing the story differently.";
  if (!reply) reply = proposal ? "Here is a draft." : "No draft this time. Try saying more about the story.";
  return { reply, proposal, usage: used, cost: Math.round(cost * 10000) / 10000, model: last ? last.model : MODEL };
}

/* The API's own errors, in words an editor can act on. */
export function aiError(e) {
  if (e instanceof Anthropic.RateLimitError) return [429, "Too many requests to the AI just now. Wait a minute and try again."];
  if (e instanceof Anthropic.AuthenticationError) return [502, "The desk's Anthropic API key was refused. It needs replacing."];
  if (e instanceof Anthropic.APIConnectionError) return [502, "Could not reach the AI service. Try again."];
  if (e instanceof Anthropic.APIError) return [502, `The AI service answered with an error (${e.status || "?"}). Try again.`];
  return [400, String(e.message || e)];
}

/* ------------------------------------------------------------------ photo descriptions */

/* A suggested description for a library photo: Claude Opus 5.5 looks at the picture and writes the alt text an editor
   then accepts, edits or ignores. It never names a person from their face: who is in a photo is the editor's call. */
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

const DESCRIBE = `You write the description (alt text) of a photo for the Legacy League Golf website, a golf league of retired professional athletes playing for their cities.
Write one sentence, at most 25 words, saying what the photo shows for someone who cannot see it: the scene, the action, the setting, what stands out. Start with the subject, not "A photo of" or "An image of".
Never name a person or guess who they are from how they look. Use "a golfer", "four players", "a caddie". If the context below names someone and nothing in the picture contradicts it, you still do not name them: the editor adds names.
Also give search_terms: five to eight single words or short phrases someone might search for to find this photo (hole, bunker, green, crowd, celebration, course, sky...).`;

export async function describePhoto(env, { bytes, mediaType, context }) {
  if (!env.ANTHROPIC_API_KEY) throw new Error("The desk has no Anthropic API key yet.");
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  let b64 = "";
  const u8 = new Uint8Array(bytes);
  for (let i = 0; i < u8.length; i += 0x8000) b64 += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  b64 = btoa(b64);
  const res = await client.messages.parse({
    model: MODEL, max_tokens: 4000,
    output_config: { effort: "low", format: jsonSchemaOutputFormat(obj({ description: { type: "string" }, search_terms: { type: "array", items: { type: "string" } } }, ["description", "search_terms"])) },
    system: DESCRIBE,
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
      { type: "text", text: context ? `Context, for the setting only: ${context}` : "No context." },
    ] }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("No description could be suggested for this photo.");
  const u = res.usage || {};
  const cost = ((u.input_tokens || 0) * PRICE.input + (u.output_tokens || 0) * PRICE.output + (u.cache_read_input_tokens || 0) * PRICE.cache_read + (u.cache_creation_input_tokens || 0) * PRICE.cache_write) / 1e6;
  return { alt: res.parsed_output.description.trim(), terms: res.parsed_output.search_terms.slice(0, 10), model: res.model,
           usage: { input: u.input_tokens || 0, output: u.output_tokens || 0, cache_read: u.cache_read_input_tokens || 0, cache_write: u.cache_creation_input_tokens || 0 },
           cost: Math.round(cost * 10000) / 10000 };
}
