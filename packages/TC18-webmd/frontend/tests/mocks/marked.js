module.exports = {
  marked: function (content, options = {}) {
    if (!content || typeof content !== 'string') {
      return ''
    }

    let result = content
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')

    const paragraphs = result.split(/\n\n+/)
    result = paragraphs
      .map((p) => {
        const trimmed = p.trim()
        if (trimmed && !trimmed.startsWith('<')) {
          return `<p>${trimmed}</p>`
        }
        return p
      })
      .join('\n')

    return result
  },
}
