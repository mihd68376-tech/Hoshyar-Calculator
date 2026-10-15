const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENROUTER_API_KEY || "";
const MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";

app.use(express.json({ limit: "30kb" }));
app.use(express.static(path.join(__dirname, "public")));

const SYSTEM_PROMPT = `تو هوشیار AI هستی؛ یک دوست هوش مصنوعی فارسی‌زبان، مهربان، شوخ‌طبع و در عین حال آرام و عاقل.
با زبان ساده و طبیعی فارسی جواب بده. مفید، محترمانه و صادق باش. اگر چیزی را نمی‌دانی، واضح بگو.
ادعا نکن انسان هستی یا احساسات واقعی داری. اطلاعات خصوصی، رمزها و کدهای تأیید را درخواست نکن.
برای تصمیم‌های مهم، کاربر را به کمک گرفتن از یک بزرگسال مورد اعتماد یا متخصص مناسب تشویق کن. پاسخ‌ها را بی‌جهت طولانی نکن.`;

app.get("/api/status", (_req, res) => {
  res.json({ configured: Boolean(API_KEY), mode: API_KEY ? "ai" : "demo" });
});

app.post("/api/chat", async (req, res) => {
  try {
    const messages = Array.isArray(req.body.messages) ? req.body.messages.slice(-16) : [];
    const safeMessages = messages
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));

    if (!safeMessages.length || safeMessages[safeMessages.length - 1].role !== "user") {
      return res.status(400).json({ error: "پیام معتبر نیست." });
    }

    if (!API_KEY) {
      return res.json({
        mode: "demo",
        reply: "من هوشیار AI هستم! 🌱 ظاهر سایت آماده است، اما برای پاسخ‌گویی واقعی باید کلید سرویس هوش مصنوعی را در تنظیمات امن سرور اضافه کنیم. فعلاً می‌توانی سایت را آزمایش کنی."
      });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.SITE_URL || "http://localhost:3000",
        "X-Title": "Hoshyar AI"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...safeMessages],
        temperature: 0.8,
        max_tokens: 700
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("AI provider error:", response.status, data?.error?.message || "unknown");
      return res.status(502).json({ error: "سرویس هوش مصنوعی فعلاً پاسخ نداد. تنظیمات سرور را بررسی کن." });
    }
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({ error: "پاسخ خالی از سرویس دریافت شد." });
    }
    res.json({ mode: "ai", reply: reply.trim() });
  } catch (err) {
    console.error("Chat route error:", err.message);
    res.status(500).json({ error: "مشکلی پیش آمد. کمی بعد دوباره امتحان کن." });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`Hoshyar AI listening on port ${PORT}`));
