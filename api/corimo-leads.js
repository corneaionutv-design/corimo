const KLAVIYO_REVISION = process.env.KLAVIYO_REVISION || "2026-04-15";
const LEAD_TAG = "tur_casa";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ALLOW_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    return JSON.parse(req.body || "{}");
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function normalizeLead(input) {
  const email = String(input.email || "").trim().toLowerCase();
  const interest = String(input.interes_principal || "").trim();
  const timestamp = input.timestamp || new Date().toISOString();

  if (!isValidEmail(email)) {
    throw new Error("Email invalid.");
  }

  if (!interest) {
    throw new Error("Lipsește interesul principal.");
  }

  return {
    email,
    interes_principal: interest,
    tag: LEAD_TAG,
    lead_source: input.lead_source || "corimo_home_landing",
    source: input.source || input.utm_source || "direct",
    medium: input.medium || input.utm_medium || "direct",
    campaign: input.campaign || input.utm_campaign || "",
    content: input.content || input.utm_content || "",
    landing_page: input.landing_page || "",
    timestamp,
    utm_source: input.utm_source || "",
    utm_medium: input.utm_medium || "",
    utm_campaign: input.utm_campaign || "",
    utm_content: input.utm_content || "",
    utm_term: input.utm_term || "",
  };
}

async function postWebhook(lead) {
  const webhookUrl = process.env.CORIMO_LEAD_WEBHOOK_URL || process.env.LEAD_WEBHOOK_URL;

  if (!webhookUrl) {
    return null;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(lead),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Webhook error ${response.status}${details ? `: ${details}` : ""}`);
  }

  return "webhook";
}

async function importToKlaviyo(lead) {
  const privateApiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
  const listId = process.env.KLAVIYO_LIST_ID;

  if (!privateApiKey && !listId) {
    return null;
  }

  if (!privateApiKey || !listId) {
    throw new Error("Klaviyo nu este configurat complet: setează KLAVIYO_PRIVATE_API_KEY și KLAVIYO_LIST_ID.");
  }

  const properties = {
    interes_principal: lead.interes_principal,
    tag: LEAD_TAG,
    tags: [LEAD_TAG],
    lead_source: lead.lead_source,
    source: lead.source,
    medium: lead.medium,
    campaign: lead.campaign,
    content: lead.content,
    landing_page: lead.landing_page,
    timestamp: lead.timestamp,
    utm_source: lead.utm_source,
    utm_medium: lead.utm_medium,
    utm_campaign: lead.utm_campaign,
    utm_content: lead.utm_content,
    utm_term: lead.utm_term,
  };

  const klaviyoPayload = {
    data: {
      type: "profile-bulk-import-job",
      attributes: {
        profiles: {
          data: [
            {
              type: "profile",
              attributes: {
                email: lead.email,
                properties,
              },
            },
          ],
        },
      },
      relationships: {
        lists: {
          data: [
            {
              type: "list",
              id: listId,
            },
          ],
        },
      },
    },
  };

  const response = await fetch("https://a.klaviyo.com/api/profile-bulk-import-jobs/", {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${privateApiKey}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      revision: KLAVIYO_REVISION,
    },
    body: JSON.stringify(klaviyoPayload),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Klaviyo error ${response.status}${details ? `: ${details}` : ""}`);
  }

  return "klaviyo";
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Metodă neacceptată." });
    return;
  }

  try {
    const body = await parseBody(req);
    const lead = normalizeLead(body);
    const deliveries = await Promise.all([postWebhook(lead), importToKlaviyo(lead)]);
    const deliveredTo = deliveries.filter(Boolean);

    if (deliveredTo.length === 0) {
      sendJson(res, 503, {
        ok: false,
        error:
          "Nu este configurată nicio integrare. Setează CORIMO_LEAD_WEBHOOK_URL sau KLAVIYO_PRIVATE_API_KEY + KLAVIYO_LIST_ID.",
      });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      delivered_to: deliveredTo,
    });
  } catch (error) {
    sendJson(res, 400, {
      ok: false,
      error: error instanceof Error ? error.message : "Cererea nu a putut fi procesată.",
    });
  }
};
