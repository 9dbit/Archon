# E8 AutoCAD Viewer SDK loader

ARCHON now loads the Autodesk Viewer SDK only after the guarded server session reports READY. The browser receives a short-lived read-only Viewer token and translated derivative URN; Automation credentials never enter the browser.

The canvas lifecycle is explicit: script load, Viewer initializer, GuiViewer3D start, derivative document load, and cleanup on unmount. Any failure renders a diagnostic state and keeps execution and external sync locked.

The Viewer is a review surface for an external artifact. It does not mutate the ARCHON Building Graph, create or approve a ChangeSet, or execute an APS Automation job. A valid APS Viewer URN and successful translation remain required before the SDK is loaded.