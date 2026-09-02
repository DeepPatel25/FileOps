import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt";

const readBoolean = (value: unknown, fallback: boolean) =>
  value === undefined ? fallback : value === "true";

export const protectPdf: RequestHandler = async (request, response, next) => {
  try {
    if (!request.file) {
      response
        .status(400)
        .json({
          success: false,
          error: { message: "Please upload a PDF file" },
        });
      return;
    }
    const password = String(request.body.password ?? "");
    if (password.length < 6 || password.length > 128) {
      response
        .status(400)
        .json({
          success: false,
          error: {
            message: "Password must contain between 6 and 128 characters",
          },
        });
      return;
    }

    const encrypted = await encryptPDF(
      new Uint8Array(request.file.buffer),
      password,
      {
        algorithm: "AES-256",
        ownerPassword: randomBytes(32).toString("base64url"),
        allowPrinting: readBoolean(request.body.allowPrinting, true),
        allowCopying: readBoolean(request.body.allowCopying, false),
        allowModifying: readBoolean(request.body.allowModifying, false),
        allowAnnotating: false,
        allowFillingForms: true,
        allowExtraction: true,
        allowAssembly: false,
        allowHighQualityPrint: readBoolean(request.body.allowPrinting, true),
      },
    );

    const baseName =
      request.file.originalname
        .replace(/\.pdf$/i, "")
        .replace(/[^a-zA-Z0-9_-]/g, "-") || "document";
    response
      .set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}-protected.pdf"`,
        "Content-Length": String(encrypted.length),
        "X-Encryption": "AES-256",
      })
      .send(Buffer.from(encrypted));
  } catch (error) {
    next(error);
  }
};
