import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType,
  ImageRun,
  convertInchesToTwip,
  WidthType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  TabStopPosition,
  TabStopType
} from 'docx'

// Minimal interfaces to avoid dependency issues
interface PaperData {
  paper_info: {
    title: string;
    author: string;
    school: string;
  };
  body: Block[];
}

interface Block {
  id: string;
  type: string;
  content?: string | any[];
  attrs?: any;
}

// Helpers for unit conversion
// 1em = 12pt = 24 half-points
// 1em = 12pt = 1/6 inch = 240 twips (approx, usually 12pt is 240 twips? 1pt = 20 twips. 12 * 20 = 240. Correct.)
const emToHalfPoints = (em: number | string) => {
  const val = parseFloat(em?.toString() || '0')
  return Math.round(val * 24)
}

const emToTwips = (em: number | string) => {
  const val = parseFloat(em?.toString() || '0')
  return Math.round(val * 240)
}

const sanitizeColor = (color: string) => {
  if (!color) return undefined
  return color.replace('#', '')
}

export const generateDocx = async (data: PaperData, assets: Record<string, string>, styles: any): Promise<Buffer> => {
  const doc = new Document({
    styles: {
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            size: emToHalfPoints(styles.h1.size),
            bold: styles.h1.weight === '700' || styles.h1.weight === 'bold',
            color: sanitizeColor(styles.h1.color),
            font: {
              ascii: styles.fonts.en,
              hAnsi: styles.fonts.en,
              eastAsia: styles.fonts.zh
            }
          },
          paragraph: {
            spacing: {
              before: emToTwips(styles.h1.marginTop),
              after: emToTwips(styles.h1.marginBottom)
            }
          }
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            size: emToHalfPoints(styles.h2.size),
            bold: styles.h2.weight === '600' || styles.h2.weight === 'bold',
            color: sanitizeColor(styles.h2.color),
            font: {
              ascii: styles.fonts.en,
              hAnsi: styles.fonts.en,
              eastAsia: styles.fonts.zh
            }
          },
          paragraph: {
            spacing: {
              before: emToTwips(styles.h2.marginTop),
              after: emToTwips(styles.h2.marginBottom)
            }
          }
        },
        {
            id: 'Heading3',
            name: 'Heading 3',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            run: {
              size: emToHalfPoints(styles.h3.size),
              bold: styles.h3.weight === '600' || styles.h3.weight === 'bold',
              color: sanitizeColor(styles.h3.color),
              font: {
                ascii: styles.fonts.en,
                hAnsi: styles.fonts.en,
                eastAsia: styles.fonts.zh
              }
            },
            paragraph: {
              spacing: {
                before: emToTwips(styles.h3.marginTop),
                after: emToTwips(styles.h3.marginBottom)
              }
            }
          },
          {
            id: 'Heading4',
            name: 'Heading 4',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            run: {
              size: emToHalfPoints(styles.h4.size),
              bold: styles.h4.weight === '600' || styles.h4.weight === 'bold',
              color: sanitizeColor(styles.h4.color),
              font: {
                ascii: styles.fonts.en,
                hAnsi: styles.fonts.en,
                eastAsia: styles.fonts.zh
              }
            },
            paragraph: {
              spacing: {
                before: emToTwips(styles.h4.marginTop),
                after: emToTwips(styles.h4.marginBottom)
              }
            }
          },
        {
          id: 'Normal',
          name: 'Normal',
          quickFormat: true,
          run: {
            size: emToHalfPoints(styles.body.size),
            color: sanitizeColor(styles.body.color),
            font: {
              ascii: styles.fonts.en,
              hAnsi: styles.fonts.en,
              eastAsia: styles.fonts.zh
            }
          },
          paragraph: {
            spacing: {
              line: parseInt(styles.body.lineHeight) * 240, // line height rule in docx is complex, using 240 rule (lines)
              before: emToTwips(styles.body.marginTop),
              after: emToTwips(styles.body.marginBottom)
            },
            indent: {
                firstLine: emToTwips(styles.body.indent)
            }
          }
        }
      ]
    },
    sections: [{
      properties: {},
      children: [
        // Title
        new Paragraph({
          text: data.paper_info.title,
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({
            text: `Author: ${data.paper_info.author}`,
            alignment: AlignmentType.CENTER
        }),
        new Paragraph({
            text: `School: ${data.paper_info.school}`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 } // Add some space after metadata
        }),
        ...processBlocks(data.body, assets)
      ]
    }]
  })

  return await Packer.toBuffer(doc)
}

