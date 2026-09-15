# E8 AutoCAD Viewer session transport foundation

The Viewer foundation now has a server-only session route for a verified Autodesk derivative. It refuses to issue a session unless the Viewer gate is enabled, a translated derivative URN is configured, and translation status is `SUCCESS`.

When those conditions are met, the route requests a short-lived APS token with the read-only `viewables:read` scope and returns only the Viewer access token, expiry, URN, and non-secret diagnostics. It never returns the AutoCAD Automation credential or client secret. The route is `no-store` and keeps execution and external sync locked.

The current UI remains a review shell until the actual Autodesk Viewer SDK loader is wired. This separation makes resource and token readiness observable without pretending that an external DWG is canonical or approved.

No production ChangeSet, DWG upload, Automation workitem, approval, or Building Graph mutation is performed by this checkpoint.
