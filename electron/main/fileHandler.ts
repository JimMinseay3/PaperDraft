import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import type { PaperData, Snapshot, HistoryIndex } from '../../src/types/paper';

export class PaperFileHandler {
  // Load .paper file
  static async loadPaper(filePath: string): Promise<{ data: PaperData; assets: Record<string, Buffer>; filePath: string }> {
    try {
      const zip = new AdmZip(filePath);
      const contentEntry = zip.getEntry('content.json');
      
      if (!contentEntry) {
        throw new Error('Invalid paper file: content.json not found');
      }
      
      const contentText = zip.readAsText(contentEntry);
      const contentData = JSON.parse(contentText) as PaperData;
      
      // Extract assets
      const assets: Record<string, Buffer> = {};
      const assetEntries = zip.getEntries().filter(entry => 
        entry.entryName.startsWith('assets/') && !entry.isDirectory
      );
      
      for (const entry of assetEntries) {
        const assetName = path.basename(entry.entryName);
        const buffer = zip.readFile(entry);
        if (buffer) {
          assets[assetName] = buffer;
        }
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
  
  // Save .paper file (Preserves history)
  static async savePaper(filePath: string, data: PaperData, assets: Record<string, Buffer> = {}): Promise<{ success: boolean; filePath: string }> {
    try {
      // If file exists, load it to preserve history/other files. If not, create new.
      let zip: AdmZip;
      if (fs.existsSync(filePath)) {
        zip = new AdmZip(filePath);
      } else {
        zip = new AdmZip();
      }
      
      // Update content.json
      zip.addFile('content.json', Buffer.from(JSON.stringify(data, null, 2)));
      
      // Update assets
      // Note: This adds/overwrites assets. It doesn't delete unused ones (which is safer for history)
      for (const [assetName, assetData] of Object.entries(assets)) {
        if (assetData instanceof Buffer) {
          zip.addFile(`assets/${assetName}`, assetData);
        }
      }
      
      // Write file
      zip.writeZip(filePath);
      
      return { success: true, filePath };
    } catch (error: any) {
      throw new Error(`Failed to save paper file: ${error.message}`);
    }
  }

  // Create Snapshot
  static async createSnapshot(filePath: string, data: PaperData, note: string, type: 'manual' | 'auto'): Promise<Snapshot> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('Cannot create snapshot: File does not exist. Save first.');
      }

      const zip = new AdmZip(filePath);
      const timestamp = Date.now();
      const id = `v${timestamp}`;
      
      // 1. Save Content Copy
      const contentStr = JSON.stringify(data, null, 2);
      zip.addFile(`history/${id}_content.json`, Buffer.from(contentStr));

      // 2. Update History Index
      let historyIndex: HistoryIndex = { snapshots: [] };
      const indexEntry = zip.getEntry('history/index.json');
      if (indexEntry) {
        const indexStr = zip.readAsText(indexEntry);
        try {
          historyIndex = JSON.parse(indexStr);
        } catch (e) {
          console.error('Failed to parse history index, creating new one');
        }
      }

      // Calculate word count (simple approximation)
      let wordCount = 0;
      data.body.forEach(b => {
        if (typeof b.content === 'string') {
          wordCount += b.content.length;
        }
      });

      const snapshot: Snapshot = {
        id,
        timestamp,
        note,
        type,
        wordCount
      };

      historyIndex.snapshots.unshift(snapshot); // Add to top
      
      // Limit auto snapshots if needed? For now keep all.
      
      zip.addFile('history/index.json', Buffer.from(JSON.stringify(historyIndex, null, 2)));

      zip.writeZip(filePath);
      return snapshot;

    } catch (error: any) {
      throw new Error(`Failed to create snapshot: ${error.message}`);
    }
  }

  // Get Snapshots List
  static async getSnapshots(filePath: string): Promise<Snapshot[]> {
    try {
      if (!fs.existsSync(filePath)) return [];
      
      const zip = new AdmZip(filePath);
      const indexEntry = zip.getEntry('history/index.json');
      if (!indexEntry) return [];
      
      const indexStr = zip.readAsText(indexEntry);
      const index = JSON.parse(indexStr) as HistoryIndex;
      return index.snapshots || [];
    } catch (error) {
      console.error('Failed to get snapshots:', error);
      return [];
    }
  }

  // Load Snapshot Content
  static async loadSnapshot(filePath: string, snapshotId: string): Promise<PaperData> {
    try {
      const zip = new AdmZip(filePath);
      const entryName = `history/${snapshotId}_content.json`;
      const entry = zip.getEntry(entryName);
      
      if (!entry) {
        throw new Error(`Snapshot content not found: ${entryName}`);
      }
      
      const contentStr = zip.readAsText(entry);
      return JSON.parse(contentStr) as PaperData;
    } catch (error: any) {
      throw new Error(`Failed to load snapshot: ${error.message}`);
    }
  }
  
  // Create New Paper
  static createNewPaper(title?: string, author?: string, school?: string): PaperData {
    return {
      version: "1.0.0",
      paper_info: {
        title: title || "Untitled Paper",
        author: author || "Author",
        school: school || "School"
      },
      body: [
        {
            id: 'b1',
            type: 'heading',
            attrs: { level: 1 },
            content: 'Introduction'
        },
        {
            id: 'b2',
            type: 'paragraph',
            content: 'Start typing here...'
        }
      ],
      references: []
    };
  }
}
