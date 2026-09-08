import { describe, expect, it } from "vitest";
import { getAttachmentKind, safeUploadName } from "./chatUpload";

describe("chat attachments", () => {
  it.each([
    ["image/png", "image"],
    ["audio/webm", "audio"],
    ["video/mp4", "video"],
    ["application/pdf", "document"],
    ["application/zip", "file"],
  ])("classifies %s as %s", (mimeType, expected) => {
    expect(getAttachmentKind(mimeType)).toBe(expected);
  });

  it("sanitizes uploaded filenames", () => {
    expect(safeUploadName("proposal final (v2).pdf")).toBe("proposal-final--v2-.pdf");
  });
});