const processBlocks = (blocks: Block[], assets: Record<string, string>): any[] => {
  return blocks.map(block => {
    switch (block.type) {
      case 'heading':
        return new Paragraph({
          heading: getHeadingLevel(block.attrs?.level),
          children: processContent(block.content),
          alignment: getAlignment(block.attrs?.textAlign)
        })
      
      case 'paragraph':
        return new Paragraph({
          children: processContent(block.content),
          alignment: getAlignment(block.attrs?.textAlign)
        })
        
      case 'image':
        if (block.attrs?.src) {
            return createImage(block.attrs.src, assets, block.attrs.width)
        }
        return new Paragraph({ text: '[Image missing]' })

      case 'list':
        // TODO: Handle lists (bullet/ordered)
        // For now treat as paragraph with bullet/number prefix
        const prefix = block.attrs?.listType === 'ordered' ? '1. ' : '• '
        return new Paragraph({
            children: [
                new TextRun({ text: prefix }),
                ...processContent(block.content)
            ]
        })

      case 'code':
        return new Paragraph({
            children: processContent(block.content),
            style: 'NoSpacing', // Use a style with no spacing? Or just default
            shading: {
                fill: 'F5F5F5' // Light gray background
            }
        })
      
      case 'math':
        // Export raw LaTeX for now
        return new Paragraph({
            children: [
                new TextRun({ text: block.content as string, font: 'Courier New' })
            ]
        })

      default:
        return new Paragraph({ text: '' })
    }
  })
}

const getHeadingLevel = (level?: number) => {
  switch (level) {
    case 1: return HeadingLevel.HEADING_1
    case 2: return HeadingLevel.HEADING_2
    case 3: return HeadingLevel.HEADING_3
    case 4: return HeadingLevel.HEADING_4
    default: return HeadingLevel.HEADING_1
  }
}

const getAlignment = (align?: string) => {
  switch (align) {
    case 'center': return AlignmentType.CENTER
    case 'right': return AlignmentType.RIGHT
    case 'justify': return AlignmentType.JUSTIFIED
    default: return AlignmentType.LEFT
  }
}

const processContent = (content?: string | any[]): TextRun[] => {
  if (!content) return []
  
  if (typeof content === 'string') {
    return [new TextRun(content)]
  }
  
  if (Array.isArray(content)) {
    return content.map(node => {
      if (node.type === 'text') {
        const trOptions: any = { text: node.text }
        
        // Handle Marks
        if (node.marks) {
          node.marks.forEach((mark: any) => {
            if (mark.type === 'bold') trOptions.bold = true
            if (mark.type === 'italic') trOptions.italics = true
            if (mark.type === 'strike') trOptions.strike = true
            if (mark.type === 'textStyle' && mark.attrs?.color) {
                trOptions.color = sanitizeColor(mark.attrs.color)
            }
            if (mark.type === 'highlight') {
                trOptions.highlight = 'yellow' // Default highlight
            }
            // Code mark
            if (mark.type === 'code') {
                trOptions.font = 'Courier New'
            }
          })
        }
        
        return new TextRun(trOptions)
      }
      return new TextRun('')
    })
  }
  
  return []
}

const createImage = (src: string, assets: Record<string, string>, width?: number) => {
  try {
    let buffer: Buffer | undefined
    let type: string = 'png' // Default type
    
    // Check if it's an asset
    if (src.startsWith('assets/')) {
        const filename = src.split('/')[1]
        const ext = filename.split('.').pop()?.toLowerCase()
        if (ext === 'jpg') type = 'jpeg'
        else if (ext) type = ext
        
        const base64 = assets[filename]
        if (base64) {
            // Remove data:image/png;base64, prefix
            const data = base64.replace(/^data:image\/\w+;base64,/, '')
            buffer = Buffer.from(data, 'base64')
        }
    } else if (src.startsWith('data:image')) {
        const match = src.match(/^data:image\/(\w+);base64,/)
        if (match) {
            type = match[1] === 'jpg' ? 'jpeg' : match[1]
        }
        const data = src.replace(/^data:image\/\w+;base64,/, '')
        buffer = Buffer.from(data, 'base64')
    }

    if (buffer) {
        return new Paragraph({
            children: [
                new ImageRun({
                    data: buffer,
                    transformation: {
                        width: width || 400,
                        height: (width || 400) * 0.75 // Aspect ratio? docx requires explicit dimensions.
                        // Ideally we should get aspect ratio. For now assume 4:3 or use max width.
                    },
                    type: type as any
                })
            ],
            alignment: AlignmentType.CENTER
        })
    }
  } catch (e) {
    console.error('Failed to create image:', e)
  }
  
  return new Paragraph({ text: '[Image Upload Failed]' })
}
