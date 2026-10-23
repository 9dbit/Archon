/**
 * UI-only Revit command plan contract.
 * No Autodesk WorkItem can be submitted by this module.
 * Every tool builds an inspectable, typed draft rather than silently editing a model.
 */

export type RevitTool = 'ai' | 'wall' | 'door' | 'window' | 'floor' | 'level' | 'inspect' | 'section';
export type RevitSource = 'pilot' | 'local' | 'project';
export type RevitParameters = Record<string, string>;
export type RevitField = { key: string; label: string; unit?: string; placeholder?: string; defaultValue: string; kind: 'number' | 'text'; min?: number; required?: boolean };
export type RevitToolDefinition = {
  id: RevitTool; name: string; readOnly: boolean; description: string; fields: RevitField[];
};
export type RevitDraft = {
  id: string;
  projectId: string;
  projectName: string;
  source: RevitSource;
  sourceLabel: string;
  localOnly: boolean;
  tool: RevitTool;
  instruction: string;
  parameters: RevitParameters;
  createdAt: string;
  reviewed: boolean;
  validation: string[];
};
const numeric = (key: string, label: string, defaultValue: number, unit = 'mm', min = 1): RevitField =>
  ({ key, label, defaultValue: String(defaultValue), unit, kind: 'number', min, required: true });
const string = (key: string, label: string, defaultValue = '', required = true): RevitField =>
  ({ key, label, defaultValue, kind: 'text', required });
export const REVIT_TOOLS: RevitToolDefinition[] = [
  { id: 'ai', name: 'AI command', readOnly: false, description: 'Bahasa natural; cek instruksi sebelum eksekusi', fields: [] },
  { id: 'wall', name: 'Wall', readOnly: false, description: 'Dinding dengan titik awal, akhir, level dan tinggi', fields: [
    numeric('startXmm', 'Start X', 0, 'mm', -1000000), numeric('startYmm', 'Start Y', 0, 'mm', -1000000),
    numeric('endXmm', 'End X', 5000, 'mm', -1000000), numeric('endYmm', 'End Y', 0, 'mm', -1000000),
    numeric('heightMm', 'Height', 3500), numeric('thicknessMm', 'Thickness', 150, 'mm', 50),
    string('level', 'Base level', 'Level 1')
  ] },
  { id: 'door', name: 'Door', readOnly: false, description: 'Pintu membutuhkan host wall dan family', fields: [
    string('hostWallId', 'Host wall Element ID', ''), string('family', 'Door family', 'Single-Flush'),
    numeric('widthMm', 'Width', 900), numeric('heightMm', 'Height', 2100), numeric('offsetMm', 'Offset on host', 1000, 'mm', 0)
  ] },
  { id: 'window', name: 'Window', readOnly: false, description: 'Jendela membutuhkan host wall dan family', fields: [
    string('hostWallId', 'Host wall Element ID', ''), string('family', 'Window family', 'Fixed'),
    numeric('widthMm', 'Width', 1200), numeric('heightMm', 'Height', 1200),
    numeric('sillMm', 'Sill height', 900, 'mm', 0)
  ] },
  { id: 'floor', name: 'Floor', readOnly: false, description: 'Pelat lantai dengan boundary tertutup berbentuk persegi panjang', fields: [
    numeric('widthMm', 'Width', 12000), numeric('lengthMm', 'Length', 20000),
    numeric('thicknessMm', 'Thickness', 150, 'mm', 50),
    string('level', 'Base level', 'Level 1')
  ] },
  { id: 'level', name: 'Level', readOnly: false, description: 'Tambah datum elevasi baru setelah cek duplikat', fields: [
    string('name', 'Level name', 'Level 2'), numeric('elevationMm', 'Elevation', 3500, 'mm', -1000000)
  ] },
  { id: 'inspect', name: 'Inspect', readOnly: true, description: 'Baca level, kategori, jumlah elemen dan properti', fields: [
    string('scope', 'Scope / category', 'Entire model')
  ] },
  { id: 'section', name: 'Section', readOnly: false, description: 'Definisikan view potongan dan bidang crop', fields: [
    string('name', 'View name', 'Section A-A'),
    string('level', 'Reference level', 'Level 1'),
    numeric('depthMm', 'View depth', 12000)
  ] }
];
export const PILOT_INSTRUCTION = 'Generate a NEW, empty metric Revit project with 4 perimeter walls forming a 12,000 x 20,000 mm rectangle, wall height 3,500 mm, and levels at +0 and +3,500 mm. Save output as pilot.rvt. Do not access customer files.';
export function defaultsForTool(tool: RevitTool): RevitParameters {
  const definition = REVIT_TOOLS.find(item => item.id === tool);
  return Object.fromEntries((definition?.fields ?? []).map(field => [field.key, field.defaultValue]));
}
export function validateRevitCommand(tool: RevitTool, parameters: RevitParameters, instruction: string): string[] {
  const definition = REVIT_TOOLS.find(item => item.id === tool);
  if (!definition) return ['Unknown command tool'];
  if (tool === 'ai') {
    const count = instruction.trim().length;
    return count < 12 ? ['Instruction must contain at least 12 characters'] :
      count > 3000 ? ['Instruction exceeds 3,000 characters'] : [];
  }
  const errors: string[] = [];
  for (const field of definition.fields) {
    const value = (parameters[field.key] ?? '').trim();
    if (field.required && !value) { errors.push(field.label + ' is required'); continue; }
    if (field.kind === 'number' && value) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) errors.push(field.label + ' must be a number');
      else if (field.min !== undefined && parsed < field.min) errors.push(field.label + ' must be at least ' + field.min + ' ' + (field.unit ?? ''));
    }
  }
  if (tool === 'wall') {
    const dx = Number(parameters.endXmm) - Number(parameters.startXmm);
    const dy = Number(parameters.endYmm) - Number(parameters.startYmm);
    if (Number.isFinite(dx) && Number.isFinite(dy) && Math.hypot(dx, dy) < 100) errors.push('Wall must be at least 100 mm long');
  }
  return errors;
}
export function instructionForTool(tool: RevitTool, parameters: RevitParameters, raw: string): string {
  if (tool === 'ai') return raw.trim();
  const definition = REVIT_TOOLS.find(item => item.id === tool);
  const props = (definition?.fields ?? []).map(field => field.label + '=' + (parameters[field.key] ?? '').trim() + (field.unit ? ' ' + field.unit : ''));
  return (definition?.readOnly ? 'Read' : 'Prepare to create') + ' Revit ' + (definition?.name ?? tool) +
    ': ' + props.join(', ') + '. Check geometry/host/family and show changes before executing. Do not modify production without approval.';
}
