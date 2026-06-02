exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key not configured" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { pdfBase64 } = body;
  if (!pdfBase64) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing pdfBase64 field" }) };
  }

  const prompt = `You are an expert investment analyst helping a Brazilian fintech startup called Klavi prepare for Money20/20 USA 2026.

Klavi is raising a Series B. It is the world's first Open Finance bureau — it aggregates consented bank transaction data in Brazil and sells B2B intelligence for credit risk, fraud prevention, KYC, and commercial intelligence. Key metrics: 7M+ consents, 798% user growth, 468% NRR, >70% gross margin.

The attached PDF is the official Money20/20 USA 2026 attendee/company list.

Your task:
1. Extract every company name from the PDF.
2. Identify which ones are investment funds, venture capital firms, private equity firms, or corporate VC arms.
3. For each fund identified, evaluate its fit as a Series B investor for Klavi and return a JSON array.

For each fund return exactly this structure:
{
  "name": "Fund name",
  "type": "VC / Growth Equity / Corporate VC / PE / Crowdfunding",
  "stage": "Typical stage focus e.g. Series A-C",
  "aum": "Estimated AUM e.g. ~$500M or Unknown",
  "typicalCheck": "Typical check size e.g. $10M–$50M or Unknown",
  "hq": "City, Country",
  "tags": ["fintech","data","latam","credit","growth"],
  "fitScore": 85,
  "priority": "p1 or p2 or p3",
  "why": "2-3 sentence explanation of why this fund fits or doesn't fit Klavi's Series B",
  "portfolio": "Notable relevant portfolio companies",
  "pitch": "Specific recommended pitch angle for Klavi's team",
  "excluded": false,
  "excludedReason": "",
  "excludedTag": ""
}

Tag rules:
- Only include tags from this set: fintech, data, latam, credit, growth
- fitScore: 0-100. Only funds that are good Series B fits for Klavi score above 60.
- priority: p1 = fitScore >= 85, p2 = fitScore 65-84, p3 = fitScore < 65
- For funds that are NOT a fit for Series B (wrong stage, wrong size, not institutional), still include them but set excluded: true, excludedReason to a 1-sentence explanation, and excludedTag to one of: "Too early stage" / "Too late stage" / "Not institutional VC" / "No fintech focus". Set fitScore to 0 and priority to "p3" for excluded funds.

Respond with ONLY a valid JSON array. No markdown, no explanation, no code fences. Just the raw JSON array starting with [ and ending with ].`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdfBase64
                }
              },
              {
                type: "text",
                text: prompt
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Claude API error", detail: err })
      };
    }

    const data = await response.json();
    const raw = data.content.find(b => b.type === "text")?.text || "[]";

    let funds;
    try {
      funds = JSON.parse(raw);
    } catch {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Failed to parse Claude response as JSON", raw })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ funds })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
