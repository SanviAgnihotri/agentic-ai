import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("md-prose", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // Authored deliverables use `#` for titles; demote to h2 so rendered
        // markdown never competes with the page's h1 or skips a level.
        components={{
          h1: (props) => <h2 {...props} />,
          h2: (props) => <h3 {...props} />,
          h3: (props) => <h4 {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
