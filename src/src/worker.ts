import { createClient } from "@supabase/supabase-js";
import { sleep, slugify, countWords, clamp, safeString, formatDisplayDate } from "./utils.js";
import { researchSchema, articleSchema } from "./schemas.js";

// ==================== ENV ====================
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY!;

const SITE_BASE_URL = process.env.SITE_BASE_URL ?? "https://houses-for-sale.co.il";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 5000);
const AGENT_POLL_MS = Number(process.env.AGENT_POLL_MS ?? 2000);
const AGENT_MAX_WAIT_MS = Number(process.env.AGENT_MAX_WAIT_MS ?? 12 * 60 * 1000); // 12 minutes
const RESEARCH_CREDITS = Number(process.env.RESEARCH_CREDITS ?? 120);
const AGENT_CREDITS = Number(process.env.AGENT_CREDITS ?? 180);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FIRECRAWL_API_KEY) {
  throw new Error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIRECRAWL_API_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ==================== FIRECRAWL ====================
async function firecrawlDeepResearch(query: string) {
  const r = await fetch("https://api.firecrawl.dev/v1/deep-research", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${FIRECRAWL_API_KEY}` },
    body: JSON.stringify({
      query,
      formats: ["json"],
      jsonOptions: { schema: researchSchema },
      maxCredits: RESEARCH_CREDITS,
    }),
  });

  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Deep research failed: ${JSON.stringify(json)}`);
  return (json?.data ?? json) as any;
}

type AgentStartResponse = { success: boolean; id?: string; error?: string };
type AgentStatusResponse = {
  success: boolean;
  status?: "processing" | "completed" | "failed";
  data?: unknown;
  error?: string;
};

async function firecrawlAgentStart(prompt: string) {
  const r = await fetch("https://api.firecrawl.dev/v2/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${FIRECRAWL_API_KEY}` },
    body: JSON.stringify({ prompt, schema: articleSchema, maxCredits: AGENT_CREDITS }),
  });

  const json = (await r.json().catch(() => ({}))) as AgentStartResponse;
  if (!r.ok || !json.success || !json.id) {
    throw new Error(`Agent start failed: ${json.error ?? JSON.stringify(json)}`);
  }
  return json.id;
}

async function firecrawlAgentPoll(agentId: string) {
  const started = Date.now();
  while (true) {
    if (Date.now() - started > AGENT_MAX_WAIT_MS) throw new Error("Agent timeout");

    const r = await fetch(`https://api.firecrawl.dev/v2/agent/${agentId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}` },
    });

    const json = (await r.json().catch(() => ({}))) as AgentStatusResponse;
    if (!r.ok || !json.success) throw new Error(`Agent poll failed: ${json.error ?? JSON.stringify(json)}`);

    if (json.status === "completed") return json.data;
    if (json.status === "failed") throw new Error(`Agent failed: ${json.error ?? "unknown"}`);

    await sleep(AGENT_POLL_MS);
  }
}

// ==================== METRICS (server truth) ====================
function enforceBulletLimits(doc: any) {
  const sections: any[] = Array.isArray(doc?.content?.sections) ? doc.content.sections : [];
  const check = (items: any) => {
    if (Array.isArray(items) && items.length > 5) throw new Error("Validation: bulletPoints.items > 5");
  };
  for (const s of sections) {
    check(s?.bulletPoints?.items);
    const subs = Array.isArray(s?.subsections) ? s.subsections : [];
    for (const sub of subs) check(sub?.bulletPoints?.items);
  }
}

