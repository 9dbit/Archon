import './globals.css';
import './revit-workspace.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'ARCHON | Revit Workspace',
  description: 'Cloud Revit workflows, BIM review and Autodesk Viewer in one guided workspace.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
