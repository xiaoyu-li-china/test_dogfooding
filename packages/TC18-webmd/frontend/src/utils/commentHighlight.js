import { marked } from 'marked'

export const COMMENT_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote']

export function getParagraphStartRegex() {
  const tagPattern = COMMENT_TAGS.map((tag) => `<${tag}>`).join('|')
  return new RegExp(`(${tagPattern})`, 'g')
}

export function getParagraphEndRegex() {
  const tagPattern = COMMENT_TAGS.map((tag) => `</${tag}>`).join('|')
  return new RegExp(`(${tagPattern})`, 'g')
}

export function processMarkdownWithParagraphs(content, commentParagraphIds = new Set()) {
  if (!content || typeof content !== 'string') {
    return ''
  }

  const parsed = marked(content, { breaks: true })
  let paraIndex = 0

  const processed = parsed.replace(getParagraphStartRegex(), (match) => {
    const id = `para-${paraIndex}`
    const hasComment = commentParagraphIds.has(id)
    paraIndex++
    const className = hasComment
      ? ' class="commentable-paragraph has-comment"'
      : ' class="commentable-paragraph"'
    return `<span data-paragraph-id="${id}"${className}>${match}`
  })

  return processed.replace(getParagraphEndRegex(), '$1</span>')
}

export function processHtmlWithParagraphs(html, commentParagraphIds = new Set()) {
  if (!html || typeof html !== 'string') {
    return ''
  }

  let paraIndex = 0

  const processed = html.replace(getParagraphStartRegex(), (match) => {
    const id = `para-${paraIndex}`
    const hasComment = commentParagraphIds.has(id)
    paraIndex++
    const className = hasComment
      ? ' class="commentable-paragraph has-comment"'
      : ' class="commentable-paragraph"'
    return `<span data-paragraph-id="${id}"${className}>${match}`
  })

  return processed.replace(getParagraphEndRegex(), '$1</span>')
}

export function extractParagraphIdFromElement(element) {
  if (!element || !element.dataset) {
    return null
  }
  return element.dataset.paragraphId || null
}

export function getCommentParagraphIds(comments = []) {
  if (!Array.isArray(comments)) {
    return new Set()
  }
  return new Set(
    comments
      .filter((c) => c && c.paragraph_id)
      .map((c) => c.paragraph_id)
  )
}

export function hasCommentOnParagraph(paragraphId, comments = []) {
  if (!paragraphId || !Array.isArray(comments)) {
    return false
  }
  return comments.some((c) => c && c.paragraph_id === paragraphId)
}

export function splitContentIntoParagraphs(content) {
  if (!content || typeof content !== 'string') {
    return []
  }

  const lines = content.split('\n')
  const result = []
  let currentParagraph = ''

  lines.forEach((line, index) => {
    if (line.trim() === '') {
      if (currentParagraph.trim()) {
        const paraLines = currentParagraph.split('\n')
        result.push({
          id: `para-${result.length}`,
          text: currentParagraph.trim(),
          lineStart: index - paraLines.length,
          lineEnd: index - 1,
        })
        currentParagraph = ''
      }
    } else {
      currentParagraph += (currentParagraph ? '\n' : '') + line
    }
  })

  if (currentParagraph.trim()) {
    const paraLines = currentParagraph.split('\n')
    result.push({
      id: `para-${result.length}`,
      text: currentParagraph.trim(),
      lineStart: lines.length - paraLines.length,
      lineEnd: lines.length - 1,
    })
  }

  return result
}
