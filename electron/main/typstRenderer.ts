import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import type { PaperData } from '../../src/types/paper';

export class TypstRenderer {
  private typstPath: string;

  constructor(typstBinaryPath?: string) {
    if (typstBinaryPath) {
      this.typstPath = typstBinaryPath;
    } else {
      // Check for bundled binary
      const isDev = !app.isPackaged;
      const platform = process.platform;
      const exeName = platform === 'win32' ? 'typst.exe' : 'typst';
      
      let bundledPath = '';
      if (isDev) {
        bundledPath = path.join(process.cwd(), 'resources', 'bin', exeName);
      } else {
        bundledPath = path.join(process.resourcesPath, 'bin', exeName);
      }

      if (fs.existsSync(bundledPath)) {
        this.typstPath = bundledPath;
      } else {
        this.typstPath = 'typst'; // Fallback to PATH
      }
      console.log('Using typst binary at:', this.typstPath);
    }
  }
  
  // Render inline content (string or Tiptap JSON array)
  static renderContent(content: string | any[]): string {
    if (typeof content === 'string') {
      return content; // Plain text fallback
    }

    if (!Array.isArray(content)) {
      return '';
    }

    return content.map(node => {
      // Handle citations
      if (node.type === 'citation') {
         // Typst citation syntax: @key
         // We ensure the key matches the ID in references.bib
         return ` @${node.attrs.id || node.attrs.label} `;
      }

      if (node.type !== 'text') return '';
      
      let text = node.text || '';
      // Escape special characters for Typst content mode if necessary
      // For MVP, we assume text doesn't contain malicious Typst syntax
      
      let wrapperStart = '';
      let wrapperEnd = '';
      
      // Apply marks
      if (node.marks) {
        // Group textStyle attributes
        const textStyleAttrs: string[] = [];
        
        node.marks.forEach((mark: any) => {
          if (mark.type === 'bold') {
            text = `*${text}*`;
          } else if (mark.type === 'italic') {
            text = `_${text}_`;
          } else if (mark.type === 'strike') {
            wrapperStart = `#strike[` + wrapperStart;
            wrapperEnd = wrapperEnd + `]`;
          } else if (mark.type === 'textStyle') {
             if (mark.attrs?.fontSize) {
               textStyleAttrs.push(`size: ${mark.attrs.fontSize}`);
             }
             if (mark.attrs?.fontFamily) {
               textStyleAttrs.push(`font: "${mark.attrs.fontFamily}"`);
             }
          }
        });

        if (textStyleAttrs.length > 0) {
          wrapperStart = `#text(${textStyleAttrs.join(', ')})[` + wrapperStart;
          wrapperEnd = wrapperEnd + `]`;
        }
      }
      
      return `${wrapperStart}${text}${wrapperEnd}`;
    }).join('');
  }

