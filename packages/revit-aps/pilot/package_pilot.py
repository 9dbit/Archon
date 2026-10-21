#!/usr/bin/env python3
"""Offline deterministic Revit bundle packaging. No API requests or uploads."""
import hashlib
import pathlib
import sys
import xml.etree.ElementTree as ET
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = pathlib.Path(__file__).resolve().parent
BUNDLE = "ArchonRevitReadOnlyPilot.bundle"
PLUGIN = "Archon.Revit.Pilot.dll"
BRIDGE = "DesignAutomationBridge.dll"

def package(dll_path: pathlib.Path):
    if not dll_path.is_file() or dll_path.name != PLUGIN:
        raise ValueError("REVIT_PILOT_DLL_INVALID")
    # DesignAutomationBridge must be shipped beside the add-in DLL. RevitAPI.dll
    # is part of the hosted Revit engine and is deliberately not shipped.
    bridge_path = dll_path.parent / BRIDGE
    if not bridge_path.is_file() or bridge_path.stat().st_size == 0:
        raise ValueError("REVIT_BRIDGE_RUNTIME_MISSING")
    root = ET.parse(ROOT / "PackageContents.xml").getroot()
    component = root.find("./Components/ComponentEntry")
    if component is None or component.attrib.get("ModuleName") != "./Contents/Archon.Revit.Pilot.addin":
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
        ("Contents/" + PLUGIN, dll_path),
        ("Contents/" + BRIDGE, bridge_path),
    ]
    with ZipFile(zip_path, "w") as archive:
        for name, source in components:
            item = ZipInfo(BUNDLE + "/" + name, date_time=(2026, 1, 1, 0, 0, 0))
            item.compress_type = ZIP_DEFLATED
            item.external_attr = 0o644 << 16
            archive.writestr(item, source.read_bytes())
    with ZipFile(zip_path) as archive:
        if sorted(archive.namelist()) != sorted(BUNDLE + "/" + path for path, _ in components):
            raise ValueError("REVIT_PILOT_ZIP_CONTENT_INVALID")
        if archive.testzip() is not None:
            raise ValueError("REVIT_PILOT_ZIP_CORRUPTED")
    digest = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    (target / "ArchonRevitReadOnlyPilot.zip.sha256").write_text(digest + "\n", encoding="utf-8")
    print("REVIT_PILOT_BUNDLE_VERIFIED " + digest)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: package_pilot.py <path/to/Archon.Revit.Pilot.dll>")
    package(pathlib.Path(sys.argv[1]))
