import type { PatchAlignment } from "../types/patch";

function sanitizeLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

export function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontSize: number,
  maxHeight: number,
) {
  const paragraphs = text.replace(/\r/g, "").split("\n");
  const lines: string[] = [];
  const lineHeight = fontSize * 1.2;
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let currentLine = words[0];

    for (let index = 1; index < words.length; index += 1) {
      const testLine = `${currentLine} ${words[index]}`;
      if (context.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(sanitizeLine(currentLine));
        currentLine = words[index];
      }
    }

    lines.push(sanitizeLine(currentLine));
  }

  if (lines.length <= maxLines) {
    return lines;
  }

  return lines.slice(0, maxLines).map((line, index, visibleLines) => {
    if (index !== visibleLines.length - 1) {
      return line;
    }

    let candidate = line;
    while (candidate.length > 0 && context.measureText(`${candidate}...`).width > maxWidth) {
      candidate = candidate.slice(0, -1);
    }
    return `${candidate.trimEnd()}...`;
  });
}

export function getCanvasTextX(
  context: CanvasRenderingContext2D,
  line: string,
  x: number,
  width: number,
  padding: number,
  alignment: PatchAlignment,
) {
  if (alignment === "center") {
    return x + width / 2 - context.measureText(line).width / 2;
  }

  if (alignment === "right") {
    return x + width - padding - context.measureText(line).width;
  }

  return x + padding;
}

export function splitTextLines(text: string) {
  return text.replace(/\r/g, "").split("\n");
}
