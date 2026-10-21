"""Fail-closed offline archive and manifest tests. Test DLLs are intentionally fake."""
import pathlib
import shutil
import tempfile
import unittest
from unittest.mock import patch
from zipfile import ZipFile

import package_generator as pkg


class GeneratorBundleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name) / "generator"
        self.root.mkdir()
        for name in ("PackageContents.xml", pkg.ADDIN):
            shutil.copyfile(pkg.ROOT / name, self.root / name)
        self.dll = self.root / pkg.PLUGIN
        self.dll.write_bytes(b"generator fixture, never executed")
        self.bridge = self.root / pkg.BRIDGE

    def test_missing_bridge_fails_closed(self):
        with patch.object(pkg, "ROOT", self.root):
            with self.assertRaisesRegex(ValueError, "REVIT_GENERATOR_BRIDGE_MISSING"):
                pkg.package(self.dll)

    def test_includes_bridge_and_correct_addin(self):
        self.bridge.write_bytes(b"fake bridge fixture")
        with patch.object(pkg, "ROOT", self.root):
            pkg.package(self.dll)
        zip_path = self.root.parent / "artifacts/ArchonRevitGeneratePilot.zip"
        with ZipFile(zip_path) as archive:
            self.assertEqual(set(archive.namelist()), {
                pkg.BUNDLE + "/PackageContents.xml",
                pkg.BUNDLE + "/Contents/" + pkg.ADDIN,
                pkg.BUNDLE + "/Contents/" + pkg.PLUGIN,
                pkg.BUNDLE + "/Contents/" + pkg.BRIDGE,
            })
            self.assertEqual(archive.testzip(), None)
        digest_path = self.root.parent / "artifacts/ArchonRevitGeneratePilot.zip.sha256"
        self.assertEqual(len(digest_path.read_text().strip()), 64)

    def test_bad_addin_class_rejected(self):
        self.bridge.write_bytes(b"fake bridge fixture")
        addin = self.root / pkg.ADDIN
        addin.write_text(addin.read_text().replace("GeneratorHandler", "UnknownHandler"))
        with patch.object(pkg, "ROOT", self.root):
            with self.assertRaisesRegex(ValueError, "REVIT_GENERATOR_ADDIN_CLASS_INVALID"):
                pkg.package(self.dll)


if __name__ == "__main__":
    unittest.main()
