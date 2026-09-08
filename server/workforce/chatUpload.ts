import type { Express } from "express";
import multer from "multer";
import { createMessageAttachment } from "../db";
import { sdk } from "../_core/sdk";
import { storagePut } from "../storage";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

export function getAttachmentKind(mimeType: string): "file" | "image" | "audio" | "video" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.includes("pdf")) return "document";
  return "file";
}

export function safeUploadName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function registerChatUploadRoute(app: Express) {
  app.post("/api/chat/upload", upload.single("file"), async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!req.file) return res.status(400).json({ error: "File is required" });
      const messageId = Number(req.body.messageId);
      if (!Number.isInteger(messageId) || messageId <= 0) return res.status(400).json({ error: "messageId is required" });
      const kind = getAttachmentKind(req.file.mimetype);
      const safeName = safeUploadName(req.file.originalname);
      const stored = await storagePut(`chat/${user.id}/${messageId}/${safeName}`, req.file.buffer, req.file.mimetype);
      const attachment = await createMessageAttachment(user.id, { messageId, kind, fileName: req.file.originalname, mimeType: req.file.mimetype, fileSize: req.file.size, storageKey: stored.key, url: stored.url });
      return res.json({ attachment });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      return res.status(401).json({ error: message });
    }
  });
}
