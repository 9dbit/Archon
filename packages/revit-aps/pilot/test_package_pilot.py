"""Archive-layout and missing-bridge fail-closed tests. No Autodesk tools needed."""
import pathlib
import shutil
import tempfile
import unittest
from unittest.mock import patch
from zipfile import ZipFile

import package_pilot as pkg

class BundleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name) / "pilot"
        self.root.mkdir()
        for name in ("PackageContents.xml", "Archon.Revit.Pilot.addin"):
            shutil.copyfile(pkg.ROOT / name, self.root / name)
        self.dll = self.root / pkg.PLUGIN
        self.dll.write_bytes(b"dummy test add-in, never used in Revit")
        self.bridge = self.root / pkg.BRIDGE

    def test_package_refuses_missing_bridge(self):
        with patch.object(pkg, "ROOT", self.root):
            with self.assertRaisesRegex(ValueError, "REVIT_BRIDGE_RUNTIME_MISSING"):
                pkg.package(self.dll)

    def test_bundle_includes_bridge_next_to_plugin_and_manifest(self):
        self.bridge.write_bytes(b"dummy test bridge, never used in Revit")
        with patch.object(pkg, "ROOT", self.root):
            pkg.package(self.dll)
        zip_path = self.root.parent / "artifacts/ArchonRevitReadOnlyPilot.zip"
        prefix = pkg.BUNDLE + "/"
        with ZipFile(zip_path) as archive:
            self.assertEqual(set(archive.namelist()), {
                prefix + "PackageContents.xml",
                prefix + "Contents/Archon.Revit.Pilot.addin",
                prefix + "Contents/Archon.Revit.Pilot.dll",
                prefix + "Contents/DesignAutomationBridge.dll",
            })
            self.assertEqual(archive.testzip(), None)
        self.assertEqual(len((self.root.parent / "artifacts/ArchonRevitReadOnlyPilot.zip.sha256").read_text().strip()), 64)

    def test_bundle_refuses_empty_bridge(self):
        self.bridge.write_bytes(b"")
        with patch.object(pkg, "ROOT", self.root):
            with self.assertRaisesRegex(ValueError, "REVIT_BRIDGE_RUNTIME_MISSING"):
                pkg.package(self.dll)

if __name__ == "__main__":
    unittest.main()
