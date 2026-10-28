import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { CopyIcon, CheckIcon } from './icons';
import { useState } from 'react';

function CopyCodeButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="code-copy"
      aria-label="Code kopieren"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* ignore */
        }
      }}
    >
      {done ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
    </button>
  );
}

function extractText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  const n = node as { props?: { children?: unknown } };
  if (n.props?.children) return extractText(n.props.children);
  return '';
}

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          [rehypeKatex, { throwOnError: false, output: 'html', strict: false }],
          [rehypeHighlight, { detect: false, ignoreMissing: true }],
        ]}
        components={{
          pre({ children, ...props }) {
            const code = extractText(children);
            return (
              <div className="code-wrap">
                <CopyCodeButton text={code} />
                <pre {...props}>{children}</pre>
              </div>
            );
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noreferrer noopener">
                {children}
              </a>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
