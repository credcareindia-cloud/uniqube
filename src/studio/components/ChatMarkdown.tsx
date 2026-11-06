import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { formatReply } from '../lib/formatReply'

export function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="chat-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ node: _node, href, children, ...props }) {
            const opensNewTab = typeof href === 'string' && /^(https?:)?\/\//i.test(href)
            return (
              <a
                {...props}
                href={href}
                target={opensNewTab ? '_blank' : undefined}
                rel={opensNewTab ? 'noopener noreferrer' : undefined}
              >
                {children}
              </a>
            )
          },
          table({ node: _node, ...props }) {
            return (
              <div className="chat-md__table">
                <table {...props} />
              </div>
            )
          },
        }}
      >
        {formatReply(text)}
      </ReactMarkdown>
    </div>
  )
}
