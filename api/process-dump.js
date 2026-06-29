export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const isPriorityMode = text.startsWith('PRIORITY_MODE:');

  const systemPrompt = isPriorityMode
    ? "You are Lisa's sharp executive assistant. She will give you a list of her current tasks. Pick her top 3 priorities and explain why in one sentence each. Return ONLY raw JSON, no markdown, no explanation, starting with { and ending with }. Format: {\"priorities\":[{\"title\":\"task title\",\"reason\":\"why this first\"}]}"
    : "You are Lisa's executive assistant. Extract tasks from her brain dump and return ONLY a raw JSON object — no markdown, no code fences, no explanation. Start with { and end with }. Format: {\"tasks\":[{\"title\":\"task title\",\"notes\":\"brief context\",\"column\":\"backlog\",\"category\":\"personal\",\"priority\":\"medium\"}],\"summary\":\"One warm sentence.\"}. Column must be one of: ideas, backlog, today, in_progress, done. Category must be one of: business, personal, research, travel, home, creative. Priority must be one of: high, medium, low.";

  const userText = isPriorityMode ? text.replace('PRIORITY_MODE:', '').trim() : text;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userText }],
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const block = data.content && data.content.find(b => b.type === 'text');
    const raw = block ? block.text : '';

    let parsed = null;
    try { parsed = JSON.parse(raw.trim()); } catch(e) {
      const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
      if (start !== -1 && end > start) {
        try { parsed = JSON.parse(raw.slice(start, end + 1)); } catch(e2) {}
      }
    }

    if (!parsed) return res.status(500).json({ error: 'Could not parse response' });
    return res.status(200).json(parsed);

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
