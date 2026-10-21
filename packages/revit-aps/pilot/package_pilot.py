#!/usr/bin/env python3
"""Offline deterministic Revit bundle packaging. No uploads."""
import hashlib
import pathlib
import sys
import xml.etree.ElementTree as ET
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = pathlib.Path(__file__).resolve().parent

def package(dll_path: pathlib.Path):
    if not dll_path.is_file() or dll_path.name != "Archon.Revit.Pilot.dll":
        raise ValueError("REVIT_PILOT_DLL_INVALID")
    root = ET.parse(ROOT / "PackageContents.xml").getroot()
    entry = root.find("./Components/ComponentEntry")
    if entry is None or entry.attrib.get("ModuleName") != "./Contents/Archon.Revit.Pilot.addin":
        raise ValueError("REVIT_PILOT_MANIFEST_INVALID")
    addin = ET.parse(ROOT / "Archon.Revit.Pilot.addin").getroot()
    if addin.findtext("./AddIn/Assembly") != ".\\Archon.Revit.Pilot.dll":
        raise ValueError("REVIT_PILOT_ADDIN_INVALID")
    target = ROOT.parent / "artifacts"
    target.mkdir(parents=True, exist_ok=True)
    zip_path = target / "ArchonRevitReadOnlyPilot.zip"
    components = [
        ("PackageContents.xml", ROOT / "PackageContents.xml"),
        ("Contents/Archon.Revit.Pilot.addin", ROOT / "Archon.Revit.Pilot.addin"),
        ("Contents/Archon.Revit.Pilot.dll", dll_path),
    ]
    with ZipFile(zip_path, "w") as archive:
        for name, source in components:
            entry = ZipInfo("ArchonRevitReadOnlyPilot.bundle/" + name, date_time=(2026, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o644 << 16
            archive.writestr(entry, source.read_bytes())
    digest = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    (target / "ArchonRevitReadOnlyPilot.zip.sha256").write_text(digest + "\n", encoding="utf-8")
    with ZipFile(zip_path) as archive:
        assert len(archive.namelist()) == 3, "REVIT_PILOT_ZIP_CONTENT_INVALID"
    print("REVIT_PILOT_BUNDLE_VERIFIED " + digest)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: package_pilot.py <path/to/Archon.Revit.Pilot.dll>")
    package(pathlib.Path(sys.argv[1]))
