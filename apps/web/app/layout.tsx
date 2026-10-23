import './globals.css';
import './revit-workspace.css';
import './ai-workspace.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'ARCHON | Revit Workspace',
  description: 'ARCHON native Revit workflow command center and Autodesk Viewer.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
