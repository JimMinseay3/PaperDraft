import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import type { PaperData, Snapshot, HistoryIndex, VersionGraph, Branch, VersionNode } from '../../src/types/paper';
import { VersionManager } from './versionManager';

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
        // Initialize version graph for new files
        VersionManager.saveGraph(zip, VersionManager.createInitialGraph());
        // Create initial snapshot for the new file
        // We use 'milestone' to mark it as a significant version (Initial Version)
        VersionManager.commit(zip, data, "Initial Version", 'milestone');
      }
      
      // Update content.json (Working Directory)
      zip.addFile('content.json', Buffer.from(JSON.stringify(data, null, 2)));
      
      // Update assets
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

  // Create Snapshot (Delegates to VersionManager)
  static async createSnapshot(filePath: string, data: PaperData, note: string, type: 'manual' | 'auto'): Promise<VersionNode> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('Cannot create snapshot: File does not exist. Save first.');
      }

      const zip = new AdmZip(filePath);
      
      // Use VersionManager to commit
      const node = VersionManager.commit(zip, data, note, type === 'manual' ? 'milestone' : 'snapshot');
      
      zip.writeZip(filePath);
      return node;

    } catch (error: any) {
      throw new Error(`Failed to create snapshot: ${error.message}`);
    }
  }

  static async saveAutosave(filePath: string, data: PaperData): Promise<VersionNode> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('Cannot autosave: File does not exist.');
      }
      const zip = new AdmZip(filePath);
      const node = VersionManager.saveAutosave(zip, data);
      zip.writeZip(filePath);
      return node;
    } catch (error: any) {
      throw new Error(`Failed to autosave: ${error.message}`);
    }
  }

  // Get Version Graph
  static async getVersionGraph(filePath: string): Promise<VersionGraph> {
    try {
      if (!fs.existsSync(filePath)) return VersionManager.createInitialGraph();
      const zip = new AdmZip(filePath);
      return VersionManager.getGraph(zip);
    } catch (error) {
      console.error('Failed to get version graph:', error);
      return VersionManager.createInitialGraph();
    }
  }

  // Create Branch
  static async createBranch(filePath: string, name: string, fromNodeId?: string): Promise<Branch> {
    try {
        if (!fs.existsSync(filePath)) throw new Error('File not found');
        const zip = new AdmZip(filePath);
        const branch = VersionManager.createBranch(zip, name, fromNodeId);
        zip.writeZip(filePath);
        return branch;
    } catch (e: any) {
        throw new Error(`Failed to create branch: ${e.message}`);
    }
  }

  // Switch Branch
  static async switchBranch(filePath: string, branchId: string): Promise<PaperData> {
      try {
          if (!fs.existsSync(filePath)) throw new Error('File not found');
          const zip = new AdmZip(filePath);
          
          const result = VersionManager.switchBranch(zip, branchId);
          
          if (result.success && result.data) {
              // Update working copy content.json
              zip.addFile('content.json', Buffer.from(JSON.stringify(result.data, null, 2)));
              zip.writeZip(filePath);
              return result.data;
          }
          
          // If no data (empty branch), return current or empty?
          // For now, assume branch always has a head if created properly, 
          // or we just initialized it.
          // If empty, maybe return empty paper?
          return this.createNewPaper(); // Fallback
          
      } catch (e: any) {
          throw new Error(`Failed to switch branch: ${e.message}`);
      }
  }

  // Legacy Support: Get Snapshots List (Mapped from Graph)
  static async getSnapshots(filePath: string): Promise<Snapshot[]> {
    try {
      const graph = await this.getVersionGraph(filePath);
      // Flatten nodes to list for legacy view
      return Object.values(graph.nodes).map((node): Snapshot => ({
          id: node.id,
          timestamp: node.timestamp,
          note: node.note,
          type: node.type === 'milestone' ? 'manual' : 'auto',
          wordCount: node.wordCount
      })).sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      return [];
    }
  }

  static async deleteSnapshot(filePath: string, snapshotId: string): Promise<boolean> {
    try {
      const zip = new AdmZip(filePath);
      const result = VersionManager.deleteSnapshot(zip, snapshotId);
      if (result) {
        zip.writeZip(filePath);
      }
      return result;
    } catch (error: any) {
      throw new Error(`Failed to delete snapshot: ${error.message}`);
    }
  }

  // Load Snapshot Content
  static async loadSnapshot(filePath: string, snapshotId: string): Promise<PaperData> {
    try {
      const zip = new AdmZip(filePath);
      const graph = VersionManager.getGraph(zip);
      const node = graph.nodes[snapshotId];
      if (!node) {
          // Fallback to legacy path check
          try {
             const entry = zip.getEntry(`history/${snapshotId}_content.json`);
             if (entry) return JSON.parse(zip.readAsText(entry));
          } catch(e) {}
          throw new Error('Snapshot not found');
      }
      return VersionManager.loadNodeData(zip, node);
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