  // 将content.json转换为.typ格式
  static convertToTypst(data: PaperData): string {
    let typstContent = `#set page("a4")
#set text(size: 12pt, font: ("SimSun", "Times New Roman"))
#set heading(numbering: none)

`;

    data.body.forEach(block => {
      const content = TypstRenderer.renderContent(block.content || '');
      
      switch (block.type) {
        case 'heading':
          const level = '='.repeat(block.attrs?.level || 1);
          typstContent += `${level} ${content}\n\n`;
          break;
          
        case 'paragraph':
          typstContent += `${content}\n\n`;
          break;
          
        case 'image':
          if (block.attrs?.src) {
            let imagePath = block.attrs.src;
            
            // Check if it is a Base64 image
            if (imagePath.startsWith('data:')) {
               // We need to use a temporary filename reference here.
               // The actual extraction and saving will be handled in renderPDF or we need to pass this info out.
               // However, `convertToTypst` is static and synchronous.
               // STRATEGY: 
               // 1. If it's Base64, we generate a unique filename hash.
               // 2. We assume the caller will provide the corresponding asset in `assets` map 
               //    OR we need to change how we handle this.
               
               // BETTER STRATEGY for MVP:
               // Since `renderPDF` takes `assets` map, we should rely on `assets` map containing the image data.
               // But here `block.attrs.src` is the Base64 string itself.
               // We should convert this Base64 string to a relative path that points to `assets/`.
               
               // To avoid parsing Base64 here, we can use a simple heuristic:
               // If it's a long string (Base64), we MUST have a filename associated with it, 
               // or we generate one. 
               
               // Wait, `convertToTypst` is pure function. It doesn't know about file system.
               // We should try to extract the filename if available, or generate a placeholder.
               
               if (block.attrs.fileName) {
                 // Perfect, we have a filename
                 imagePath = `assets/${block.attrs.fileName}`;
               } else {
                 // Fallback: We can't easily save the file here. 
                 // We will generate a temporary name based on hash or random.
                 // NOTE: This requires the CALLER (renderer) to also know this mapping to save the file!
                 // This implies `convertToTypst` needs to return both content AND extracted assets.
                 // Refactoring to keep it simple:
                 // We will assume `block.attrs.fileName` IS SET by the frontend (Editor.vue already does this!)
                 
                 // If `fileName` is missing but we have Base64, we are in trouble unless we modify the signature.
                 // Let's assume for now we use a hash of the content as filename if needed, 
                 // but Editor.vue logic suggests it tries to set `fileName`.
                 
                 // If we really have a raw Base64 without filename, we'll generate one
                 // But we need to ensure `renderPDF` receives this data.
                 // Currently `renderPDF` receives `assets` map.
                 
                 // Let's look at `open-preview-window` in index.ts.
                 // It passes `assets` map which is constructed from `data`... wait.
                 
                 // In `index.ts`:
                 // const assetBuffers: Record<string, Buffer> = {}
                 // if (assets) { ... }
                 
                 // The `assets` passed to `renderPDF` comes from the IPC call.
                 // The IPC call `open-preview-window` receives `{ data, assets }`.
                 // `data` contains the blocks. `assets` contains the filename->base64 map.
                 
                 // SO: If the block has a `fileName`, we are good.
                 // If the block has raw Base64 `src` but NO `fileName`, it means it's an inline image not yet saved as asset?
                 // Editor.vue line 81: `attrs.fileName = filename`. It seems it backfills it.
                 
                 // However, the error log showed the Base64 string was IN the typst file.
                 // This means `block.attrs.src` WAS the Base64 string.
                 
                 // FIX:
                 // We should detect Base64 and if `block.attrs.fileName` exists, use that.
                 if (block.attrs.fileName) {
                    imagePath = `assets/${block.attrs.fileName}`;
                 } else {
                    // If no filename, we can't magically save it in renderPDF unless we return it.
                    // But we can generate a name and hope it's in the assets map? 
                    // No, if it's not in assets map, renderPDF won't save it.
                    
                    // CRITICAL FIX: The frontend should ensure `fileName` is present.
                    // But to be safe, if we see Base64, we MUST NOT output it to Typst.
                    // We will output a placeholder or error to avoid crashing Typst.
                    // Or better: We simply don't render the image if it's malformed.
                    console.warn("Skipping Base64 image without fileName in Typst generation");
                    imagePath = ""; // Skip
                 }
               }
            }
            
            if (imagePath) {
                typstContent += `#figure(
  image("${imagePath}"),
  caption: [${block.attrs.caption || ""}]
)\n\n`;
            }
          }
          break;
          
        case 'citation':
          if (block.attrs?.refId) {
            typstContent += `@${block.attrs.refId} `;
          }
          break;

        case 'math':
          if (block.attrs?.src) {
             typstContent += `$ ${block.attrs.src} $\n\n`;
          }
          break;
      }
    });

    // Add Bibliography
    // We use Typst's native bibliography management
    // The 'references.bib' file will be generated in the assets folder by the caller
    if (data.references && data.references.length > 0) {
      typstContent += `\n\n#bibliography("assets/references.bib", style: "gb-7714-2015-numeric")`;
    }

    return typstContent;
  }
  
  // 渲染PDF
  async renderPDF(typstContent: string, outputPath: string, assets: Record<string, Buffer> = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      const tempDir = path.dirname(outputPath);
      const tempTypstPath = outputPath.replace('.pdf', '.typ');
      
      // 1. 写入临时资源文件
      const assetsDir = path.join(tempDir, 'assets');
      if (!fs.existsSync(assetsDir) && Object.keys(assets).length > 0) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }
      
      for (const [name, buffer] of Object.entries(assets)) {
        fs.writeFileSync(path.join(assetsDir, name), buffer);
      }

      // 2. 写入临时.typ文件
      fs.writeFileSync(tempTypstPath, typstContent);
      
      // 3. 调用Typst编译
      // 确保typst命令在环境变量中，或者传入了绝对路径
      const typst = spawn(this.typstPath, ['compile', tempTypstPath, outputPath]);
      
      let errorOutput = '';

      typst.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      typst.on('close', (code) => {
        // 清理临时文件 (可选，debug时可保留)
        // fs.unlinkSync(tempTypstPath);
        // fs.rmSync(assetsDir, { recursive: true, force: true });

        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`Typst compilation failed with code ${code}: ${errorOutput}`));
        }
      });
      
      typst.on('error', (error) => {
        reject(error);
      });
    });
  }
}
