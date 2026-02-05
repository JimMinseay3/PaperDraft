import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import type { PaperData } from '../../src/types/paper';

export class PaperFileHandler {
  // 加载.paper文件
  static async loadPaper(filePath: string): Promise<{ data: PaperData; assets: Record<string, Buffer>; filePath: string }> {
    try {
      const zip = new AdmZip(filePath);
      const contentEntry = zip.getEntry('content.json');
      
      if (!contentEntry) {
        throw new Error('Invalid paper file: content.json not found');
      }
      
      const contentText = zip.readAsText(contentEntry);
      const contentData = JSON.parse(contentText) as PaperData;
      
      // 提取资源文件
      const assets: Record<string, Buffer> = {};
      const assetEntries = zip.getEntries().filter(entry => 
        entry.entryName.startsWith('assets/') && !entry.isDirectory
      );
      
      for (const entry of assetEntries) {
        const assetName = path.basename(entry.entryName);
        assets[assetName] = zip.readFile(entry);
      }
      
      return {
        data: contentData,
        assets: assets,
        filePath: filePath
      };
    } catch (error: any) {
      throw new Error(`Failed to load paper file: ${error.message}`);
    }
  }
  
  // 保存.paper文件
  static async savePaper(filePath: string, data: PaperData, assets: Record<string, Buffer> = {}): Promise<{ success: boolean; filePath: string }> {
    try {
      const zip = new AdmZip();
      
      // 添加content.json
      zip.addFile('content.json', Buffer.from(JSON.stringify(data, null, 2)));
      
      // 添加资源文件
      for (const [assetName, assetData] of Object.entries(assets)) {
        if (assetData instanceof Buffer) {
          zip.addFile(`assets/${assetName}`, assetData);
        }
      }
      
      // 写入文件
      zip.writeZip(filePath);
      
      return { success: true, filePath };
    } catch (error: any) {
      throw new Error(`Failed to save paper file: ${error.message}`);
    }
  }
  
  // 创建新文档
  static createNewPaper(title?: string, author?: string, school?: string): PaperData {
    return {
      version: "1.0.0",
      paper_info: {
        title: title || "未命名论文",
        author: author || "作者",
        school: school || "学校"
      },
      body: [
        {
            id: 'b1',
            type: 'heading',
            attrs: { level: 1 },
            content: '第一章 绪论'
        },
        {
            id: 'b2',
            type: 'paragraph',
            content: '在此输入内容...'
        }
      ],
      references: []
    };
  }
}
