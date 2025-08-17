import express from "express";
import multer from "multer";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Дозволяємо запити тільки з Shopify
app.use(cors({
  origin: "https://rijrii-ui.myshopify.com"
}));

// Статика фронтенду
app.use(express.static(path.join(__dirname, "public")));

// Multer для завантаження файлів до 10 МБ
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: true,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

transporter.verify()
  .then(() => console.log("SMTP ready"))
  .catch(e => console.error("SMTP error:", e.message));

// Маршрут для форми
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { email, phone, name, city, area, comment } = req.body;
    if (!email || !phone) {
      return res.status(400).json({ ok: false, error: "Будь ласка, заповніть Email та Телефон." });
    }

    const mailText = `
Нова пропозиція від користувача:

Ім'я: ${name || "-"}
Email: ${email}
Телефон: ${phone}
Місто: ${city || "-"}
Площа приміщення: ${area || "-"}
Коментар: ${comment || "-"}
Файл: ${req.file ? req.file.originalname : "не надано"}
    `;

    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: process.env.TO_EMAIL,
      replyTo: email,
      subject: `Нова пропозиція від ${email}`,
      text: mailText,
      attachments: req.file ? [{
        filename: Buffer.from(req.file.originalname, "latin1").toString("utf8"),
        content: req.file.buffer,
        contentType: req.file.mimetype,
      }] : [],
    };

    await transporter.sendMail(mailOptions);
    res.json({ ok: true, message: "Форма успішно надіслана!" });
  } catch (err) {
    console.error(err);
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ ok: false, error: "Файл перевищує 10 МБ." });
    }
    res.status(500).json({ ok: false, error: "Не вдалося надіслати e-mail." });
  }
});

// Всі інші маршрути віддають фронтенд
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