function computeMetrics(doc: any) {
  const introText = safeString(doc?.content?.intro?.hook);
  const introWords = countWords(introText);

  const sections: any[] = Array.isArray(doc?.content?.sections) ? doc.content.sections : [];
  const sectionWordCounts = sections.map((s) => {
    let w = 0;
    const paragraphs = Array.isArray(s?.paragraphs) ? s.paragraphs : [];
    for (const p of paragraphs) w += countWords(safeString(p?.text));
    const bpItems = s?.bulletPoints?.items;
    if (Array.isArray(bpItems)) for (const it of bpItems) w += countWords(safeString(it?.text));

    const subs = Array.isArray(s?.subsections) ? s.subsections : [];
    for (const sub of subs) {
      const subPars = Array.isArray(sub?.paragraphs) ? sub.paragraphs : [];
      for (const p of subPars) w += countWords(safeString(p?.text));
      const subItems = sub?.bulletPoints?.items;
      if (Array.isArray(subItems)) for (const it of subItems) w += countWords(safeString(it?.text));
    }
    return w;
  });

  const totalWords = introWords + sectionWordCounts.reduce((a, b) => a + b, 0);
  const readingTimeMinutes = clamp(Math.round(totalWords / 200), 1, 10);

  const h2Count = sections.filter((s) => s?.heading?.level === 2).length;
  const h3Count =
    sections.filter((s) => s?.heading?.level === 3).length +
    sections.reduce((sum, s) => sum + (Array.isArray(s?.subsections) ? s.subsections.length : 0), 0);

  const bulletListCount =
    sections.reduce((sum, s) => sum + (Array.isArray(s?.bulletPoints?.items) ? 1 : 0), 0) +
    sections.reduce((sum, s) => {
      const subs = Array.isArray(s?.subsections) ? s.subsections : [];
      return sum + subs.reduce((acc, sub) => acc + (Array.isArray(sub?.bulletPoints?.items) ? 1 : 0), 0);
    }, 0);

  const internalLinks = Array.isArray(doc?.seo?.internalLinks) ? doc.seo.internalLinks : [];
  const callToActionPresent = Boolean(doc?.content?.cta?.button?.href);

  return {
    wordCount: {
      total: totalWords,
      bySection: { intro: introWords, sections: sectionWordCounts },
      readingTimeMinutes,
    },
    structure: {
      h1Count: 1,
      h2Count,
      h3Count,
      bulletListCount,
      maxBulletItemsPerList: 5,
    },
    readability: {
      avgSentenceLength: 0,
      avgParagraphLength: 0,
      fleschKincaidGrade: 0,
    },
    engagement: {
      estimatedClicks: internalLinks.length,
      callToActionPresent,
      shareableSections: Math.min(6, Math.max(1, h2Count)),
    },
  };
}

// Condense research pack so prompts stay stable and JSON stays valid
function condenseResearchPack(pack: any) {
  const coreClaims = Array.isArray(pack?.coreClaims) ? pack.coreClaims.slice(0, 12) : [];
  const definitions = Array.isArray(pack?.definitions) ? pack.definitions.slice(0, 10) : [];
  const numbers = Array.isArray(pack?.numbers) ? pack.numbers.slice(0, 12) : [];
  const faq = Array.isArray(pack?.faq) ? pack.faq.slice(0, 10) : [];
  const sources = Array.isArray(pack?.sources) ? pack.sources.slice(0, 25) : [];
  return { coreClaims, definitions, numbers, faq, sources };
}

// ==================== MAIN LOOP ====================
async function claimJob() {
  const { data, error } = await supabase.rpc("claim_next_article_job");
  if (error) throw error;
  return data as any | null;
}

async function markFailed(jobId: string, error: string) {
  await supabase.from("article_jobs").update({ status: "failed", error, updated_at: new Date().toISOString() }).eq("id", jobId);
}

async function markCompleted(jobId: string, articleId: string) {
  await supabase.from("article_jobs").update({ status: "completed", article_id: articleId, updated_at: new Date().toISOString() }).eq("id", jobId);
}

