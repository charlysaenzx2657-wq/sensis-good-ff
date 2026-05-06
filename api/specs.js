// api/specs.js — Vercel Serverless Function
// Busca: resolución, Hz y tipo de panel
// RAM eliminada — solo los datos que necesita la calibración

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { marca, modelo } = req.body || {};
  if (!marca || !modelo) {
    return res.status(400).json({ error: "Faltan marca o modelo" });
  }

  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Sin configuración" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 80,
        system: "Eres una base de datos técnica de smartphones. Responde ÚNICAMENTE con JSON válido. Sin texto, sin markdown, sin explicaciones. Solo el JSON.",
        messages: [
          {
            role: "user",
            content: `Especificaciones reales del dispositivo: ${marca} ${modelo}\n\nResponde SOLO este JSON exacto:\n{"resW":NUMERO,"resH":NUMERO,"hz":NUMERO,"panel":"TIPO"}\n\nDonde:\n- resW = ancho en píxeles (lado menor, portrait). Ejemplo: 1080\n- resH = alto en píxeles (lado mayor, portrait). Ejemplo: 2400\n- hz = tasa de refresco máxima en Hz. Ejemplo: 90\n- panel = exactamente una de estas palabras: amoled | oled | ips | lcd\n\nReglas importantes:\n- Samsung Galaxy S/Note/Z → panel siempre "amoled"\n- Samsung Galaxy A32+ → "amoled", A03-A23 → "ips"\n- Xiaomi/Redmi Note Pro, POCO X/F → "amoled"\n- Redmi básicos (6,7,8,9,10,12C) → "ips"\n- iPhones X en adelante → "oled", iPhone 6/7/8/SE → "lcd"\n- Si no conoces el dispositivo exacto responde: {"resW":720,"resH":1600,"hz":60,"panel":"ips"}`
          }
        ]
      })
    });

    if (!response.ok) {
      return res.status(502).json({ error: "API error" });
    }

    const aiData = await response.json();
    const text = aiData?.content?.[0]?.text?.trim() || "";

    const clean = text.replace(/```json|```/g, "").trim();
    const specs = JSON.parse(clean);

    if (!specs.resW || specs.resW < 300) {
      return res.status(422).json({ error: "Specs inválidas" });
    }

    if (specs.resW > specs.resH) {
      const t = specs.resW;
      specs.resW = specs.resH;
      specs.resH = t;
    }

    const p = (specs.panel || "ips").toLowerCase().trim();
    specs.panel = p.includes("amoled") ? "amoled"
                : p.includes("oled")   ? "oled"
                : p.includes("lcd")    ? "lcd"
                : "ips";

    specs.hz = Math.min(Math.max(parseInt(specs.hz) || 60, 30), 360);

    return res.status(200).json({
      resW:  specs.resW,
      resH:  specs.resH,
      hz:    specs.hz,
      panel: specs.panel
    });

  } catch (e) {
    return res.status(500).json({ error: "Error interno" });
  }
      }
