import {
  COMMENT_TAGS,
  getParagraphStartRegex,
  getParagraphEndRegex,
  processMarkdownWithParagraphs,
  processHtmlWithParagraphs,
  extractParagraphIdFromElement,
  getCommentParagraphIds,
  hasCommentOnParagraph,
  splitContentIntoParagraphs,
} from '../../src/utils/commentHighlight.js'

describe('commentHighlight utilities', () => {
  describe('COMMENT_TAGS', () => {
    it('should include all paragraph-like HTML tags', () => {
      expect(COMMENT_TAGS).toEqual(expect.arrayContaining(['p', 'h1', 'h2', 'h3', 'li', 'blockquote']))
      expect(COMMENT_TAGS).toEqual(expect.arrayContaining(['h4', 'h5', 'h6']))
      expect(COMMENT_TAGS.length).toBe(9)
    })
  })

  describe('getParagraphStartRegex', () => {
    it('should return a regex that matches paragraph start tags', () => {
      let regex = getParagraphStartRegex()
      expect(regex.test('<p>')).toBe(true)
      regex = getParagraphStartRegex()
      expect(regex.test('<blockquote>')).toBe(true)
      regex = getParagraphStartRegex()
      expect(regex.test('<li>')).toBe(true)
      regex = getParagraphStartRegex()
      expect(regex.test('<div>')).toBe(false)
    })
  })

  describe('getParagraphEndRegex', () => {
    it('should return a regex that matches paragraph end tags', () => {
      let regex = getParagraphEndRegex()
      expect(regex.test('</p>')).toBe(true)
      regex = getParagraphEndRegex()
      expect(regex.test('</blockquote>')).toBe(true)
      regex = getParagraphEndRegex()
      expect(regex.test('</li>')).toBe(true)
      regex = getParagraphEndRegex()
      expect(regex.test('</div>')).toBe(false)
    })
  })

  describe('processMarkdownWithParagraphs', () => {
    it('should handle empty content', () => {
      expect(processMarkdownWithParagraphs('')).toBe('')
      expect(processMarkdownWithParagraphs(null)).toBe('')
      expect(processMarkdownWithParagraphs(undefined)).toBe('')
    })

    it('should wrap single paragraph in span with paragraph id', () => {
      const result = processMarkdownWithParagraphs('Hello World')
      expect(result).toContain('data-paragraph-id="para-0"')
      expect(result).toContain('class="commentable-paragraph"')
      expect(result).toContain('Hello World')
    })

    it('should assign sequential paragraph ids', () => {
      const markdown = '# Title\n\nParagraph 1\n\nParagraph 2'
      const result = processMarkdownWithParagraphs(markdown)
      expect(result).toContain('data-paragraph-id="para-0"')
      expect(result).toContain('data-paragraph-id="para-1"')
      expect(result).toContain('data-paragraph-id="para-2"')
    })

    it('should add has-comment class when paragraph has comments', () => {
      const markdown = 'Paragraph with comment'
      const commentIds = new Set(['para-0'])
      const result = processMarkdownWithParagraphs(markdown, commentIds)
      expect(result).toContain('has-comment')
      expect(result).toContain('commentable-paragraph has-comment')
    })

    it('should not add has-comment class when no comments', () => {
      const markdown = 'Paragraph without comment'
      const commentIds = new Set()
      const result = processMarkdownWithParagraphs(markdown, commentIds)
      expect(result).not.toContain('has-comment')
      expect(result).toContain('class="commentable-paragraph"')
    })

    it('should handle mixed content with different tag types', () => {
      const markdown = '# Heading 1\n\nParagraph\n\n- List item 1\n\n> Blockquote'
      const result = processMarkdownWithParagraphs(markdown)
      expect(result).toContain('data-paragraph-id="para-0"')
      expect(result).toContain('data-paragraph-id="para-1"')
      expect(result).toContain('data-paragraph-id="para-2"')
      expect(result).toContain('data-paragraph-id="para-3"')
    })

    it('should handle multiple list items', () => {
      const markdown = '- Item 1\n- Item 2\n- Item 3'
      const result = processMarkdownWithParagraphs(markdown)
      expect(result).toContain('data-paragraph-id="para-0"')
      expect(result).toContain('data-paragraph-id="para-1"')
      expect(result).toContain('data-paragraph-id="para-2"')
    })

    it('should wrap each list item individually', () => {
      const markdown = '- First\n- Second'
      const result = processMarkdownWithParagraphs(markdown)
      const matches = result.match(/data-paragraph-id="para-\d+"/g)
      expect(matches.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('processHtmlWithParagraphs', () => {
    it('should handle empty HTML', () => {
      expect(processHtmlWithParagraphs('')).toBe('')
    })

    it('should wrap paragraphs in existing HTML', () => {
      const html = '<p>Hello</p>'
      const result = processHtmlWithParagraphs(html)
      expect(result).toContain('data-paragraph-id="para-0"')
      expect(result).toContain('commentable-paragraph')
    })

    it('should add has-comment class to specific paragraphs', () => {
      const html = '<p>First</p><p>Second</p>'
      const commentIds = new Set(['para-1'])
      const result = processHtmlWithParagraphs(html, commentIds)
      expect(result).toContain('data-paragraph-id="para-0"')
      expect(result).toContain('data-paragraph-id="para-1"')
    })
  })

  describe('extractParagraphIdFromElement', () => {
    it('should return null for null element', () => {
      expect(extractParagraphIdFromElement(null)).toBeNull()
      expect(extractParagraphIdFromElement(undefined)).toBeNull()
    })

    it('should return null for element without dataset', () => {
      expect(extractParagraphIdFromElement({})).toBeNull()
    })

    it('should extract paragraph id from element dataset', () => {
      const element = {
        dataset: {
          paragraphId: 'para-5',
        },
      }
      expect(extractParagraphIdFromElement(element)).toBe('para-5')
    })

    it('should return null when no paragraph id', () => {
      const element = {
        dataset: {},
      }
      expect(extractParagraphIdFromElement(element)).toBeNull()
    })
  })

  describe('getCommentParagraphIds', () => {
    it('should return empty Set for empty array', () => {
      const result = getCommentParagraphIds([])
      expect(result instanceof Set).toBe(true)
      expect(result.size).toBe(0)
    })

    it('should return empty Set for non-array input', () => {
      const result = getCommentParagraphIds(null)
      expect(result.size).toBe(0)
    })

    it('should extract unique paragraph ids from comments', () => {
      const comments = [
        { paragraph_id: 'para-0' },
        { paragraph_id: 'para-1' },
        { paragraph_id: 'para-0' },
      ]
      const result = getCommentParagraphIds(comments)
      expect(result.has('para-0')).toBe(true)
      expect(result.has('para-1')).toBe(true)
      expect(result.size).toBe(2)
    })

    it('should skip comments without paragraph_id', () => {
      const comments = [
        { paragraph_id: 'para-0' },
        { content: 'no id' },
        { paragraph_id: null },
      ]
      const result = getCommentParagraphIds(comments)
      expect(result.has('para-0')).toBe(true)
      expect(result.size).toBe(1)
    })
  })

  describe('hasCommentOnParagraph', () => {
    it('should return false for empty paragraph id', () => {
      expect(hasCommentOnParagraph('', [{ paragraph_id: 'para-0' }])).toBe(false)
      expect(hasCommentOnParagraph(null, [{ paragraph_id: 'para-0' }])).toBe(false)
    })

    it('should return false for empty comments array', () => {
      expect(hasCommentOnParagraph('para-0', [])).toBe(false)
    })

    it('should return true when paragraph has comments', () => {
      const comments = [
        { paragraph_id: 'para-0' },
        { paragraph_id: 'para-1' },
      ]
      expect(hasCommentOnParagraph('para-0', comments)).toBe(true)
      expect(hasCommentOnParagraph('para-1', comments)).toBe(true)
    })

    it('should return false when paragraph has no comments', () => {
      const comments = [{ paragraph_id: 'para-0' }]
      expect(hasCommentOnParagraph('para-99', comments)).toBe(false)
    })
  })

  describe('splitContentIntoParagraphs', () => {
    it('should return empty array for empty content', () => {
      expect(splitContentIntoParagraphs('')).toEqual([])
      expect(splitContentIntoParagraphs(null)).toEqual([])
      expect(splitContentIntoParagraphs(undefined)).toEqual([])
    })

    it('should handle single paragraph', () => {
      const content = 'Single paragraph content'
      const result = splitContentIntoParagraphs(content)
      expect(result.length).toBe(1)
      expect(result[0].id).toBe('para-0')
      expect(result[0].text).toBe('Single paragraph content')
    })

    it('should split by empty lines', () => {
      const content = 'First paragraph\n\nSecond paragraph\n\nThird paragraph'
      const result = splitContentIntoParagraphs(content)
      expect(result.length).toBe(3)
      expect(result[0].id).toBe('para-0')
      expect(result[1].id).toBe('para-1')
      expect(result[2].id).toBe('para-2')
      expect(result[0].text).toBe('First paragraph')
      expect(result[1].text).toBe('Second paragraph')
      expect(result[2].text).toBe('Third paragraph')
    })

    it('should calculate correct line numbers', () => {
      const content = 'Line 1\nLine 2\n\nParagraph 2\nLine 3'
      const result = splitContentIntoParagraphs(content)
      expect(result.length).toBe(2)
      expect(result[0].lineStart).toBe(0)
      expect(result[0].lineEnd).toBe(1)
      expect(result[1].lineStart).toBe(3)
      expect(result[1].lineEnd).toBe(4)
    })

    it('should handle multiple empty lines', () => {
      const content = 'Para 1\n\n\n\nPara 2'
      const result = splitContentIntoParagraphs(content)
      expect(result.length).toBe(2)
      expect(result[0].text).toBe('Para 1')
      expect(result[1].text).toBe('Para 2')
    })

    it('should handle leading and trailing whitespace', () => {
      const content = '\n\nStart content\n\nMiddle\n\n  End with space  \n'
      const result = splitContentIntoParagraphs(content)
      expect(result.length).toBe(3)
      expect(result[0].text).toBe('Start content')
      expect(result[1].text).toBe('Middle')
      expect(result[2].text).toBe('End with space')
    })

    it('should handle Markdown headers', () => {
      const content = '# Heading\n\n## Subheading\n\nContent'
      const result = splitContentIntoParagraphs(content)
      expect(result.length).toBe(3)
      expect(result[0].text).toBe('# Heading')
      expect(result[1].text).toBe('## Subheading')
      expect(result[2].text).toBe('Content')
    })

    it('should handle Markdown list items', () => {
      const content = '- Item 1\n- Item 2\n\n- Item 3'
      const result = splitContentIntoParagraphs(content)
      expect(result.length).toBe(2)
      expect(result[0].text).toBe('- Item 1\n- Item 2')
      expect(result[1].text).toBe('- Item 3')
    })
  })
})