async function runOneJob(job: any) {
  const jobId = job.id as string;
  const topic = job.topic as string;
  const primaryKeyword = job.primary_keyword as string | null;

  // Inputs / defaults (store in payload if you want)
  const language = job?.payload?.language ?? { code: "he", locale: "he-IL", direction: "rtl", isRTL: true };
  const status = job?.payload?.status ?? "draft";
  const featured = Boolean(job?.payload?.featured ?? false);
  const siteBaseUrl = job?.payload?.siteBaseUrl ?? SITE_BASE_URL;

  // 1) Deep research
  const researchQuery = primaryKeyword ? `${topic}\nPrimary keyword: ${primaryKeyword}` : topic;
  const researchPackFull = await firecrawlDeepResearch(researchQuery);
  const researchPack = condenseResearchPack(researchPackFull);

  // 2) Agent generation (STRICT schema)
  const prompt = `
Return ONE JSON object only (no markdown) matching the provided JSON Schema EXACTLY.

QUALITY & ACCURACY:
- Use ONLY facts/claims supported by the Research Pack.
- Put URLs you relied on into seo.externalLinks (real URLs only).
- Do not invent numbers or legal/financial claims. If uncertain, say so or omit.
- bulletPoints.count MUST equal bulletPoints.items.length everywhere.
- bullet lists max 5 items; aeo.speakable max 10 items.
- analytics values must be 0.
- content.tableOfContents.enabled must be true only if total wordCount > 1200.

STRUCTURE:
- title: 50-60 chars; include primary keyword naturally.
- description: 150-160 chars.
- intro.hook: direct answer in 1-3 sentences.
- 3-5 H2 sections recommended.
- Must include content.sectionsMeta (count + avgWordsPerSection).

LANGUAGE:
- Produce content in ${language.locale}
- Set language object exactly: ${JSON.stringify(language)}

INPUTS:
Topic: ${topic}
Primary keyword: ${primaryKeyword ?? ""}

RESEARCH PACK (JSON):
${JSON.stringify(researchPack)}
`;

  const agentId = await firecrawlAgentStart(prompt);

  // store agent id for debugging
  await supabase.from("article_jobs").update({ firecrawl_agent_id: agentId, updated_at: new Date().toISOString() }).eq("id", jobId);

  const rawDoc = await firecrawlAgentPoll(agentId);
  if (!rawDoc || typeof rawDoc !== "object") throw new Error("Agent returned empty/invalid data");

  const doc: any = rawDoc;

  // 3) Server-side patching (ids/dates/metrics/canonical)
  const now = new Date();
  const iso = now.toISOString();

  doc.id = crypto.randomUUID();
  doc.slug = doc.slug || slugify(doc.title || topic);
  doc.href = doc.href || `/blog/${doc.slug}`;

  doc.status = status;
  doc.featured = featured;

  doc.datePublished = doc.datePublished || iso;
  doc.dateModified = iso;
  doc.displayDate = doc.displayDate || formatDisplayDate(now, language.locale);
  doc.version = Number.isFinite(doc.version) ? doc.version : 1;

  doc.analytics = { views: 0, avgTimeOnPage: 0, bounceRate: 0, conversionRate: 0 };

  doc.content = doc.content ?? {};
  doc.content.intro = doc.content.intro ?? { hook: "", wordCount: 0 };
  doc.content.intro.wordCount = countWords(safeString(doc.content.intro.hook));

  enforceBulletLimits(doc);

  doc.metrics = computeMetrics(doc);

  doc.content.tableOfContents = doc.content.tableOfContents ?? { enabled: false, sections: [] };
  doc.content.tableOfContents.enabled = (doc.metrics.wordCount.total ?? 0) > 1200;

  const sectionsArr: any[] = Array.isArray(doc.content.sections) ? doc.content.sections : [];
  const sectionAvg =
    sectionsArr.length > 0
      ? Math.round((doc.metrics.wordCount.total - doc.metrics.wordCount.bySection.intro) / sectionsArr.length)
      : 0;
  doc.content.sectionsMeta = { count: sectionsArr.length, avgWordsPerSection: sectionAvg };

  doc.metadata = doc.metadata ?? {};
  doc.metadata.canonicalUrl = doc.metadata.canonicalUrl || `${siteBaseUrl}${doc.href}`;
  doc.metadata.ogTitle = doc.metadata.ogTitle || doc.title;
  doc.metadata.ogDescription = doc.metadata.ogDescription || doc.description;
  doc.metadata.twitterCard = doc.metadata.twitterCard || "summary_large_image";
  doc.metadata.robots = doc.metadata.robots || "index, follow";

  // 4) Store article
  const { data: articleRow, error: upsertErr } = await supabase
    .from("articles")
    .upsert(
      {
        id: doc.id,
        slug: doc.slug,
        href: doc.href,
        status: doc.status,
        featured: doc.featured,
        doc,
        updated_at: iso
      },
      { onConflict: "slug" }
    )
    .select("id")
    .single();

  if (upsertErr) throw new Error(`DB upsert failed: ${JSON.stringify(upsertErr)}`);

  await markCompleted(jobId, articleRow.id);
  console.log(`[worker] ✅ completed job=${jobId} article=${articleRow.id} slug=${doc.slug}`);
}

async function main() {
  console.log("[worker] started");

  while (true) {
    try {
      const job = await claimJob();

      if (!job || !job.id) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      console.log(`[worker] picked job=${job.id} topic=${job.topic}`);
      try {
        await runOneJob(job);
      } catch (e) {
        const msg = String(e?.message ?? e);
        console.error(`[worker] ❌ job failed job=${job.id}: ${msg}`);
        await markFailed(job.id, msg);
      }
    } catch (e) {
      console.error(`[worker] loop error: ${String(e)}`);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

main().catch((e) => {
  console.error("[worker] fatal:", e);
  process.exit(1);
});
