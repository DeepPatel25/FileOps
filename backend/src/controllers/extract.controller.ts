import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { RequestHandler } from "express";
import JSZip from "jszip";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const runFile = promisify(execFile);
const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const extractionModes = new Set(["text", "images", "pages"]);

const extractImagesWithPoppler = async (buffer: Buffer, baseName: string) => {
  const directory = await mkdtemp(join(tmpdir(), "fileflow-images-"));
  try {
    const input = join(directory, "source.pdf");
    const prefix = join(directory, "image");
    await writeFile(input, buffer);
    const { stdout } = await runFile("pdfimages", ["-list", input], {
      maxBuffer: 2 * 1024 * 1024,
    });
    const masks = new Set(
      stdout
        .split("\n")
        .map((line) => line.trim().split(/\s+/))
        .filter((columns) => columns[2] === "smask" || columns[2] === "mask")
        .map((columns) => Number(columns[1])),
    );
    await runFile("pdfimages", ["-png", input, prefix], {
      maxBuffer: 2 * 1024 * 1024,
    });
    const files = (await readdir(directory))
      .filter((name) => /^image-\d+\.png$/.test(name))
      .sort();
    const zip = new JSZip();
    let count = 0;
    for (const file of files) {
      const index = Number(file.match(/(\d+)/)?.[1]);
      if (masks.has(index)) continue;
      count += 1;
      zip.file(
        `${baseName}-image-${count}.png`,
        await readFile(join(directory, file)),
      );
    }
    return { zip, count };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

const decodeXml = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

const extractPptx = async (buffer: Buffer) => {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));

  const text: string[] = [];
  for (const [index, slideName] of slides.entries()) {
    const xml = await zip.file(slideName)?.async("string");
    const chunks = [...(xml ?? "").matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(
      (match) => decodeXml(match[1] ?? ""),
    );
    if (chunks.length) text.push(`Slide ${index + 1}\n${chunks.join("\n")}`);
  }
  return { text: text.join("\n\n"), pages: slides.length };
};

export const extractContent: RequestHandler = async (
  request,
  response,
  next,
) => {
  let parser: PDFParse | undefined;
  try {
    if (!request.file) {
      response.status(400).json({
        success: false,
        error: { message: "Please upload a PDF, DOCX, or PPTX file" },
      });
      return;
    }

    const mode = String(request.body.mode ?? "text");
    if (!extractionModes.has(mode)) {
      response.status(400).json({
        success: false,
        error: { message: "Mode must be text, images, or pages" },
      });
      return;
    }
    if (mode !== "text" && request.file.mimetype !== "application/pdf") {
      response.status(400).json({
        success: false,
        error: {
          message: "Image and page extraction currently require a PDF file",
        },
      });
      return;
    }

    let text = "";
    let pages: number | undefined;
    if (request.file.mimetype === "application/pdf") {
      parser = new PDFParse({ data: new Uint8Array(request.file.buffer) });
      const baseName =
        request.file.originalname
          .replace(/\.pdf$/i, "")
          .replace(/[^a-zA-Z0-9_-]/g, "-") || "document";
      if (mode === "images") {
        let zip: JSZip;
        let count: number;
        try {
          ({ zip, count } = await extractImagesWithPoppler(
            request.file.buffer,
            baseName,
          ));
        } catch {
          const result = await parser.getImage({
            imageThreshold: 0,
            imageDataUrl: true,
            imageBuffer: true,
          });
          zip = new JSZip();
          count = 0;
          for (const page of result.pages) {
            for (const image of page.images) {
              count += 1;
              const mime =
                image.dataUrl.match(/^data:image\/([^;]+)/)?.[1] ?? "png";
              const extension =
                mime === "jpeg"
                  ? "jpg"
                  : mime.replace(/[^a-z0-9]/g, "") || "png";
              zip.file(
                `${baseName}-page-${page.pageNumber}-image-${count}.${extension}`,
                image.data,
              );
            }
          }
        }
        if (!count) {
          response.status(422).json({
            success: false,
            error: {
              message:
                "No embedded images were found. Try “Pages as PNG” for scanned or flattened PDFs.",
            },
          });
          return;
        }
        const archive = await zip.generateAsync({
          type: "nodebuffer",
          compression: "DEFLATE",
        });
        response
          .set({
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${baseName}-images.zip"`,
            "X-Extracted-Count": String(count),
          })
          .send(archive);
        return;
      }
      if (mode === "pages") {
        const result = await parser.getScreenshot({
          scale: 1.5,
          imageDataUrl: false,
          imageBuffer: true,
        });
        const zip = new JSZip();
        result.pages.forEach((page) =>
          zip.file(`${baseName}-page-${page.pageNumber}.png`, page.data),
        );
        const archive = await zip.generateAsync({
          type: "nodebuffer",
          compression: "DEFLATE",
        });
        response
          .set({
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${baseName}-pages-png.zip"`,
            "X-Extracted-Count": String(result.pages.length),
          })
          .send(archive);
        return;
      }
      const result = await parser.getText();
      text = result.text;
      pages = result.total;
    } else if (request.file.mimetype === DOCX_MIME_TYPE) {
      const result = await mammoth.extractRawText({
        buffer: request.file.buffer,
      });
      text = result.value;
    } else {
      const result = await extractPptx(request.file.buffer);
      text = result.text;
      pages = result.pages;
    }

    const cleaned = text
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const words = cleaned ? cleaned.split(/\s+/).length : 0;
    response.json({
      success: true,
      data: {
        text: cleaned,
        words,
        characters: cleaned.length,
        pages,
        fileName: request.file.originalname,
      },
    });
  } catch (error) {
    next(error);
  } finally {
    await parser?.destroy();
  }
};
