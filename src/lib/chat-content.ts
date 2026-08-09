/**
 * Assistant text arrives as a serialized content block, not bare text.
 *
 * A text part's payload decodes to something like:
 *
 *     {"text":"\n\nHi there! How can I help you today? 😊","type":"text"}
 *
 * `normalizeContent` returns strings verbatim, so without unwrapping, the chat
 * renders that JSON envelope to the user instead of the message inside it.
 *
 * Providers also return an array of blocks when a reply is split, so both a
 * single object and an array are handled. Anything that is not a recognisable
 * content block is returned untouched — a plain-text payload must survive, and
 * so must JSON that a user legitimately asked the assistant to produce.
 */

interface TextBlock {
  type: string;
  text: string;
}

function isTextBlock(value: unknown): value is TextBlock {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "text" &&
    typeof (value as { text?: unknown }).text === "string"
  );
}

/** Extract the text from a content-block payload, or return `raw` unchanged. */
export function unwrapContentBlocks(raw: string): string {
  const trimmed = raw.trim();
  // Cheap guard: only attempt a parse on something shaped like JSON.
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return raw;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return raw;
  }

  const blocks = Array.isArray(parsed) ? parsed : [parsed];
  const texts = blocks.filter(isTextBlock).map((b) => b.text);

  // Only rewrite when every block was a text block; a mixed or unrecognised
  // payload is more useful shown raw than silently reduced.
  if (texts.length === 0 || texts.length !== blocks.length) return raw;

  return texts.join("");
}
