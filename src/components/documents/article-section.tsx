// 020-contractual-document — Single article section renderer

import type { Article } from '@/lib/services/contractual-document/types'

interface ArticleSectionProps {
  article: Article
}

/**
 * Renders a single article from the contractual document.
 * The content is HTML (produced by the template-builder), rendered dangerously
 * within a sandboxed context (no user input — consultant-only document generation).
 */
export function ArticleSection({ article }: ArticleSectionProps) {
  return (
    <section className="mb-8" id={`article-${article.number}`}>
      <h2 className="text-base font-bold uppercase tracking-wide border-b border-gray-400 pb-2 mb-4 text-gray-800">
        Article {article.number} &mdash; {article.title}
      </h2>
      {/* Content is server-generated HTML from template-builder (no user input) */}
      <div
        className="prose-formal text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />
    </section>
  )
}
