import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import type { PaperData } from '../../src/types/paper';

export class TypstRenderer {
  private typstPath: string;

  constructor(typstBinaryPath: string = 'typst') {
    this.typstPath = typstBinaryPath;
  }
  
  // 将content.json转换为.typ格式
  static convertToTypst(data: PaperData): string {
    let typstContent = `#set page("a4")
#set text(size: 12pt, font: ("SimSun", "Times New Roman"))
#set heading(numbering: "1.")

= ${data.paper_info.title}

*作者*: ${data.paper_info.author}
*学校*: ${data.paper_info.school}

`;

    data.body.forEach(block => {
      switch (block.type) {
        case 'heading':
          const level = '='.repeat(block.attrs?.level || 1);
          typstContent += `${level} ${block.content || ''}\n\n`;
          break;
          
        case 'paragraph':
          typstContent += `${block.content || ''}\n\n`;
          break;
          
        case 'image':
          if (block.attrs?.src) {
            // 注意：这里引用的图片路径需要是Typst能访问到的临时路径或相对路径
            // 在实际渲染时，我们需要将assets解压到临时目录，并让Typst指向那里
            typstContent += `#figure(
  image("${block.attrs.src}"),
  caption: [${block.attrs.caption || ""}]
)\n\n`;
          }
          break;
          
        case 'citation':
          if (block.attrs?.refId) {
            typstContent += `@${block.attrs.refId} `;
          }
          break;
      }
    });

    // 添加参考文献
    if (data.references.length > 0) {
      typstContent += "\n= 参考文献\n\n";
      // Typst通常使用BibTeX或Hayagriva，这里我们手动模拟简单的列表，或者生成临时bib文件
      // 为简化MVP，这里直接用列表展示
      data.references.forEach((ref, index) => {
        typstContent += `+ ${ref.author}. ${ref.title}. ${ref.year}.\n`;
      });
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
