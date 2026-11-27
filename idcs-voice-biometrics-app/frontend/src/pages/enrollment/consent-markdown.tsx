import { Fragment, h, type ComponentChildren, type VNode } from "preact";

export interface ConsentMarkdownProps {
  readonly text: string;
}

type ConsentBlock =
  | { readonly type: "heading"; readonly level: 1 | 2 | 3; readonly text: string }
  | { readonly type: "paragraph"; readonly text: string }
  | { readonly type: "ordered-list"; readonly items: readonly string[] }
  | { readonly type: "unordered-list"; readonly items: readonly string[] };

const ORDERED_ITEM = /^\s*\d+\.\s+(.+)$/;
const UNORDERED_ITEM = /^\s*[-*]\s+(.+)$/;
const INLINE_BOLD = /\*\*(.+?)\*\*/g;

function parseBlocks(markdown: string): readonly ConsentBlock[] {
  // A correct JSON response decodes `\n` to a line feed before it reaches this component. Some
  // IAM configuration paths preserve the escape sequence itself, however, so accept that
  // provider representation too. This is deliberately limited to line endings; no general
  // backslash or HTML decoding is performed.
  const normalized = markdown
    .replace(/\r\n?/g, "\n")
    .replace(/\\r\\n|\\n|\\r/g, "\n");
  const lines = normalized.split("\n");
  const blocks: ConsentBlock[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };

  for (let index = 0; index < lines.length;) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      flushParagraph();
      index += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: (heading[1]?.length ?? 1) as 1 | 2 | 3,
        text: heading[2] ?? ""
      });
      index += 1;
      continue;
    }

    const ordered = ORDERED_ITEM.exec(line);
    const unordered = UNORDERED_ITEM.exec(line);
    if (ordered || unordered) {
      flushParagraph();
      const pattern = ordered ? ORDERED_ITEM : UNORDERED_ITEM;
      const items: string[] = [];
      while (index < lines.length) {
        const match = pattern.exec(lines[index] ?? "");
        if (!match) {
          break;
        }
        items.push(match[1] ?? "");
        index += 1;
      }
      blocks.push({ type: ordered ? "ordered-list" : "unordered-list", items });
      continue;
    }

    paragraph.push(trimmed);
    index += 1;
  }

  flushParagraph();
  return blocks;
}

function renderInline(text: string): ComponentChildren {
  const children: ComponentChildren[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  INLINE_BOLD.lastIndex = 0;
  while ((match = INLINE_BOLD.exec(text)) !== null) {
    if (match.index > cursor) {
      children.push(text.slice(cursor, match.index));
    }
    children.push(<strong key={`strong-${match.index}`}>{match[1]}</strong>);
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    children.push(text.slice(cursor));
  }
  return children.length > 0 ? children : text;
}

export function ConsentMarkdown({ text }: ConsentMarkdownProps) {
  const blocks = parseBlocks(text);
  const rendered: VNode[] = blocks.map((block, blockIndex) => {
    const key = `${block.type}-${blockIndex}`;
    if (block.type === "heading") {
      // The application page already owns h1 and the consent section owns h2. Markdown heading
      // levels are therefore nested as h3-h5 while preserving their relative visual hierarchy.
      if (block.level === 1) {
        return <h3 class="consent-heading-1" key={key}>{renderInline(block.text)}</h3>;
      }
      return block.level === 2
        ? <h4 class="consent-heading-2" key={key}>{renderInline(block.text)}</h4>
        : <h5 class="consent-heading-3" key={key}>{renderInline(block.text)}</h5>;
    }
    if (block.type === "ordered-list" || block.type === "unordered-list") {
      const items = block.items.map((item, itemIndex) => (
        <li key={`${key}-item-${itemIndex}`}>{renderInline(item)}</li>
      ));
      return block.type === "ordered-list"
        ? <ol key={key}>{items}</ol>
        : <ul key={key}>{items}</ul>;
    }
    return <p key={key}>{renderInline(block.text)}</p>;
  });

  return <Fragment>{rendered}</Fragment>;
}
