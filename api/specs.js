// api/specs.js — Vercel Serverless Function
// La API key de Anthropic vive SOLO aquí, nunca llega al navegador
// Modelo: claude-haiku-4-5 — el más rápido (~300-500ms)

export default async function handler(req, res) {
  // Solo POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { marca, modelo } = req.body || {};
  if (!marca || !modelo) {
    return res.status(400).json({ error: "Faltan marca o modelo" });
  }

  // Key desde variable de entorno Vercel — nunca en el código
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
        max_tokens: 120,
        system: "Eres una base de datos de especificaciones de dispositivos móviles. Responde SOLO con JSON válido, sin texto adicional, sin markdown, sin explicaciones.",
        messages: [
          {
            role: "user",
            content: `Dame las especificaciones reales de: ${marca} ${modelo}
Responde ÚNICAMENTE este JSON (sin nada más):
{"resW":ANCHO_PIXELES,"resH":ALTO_PIXELES,"hz":HZ_PANTALLA,"panel":"amoled|oled|ips|lcd","ram":GB_RAM}

Reglas:
- resW = dimensión menor en píxeles (ancho en portrait)
- resH = dimensión mayor en píxeles
- hz = tasa de refresco máxima real
- panel = tipo exacto del panel
- ram = RAM máxima disponible en GB
- Si no conoces el dispositivo, usa: {"resW":720,"resH":1600,"hz":60,"panel":"ips","ram":4}`
          }
        ]
      })
    });

    if (!response.ok) {
      return res.status(502).json({ error: "API error" });
    }

    const aiData = await response.json();
    const text = aiData?.content?.[0]?.text?.trim() || "";

    // Parsear JSON limpiando posibles backticks
    const clean = text.replace(/```json|```/g, "").trim();
    const specs = JSON.parse(clean);

    // Validar campos mínimos
    if (!specs.resW || specs.resW < 300) {
      return res.status(422).json({ error: "Specs inválidas" });
    }

    // Asegurar que resW sea el lado menor (ancho portrait)
    if (specs.resW > specs.resH) {
      const t = specs.resW;
      specs.resW = specs.resH;
      specs.resH = t;
    }

    // Normalizar panel
    const p = (specs.panel || "ips").toLowerCase();
    specs.panel = p.includes("amoled") ? "amoled"
                : p.includes("oled")   ? "oled"
                : p.includes("lcd")    ? "lcd"
                : "ips";

    // Clamp valores sensatos
    specs.hz  = Math.min(Math.max(specs.hz  || 60,  30), 360);
    specs.ram = Math.min(Math.max(specs.ram || 4,    1),  24);

    return res.status(200).json(specs);

  } catch (e) {
    return res.status(500).json({ error: "Error interno" });
  }
        }
